import { db } from '../db/database';
import { leggiImpostazioni } from '../db/repository';
import { cifra } from './cifratura';
import { VERSIONE_BACKUP, type DatiBackup, type FileBackup, type FileBackupCifrato } from './formato';

/** Legge tutti i dati dell'app e prepara il backup (senza il PIN). */
export async function creaBackup(): Promise<FileBackup> {
  const [persone, piani, scadenze, pagamenti, impostazioni] = await db.transaction(
    'r',
    [db.persone, db.piani, db.scadenze, db.pagamenti, db.impostazioni],
    () => Promise.all([db.persone.toArray(), db.piani.toArray(), db.scadenze.toArray(), db.pagamenti.toArray(), leggiImpostazioni()]),
  );
  const { id, pinHash, pinSale, pinErrori, pinBloccatoFino, pinIterazioni, pinProposto, ...restoImpostazioni } = impostazioni;
  const dati: DatiBackup = { persone, piani, scadenze, pagamenti, impostazioni: restoImpostazioni };
  return { app: 'Buggi', versione: VERSIONE_BACKUP, creatoIl: new Date().toISOString(), dati };
}

/** Il testo del file .json; con una password i dati vengono cifrati. */
export async function testoBackup(backup: FileBackup, password?: string): Promise<string> {
  if (!password) return JSON.stringify(backup, null, 1);
  const cifrato: FileBackupCifrato = {
    app: backup.app,
    versione: backup.versione,
    creatoIl: backup.creatoIl,
    cifrato: await cifra(JSON.stringify(backup.dati), password),
  };
  return JSON.stringify(cifrato, null, 1);
}
