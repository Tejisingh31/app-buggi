import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import type { DatiBackup } from './formato';
import { creaExcel } from './exportExcel';

const dati: DatiBackup = {
  persone: [{ id: 'u1', nome: 'Nicolò Rossi', telefono: '333', categoria: 'Squadra', attivo: true, creatoIl: '', modificatoIl: '' }],
  piani: [
    { id: 'p1', personaId: 'u1', descrizione: 'Quota', importo: 123450, frequenza: 'mensile', giornoScadenza: 1, dataInizio: '2026-09-01', creatoIl: '', modificatoIl: '' },
  ],
  scadenze: [
    { id: 's1', pianoId: 'p1', personaId: 'u1', dataScadenza: '2026-09-01', importoDovuto: 123450 },
    { id: 's2', pianoId: 'p1', personaId: 'u1', dataScadenza: '2026-10-01', importoDovuto: 123450 },
  ],
  pagamenti: [{ id: 'g1', personaId: 'u1', scadenzaId: 's1', dataPagamento: '2026-09-03', importo: 123450, metodo: 'bonifico', nota: 'ok', creatoIl: '' }],
  impostazioni: {},
};

describe('export Excel', () => {
  it('crea i 5 fogli con importi in euro e date vere', async () => {
    const file = await creaExcel(dati, '2026-10-10', 0);
    const wb = XLSX.read(file, { cellDates: true, cellNF: true });
    expect(wb.SheetNames).toEqual(['Persone', 'Quote', 'Scadenze', 'Pagamenti', 'Riepilogo']);

    const persone = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets.Persone);
    expect(persone[0]).toMatchObject({ Nome: 'Nicolò Rossi', Stato: 'In ritardo', 'Pagato totale': 1234.5, 'In ritardo': 1234.5 });

    const scadenze = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets.Scadenze);
    expect(scadenze.map((s) => s.Stato)).toEqual(['Pagata', 'In ritardo']);
    expect(scadenze[1]['Giorni di ritardo']).toBe(9);

    const pag = wb.Sheets.Pagamenti;
    expect(pag.C2.v).toBe(1234.5);
    expect(pag.C2.z).toContain('#,##0.00');
    expect(pag.A2.t).toBe('d');
    expect(pag.D2.v).toBe('Bonifico');

    expect(XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets.Quote)[0]).toMatchObject({ Quando: 'Ogni mese il giorno 1' });
    const riepilogo = XLSX.utils.sheet_to_json<{ Voce: string; Valore: unknown }>(wb.Sheets.Riepilogo);
    expect(riepilogo.find((r) => r.Voce === 'Persone in ritardo')?.Valore).toBe(1);
  });
});
