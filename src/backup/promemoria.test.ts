import { describe, expect, it } from 'vitest';
import { giorniDallUltimoBackup, serveBackup } from './promemoria';

describe('promemoria backup', () => {
  it('conta i giorni dall’ultimo backup', () => {
    expect(giorniDallUltimoBackup(undefined, '2026-10-10')).toBeNull();
    expect(giorniDallUltimoBackup(new Date(2026, 9, 3, 23, 59).toISOString(), '2026-10-10')).toBe(7);
  });
  it('avvisa dopo più di 7 giorni o se non è mai stato fatto, solo se ci sono dati', () => {
    const fa = (g: number) => new Date(2026, 9, 10 - g, 12).toISOString();
    expect(serveBackup(undefined, 7, '2026-10-10', true)).toBe(true);
    expect(serveBackup(undefined, 7, '2026-10-10', false)).toBe(false);
    expect(serveBackup(fa(7), 7, '2026-10-10', true)).toBe(false);
    expect(serveBackup(fa(8), 7, '2026-10-10', true)).toBe(true);
  });
});
