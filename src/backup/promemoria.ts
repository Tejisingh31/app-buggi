import { differenceInCalendarDays } from 'date-fns';
import type { DataIso, MomentoIso } from '../db/tipi';
import { daIso } from '../utils/date';

/**
 * Quanti giorni sono passati dall'ultimo backup (null = mai fatto).
 */
export function giorniDallUltimoBackup(ultimoBackup: MomentoIso | undefined, oggi: DataIso): number | null {
  if (!ultimoBackup) return null;
  return differenceInCalendarDays(daIso(oggi), new Date(ultimoBackup));
}

/** true se bisogna ricordare di fare il backup: ci sono dati e l'ultimo backup è troppo vecchio (o manca). */
export function serveBackup(ultimoBackup: MomentoIso | undefined, ogniGiorni: number, oggi: DataIso, ciSonoDati: boolean): boolean {
  if (!ciSonoDati) return false;
  const giorni = giorniDallUltimoBackup(ultimoBackup, oggi);
  return giorni === null || giorni > ogniGiorni;
}
