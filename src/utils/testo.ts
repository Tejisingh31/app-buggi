/** Minuscolo e senza accenti: "Nicolò" → "nicolo". */
export function normalizza(testo: string): string {
  return testo.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

/**
 * true se tutte le parole cercate compaiono in almeno uno dei campi.
 * Ignora maiuscole e accenti; per i numeri di telefono ignora spazi e trattini.
 */
export function corrisponde(cerca: string, campi: (string | undefined)[]): boolean {
  const parole = normalizza(cerca).split(/\s+/).filter(Boolean);
  if (parole.length === 0) return true;
  const testo = campi
    .filter((c): c is string => !!c)
    .flatMap((c) => [normalizza(c), c.replace(/\D/g, '')])
    .join(' ');
  return parole.every((p) => testo.includes(p));
}
