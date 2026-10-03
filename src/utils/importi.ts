/**
 * Legge un importo scritto dall'utente e lo restituisce in centesimi.
 * Accetta "12", "12,5", "12,50", "1.234,50", "1234.50", "12 €". null se non valido.
 */
export function leggiImporto(testo: string): number | null {
  let t = testo.replace(/[\s€]/g, '');
  if (!t) return null;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const [interi, decimali = ''] = t.split('.');
  return Number(interi) * 100 + Number(decimali.padEnd(2, '0'));
}

/** Centesimi → testo per un campo di input: 123450 → "1234,50". */
export function importoPerInput(centesimi: number): string {
  return `${Math.floor(centesimi / 100)},${String(centesimi % 100).padStart(2, '0')}`;
}
