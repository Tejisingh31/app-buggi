import { describe, expect, it } from 'vitest';
import type { Pagamento, Persona, Scadenza } from '../db/tipi';
import {
  filtraMancanti,
  incassiUltimi12Mesi,
  mancanti,
  personeInRitardo,
  riepilogoGenerale,
  totaleResiduo,
  type DatiCompleti,
} from './statistiche';

const persona = (id: string, nome: string, attivo = true): Persona => ({
  id,
  nome,
  attivo,
  creatoIl: '',
  modificatoIl: '',
});
const scad = (id: string, personaId: string, dataScadenza: string, importoDovuto = 5000): Scadenza => ({
  id,
  pianoId: 'p-' + personaId,
  personaId,
  dataScadenza,
  importoDovuto,
});
const pag = (personaId: string, importo: number, dataPagamento: string, scadenzaId?: string): Pagamento => ({
  id: `${personaId}-${dataPagamento}-${importo}`,
  personaId,
  scadenzaId,
  dataPagamento,
  importo,
  metodo: 'contanti',
  creatoIl: '',
});

// oggi: sabato 10/10/2026
const OGGI = '2026-10-10';
const dati: DatiCompleti = {
  persone: [persona('anna', 'Anna'), persona('bruno', 'Bruno'), persona('carla', 'Carla'), persona('dino', 'Dino', false)],
  scadenze: [
    scad('a-set', 'anna', '2026-09-01'),
    scad('a-ott', 'anna', '2026-10-01'),
    scad('b-ott', 'bruno', '2026-10-01'),
    scad('b-ott2', 'bruno', '2026-10-11', 2000),
    scad('c-ott', 'carla', '2026-10-25'),
    scad('c-nov', 'carla', '2026-11-25'),
    scad('d-set', 'dino', '2026-09-01'), // archiviato: non conta
  ],
  pagamenti: [
    pag('anna', 2000, '2026-09-05', 'a-set'),
    pag('bruno', 5000, '2026-10-02', 'b-ott'),
    pag('carla', 1000, '2026-10-03', 'c-ott'),
    pag('dino', 700, '2026-10-04'),
    pag('anna', 3000, '2025-10-15'), // fuori dai 12 mesi
  ],
};

describe('riepilogo generale', () => {
  it('conta chi non ha pagato e quanto, escludendo gli archiviati', () => {
    // anna: set residuo 0 (acconto vecchio 3000 copre set) + ott 5000 → in ritardo 5000
    expect(riepilogoGenerale(dati, OGGI, 0)).toEqual({
      personeInRitardo: 1,
      importoInRitardo: 5000,
      incassatoMese: 6000,
      daIncassareMese: 2000 + 4000,
    });
  });

  it('con la tolleranza nessuno è ancora in ritardo per ottobre', () => {
    expect(riepilogoGenerale(dati, OGGI, 10)).toMatchObject({ personeInRitardo: 0, importoInRitardo: 0, daIncassareMese: 11000 });
  });
});

describe('incassi ultimi 12 mesi', () => {
  it('12 mesi dal più vecchio, con etichette in italiano', () => {
    const mesi = incassiUltimi12Mesi(dati.pagamenti, OGGI);
    expect(mesi).toHaveLength(12);
    expect(mesi[0]).toMatchObject({ mese: '2025-11', etichetta: 'nov 25', totale: 0 });
    expect(mesi[10]).toMatchObject({ mese: '2026-09', totale: 2000 });
    expect(mesi[11]).toMatchObject({ mese: '2026-10', etichetta: 'ott 26', totale: 6700 });
  });

  it('funziona anche a fine anno e con mesi corti', () => {
    const mesi = incassiUltimi12Mesi([], '2028-03-31');
    expect(mesi.map((m) => m.mese)).toEqual([
      '2027-04', '2027-05', '2027-06', '2027-07', '2027-08', '2027-09',
      '2027-10', '2027-11', '2027-12', '2028-01', '2028-02', '2028-03',
    ]);
  });
});

describe('mancanti', () => {
  it('raggruppa in ritardo, questa settimana e prossime', () => {
    const g = mancanti(dati, OGGI, 0);
    expect(g.inRitardo.map((v) => v.scadenza.id)).toEqual(['a-ott']);
    expect(g.questaSettimana.map((v) => v.scadenza.id)).toEqual(['b-ott2']);
    expect(g.prossime.map((v) => v.scadenza.id)).toEqual(['c-ott', 'c-nov']);
    expect(g.prossime[0]).toMatchObject({ residuo: 4000, parziale: true, persona: { nome: 'Carla' } });
    expect(totaleResiduo(g.prossime)).toBe(9000);
  });

  it('le scadenze entro la tolleranza vanno in "questa settimana"', () => {
    const g = mancanti(dati, OGGI, 10);
    expect(g.inRitardo).toHaveLength(0);
    expect(g.questaSettimana.map((v) => v.scadenza.id)).toEqual(['a-ott', 'b-ott2']);
  });
});

describe('persone in ritardo', () => {
  it('solo attive con ritardi, dal debito più alto', () => {
    const conDue: DatiCompleti = {
      ...dati,
      scadenze: [...dati.scadenze, scad('c-set', 'carla', '2026-09-15', 9000)],
    };
    const elenco = personeInRitardo(conDue, OGGI, 0);
    expect(elenco.map((x) => [x.persona.nome, x.stato.importoInRitardo])).toEqual([
      ['Carla', 9000],
      ['Anna', 5000],
    ]);
  });
});

describe('filtri dei mancanti', () => {
  it('per categoria e per mese', () => {
    const conCategorie: DatiCompleti = {
      ...dati,
      persone: dati.persone.map((p) => (p.id === 'carla' ? { ...p, categoria: 'Corso' } : p)),
    };
    const g = mancanti(conCategorie, OGGI, 0);
    const perCorso = filtraMancanti(g, { categoria: 'Corso', mese: '' });
    expect([...perCorso.inRitardo, ...perCorso.questaSettimana, ...perCorso.prossime].map((v) => v.scadenza.id)).toEqual([
      'c-ott',
      'c-nov',
    ]);
    const novembre = filtraMancanti(g, { categoria: '', mese: '2026-11' });
    expect(novembre.prossime.map((v) => v.scadenza.id)).toEqual(['c-nov']);
    expect(novembre.inRitardo).toHaveLength(0);
  });
});
