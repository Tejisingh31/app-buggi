import { db } from '../db/database';
import { aggiornaImpostazioni, leggiImpostazioni } from '../db/repository';
import { oggiIso } from '../utils/date';
import { creaBackup, testoBackup } from './exportJson';
import { nomeFileBackup } from './formato';
import { salvaCopiaSicurezza } from './importJson';

/**
 * Backup automatico giornaliero.
 *
 * Un'app web non può lavorare quando è chiusa, quindi il backup "della notte" si fa
 * alla prima apertura del giorno (o subito dopo mezzanotte se l'app è aperta):
 * 1. sempre: una copia dentro l'app (si tengono gli ultimi 7 giorni);
 * 2. dove il browser lo permette (Chrome/Edge su computer): anche un file .json
 *    nella cartella scelta una volta sola (sottocartella "Buggi backup", si tengono gli ultimi 30).
 * Su iPhone/Android il browser non permette di scrivere file da solo: resta il promemoria.
 */

const CHIAVE_CARTELLA = 'cartellaBackup';
export const NOME_SOTTOCARTELLA = 'Buggi backup';
const FILE_DA_TENERE = 30;
const FILE_BACKUP = /^pagamenti-backup-\d{4}-\d{2}-\d{2}\.json$/;

/** true se questo browser permette di scegliere una cartella dove salvare da solo. */
export const cartellaSupportata = () => typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';

export async function leggiCartella(): Promise<FileSystemDirectoryHandle | undefined> {
  return (await db.archivio.get(CHIAVE_CARTELLA))?.valore as FileSystemDirectoryHandle | undefined;
}

/** Chiede all'utente dove salvare (si apre su Documenti) e crea lì la cartella "Buggi backup". */
export async function scegliCartella(): Promise<FileSystemDirectoryHandle> {
  if (!window.showDirectoryPicker) throw new Error('Questo browser non permette di scegliere una cartella');
  const scelta = await window.showDirectoryPicker({ id: 'buggi-backup', mode: 'readwrite', startIn: 'documents' });
  const cartella = scelta.name === NOME_SOTTOCARTELLA ? scelta : await scelta.getDirectoryHandle(NOME_SOTTOCARTELLA, { create: true });
  await db.archivio.put({ chiave: CHIAVE_CARTELLA, valore: cartella });
  return cartella;
}

export async function dimenticaCartella(): Promise<void> {
  await db.archivio.delete(CHIAVE_CARTELLA);
}

/** Permesso di scrivere nella cartella. Con `chiedi` lo domanda all'utente (serve un tocco). */
export async function permessoCartella(cartella: FileSystemDirectoryHandle, chiedi = false): Promise<PermissionState> {
  const modo = { mode: 'readwrite' as const };
  if (!cartella.queryPermission) return 'granted';
  let permesso = await cartella.queryPermission(modo);
  if (permesso === 'prompt' && chiedi && cartella.requestPermission) permesso = await cartella.requestPermission(modo);
  return permesso;
}

/** Scrive il backup di oggi nella cartella e toglie i file più vecchi (ne tiene 30). */
export async function salvaInCartella(cartella: FileSystemDirectoryHandle, oggi = oggiIso()): Promise<void> {
  const testo = await testoBackup(await creaBackup());
  const file = await cartella.getFileHandle(nomeFileBackup(oggi), { create: true });
  const scrittura = await file.createWritable();
  await scrittura.write(testo);
  await scrittura.close();

  const nomi: string[] = [];
  for await (const voce of cartella.values()) if (voce.kind === 'file' && FILE_BACKUP.test(voce.name)) nomi.push(voce.name);
  nomi.sort().reverse();
  for (const vecchio of nomi.slice(FILE_DA_TENERE)) await cartella.removeEntry(vecchio);

  await aggiornaImpostazioni({ ultimoBackup: new Date().toISOString() });
}

export interface EsitoAutomatico {
  /** false se oggi era già fatto, se è disattivato o se non ci sono dati */
  fatto: boolean;
  /** cosa è successo con il file nella cartella */
  file?: 'scritto' | 'serve-permesso' | 'errore' | 'nessuna-cartella';
}

/**
 * Fa il backup automatico se oggi non è ancora stato fatto.
 * `cartella` serve ai test; di solito si usa quella salvata.
 */
export async function eseguiBackupAutomatico({
  oggi = oggiIso(),
  cartella,
}: { oggi?: string; cartella?: FileSystemDirectoryHandle | null } = {}): Promise<EsitoAutomatico> {
  const imp = await leggiImpostazioni();
  if (imp.backupAutomatico === false || imp.ultimoBackupAutomatico === oggi) return { fatto: false };
  if ((await db.persone.count()) === 0) return { fatto: false };

  // segna subito il giorno, così due schede aperte insieme non lo fanno due volte
  await aggiornaImpostazioni({ ultimoBackupAutomatico: oggi });
  await salvaCopiaSicurezza('Backup automatico', 'automatico');

  const dove = cartella === undefined ? await leggiCartella() : (cartella ?? undefined);
  if (!dove) return { fatto: true, file: 'nessuna-cartella' };
  try {
    if ((await permessoCartella(dove)) !== 'granted') return { fatto: true, file: 'serve-permesso' };
    await salvaInCartella(dove, oggi);
    return { fatto: true, file: 'scritto' };
  } catch {
    return { fatto: true, file: 'errore' };
  }
}
