import { format } from 'date-fns';
import type { DataIso } from '../db/tipi';

/** "2026-11-20" → Date a mezzanotte ora locale (mai UTC, così non si sposta di un giorno). */
export function daIso(data: DataIso): Date {
  const [a, m, g] = data.split('-').map(Number);
  return new Date(a, m - 1, g);
}

/** Date → "2026-11-20" (ora locale). */
export function aIso(data: Date): DataIso {
  return format(data, 'yyyy-MM-dd');
}

/** La data di oggi come "AAAA-MM-GG". */
export function oggiIso(): DataIso {
  return aIso(new Date());
}
