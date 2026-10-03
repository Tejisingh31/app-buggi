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

/** Le impostazioni nel backup: senza PIN (ogni telefono ha il suo). */
export type ImpostazioniBackup = Omit<Impostazioni, 'id' | 'pinHash' | 'pinSale' | 'pinErrori' | 'pinBloccatoFino' | 'pinIterazioni' | 'pinProposto'>;

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
