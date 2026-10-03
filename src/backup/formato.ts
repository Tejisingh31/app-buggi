import type { Impostazioni, MomentoIso, Pagamento, Persona, Piano, Scadenza } from '../db/tipi';
import type { DatiCifrati } from './cifratura';

/**
 * Formato del file di backup .json.
 *
 * REGOLA: il campo "versione" va aumentato solo se il formato cambia in modo
 * non compatibile; in quel caso importJson.ts deve saper convertire anche i
 * backup con versioni precedenti (vedi `aggiornaFormato`).
 */
export const VERSIONE_BACKUP = 1;

/** Impostazioni che valgono solo per questo telefono: non vanno nel backup e il ripristino non le tocca (es. il PIN). */
export const CAMPI_SOLO_TELEFONO = [
  'id',
  'pinHash',
  'pinSale',
  'pinErrori',
  'pinBloccatoFino',
  'pinIterazioni',
  'pinProposto',
  'ultimoBackupAutomatico',
  'cartellaProposta',
] as const satisfies readonly (keyof Impostazioni)[];

/** Le impostazioni nel backup: senza PIN e senza ciò che riguarda solo questo telefono. */
export type ImpostazioniBackup = Omit<Impostazioni, (typeof CAMPI_SOLO_TELEFONO)[number]>;

/** Toglie dalle impostazioni i campi che valgono solo per questo telefono. */
export function senzaCampiTelefono(imp: Record<string, unknown>): Record<string, unknown> {
  const copia = { ...imp };
  for (const campo of CAMPI_SOLO_TELEFONO) delete copia[campo];
  return copia;
}

export interface DatiBackup {
  persone: Persona[];
  piani: Piano[];
  scadenze: Scadenza[];
  pagamenti: Pagamento[];
  impostazioni: Partial<ImpostazioniBackup>;
}

export interface FileBackup {
  app: 'Buggi';
  versione: number;
  creatoIl: MomentoIso;
  dati: DatiBackup;
}

/** Backup protetto da password: i dati sono cifrati. */
export interface FileBackupCifrato {
  app: 'Buggi';
  versione: number;
  creatoIl: MomentoIso;
  cifrato: DatiCifrati;
}

/** "pagamenti-backup-2026-10-03.json" */
export const nomeFileBackup = (oggi: string) => `pagamenti-backup-${oggi}.json`;
