import { describe, expect, it } from 'vitest';
import type { Pagamento, Scadenza } from '../db/tipi';
import { ripartisciPagamenti, statoPersona, statoScadenza } from './stato';

const scad = (id: string, dataScadenza: string, importoDovuto = 5000): Scadenza => ({
  id,
  pianoId: 'p1',
  personaId: 'u1',
  dataScadenza,
  importoDovuto,
});

let n = 0;
const pag = (importo: number, scadenzaId?: string, dataPagamento = '2026-01-05'): Pagamento => ({
  id: `pag${++n}`,
  personaId: 'u1',
  scadenzaId,
  dataPagamento,
  importo,
  metodo: 'contanti',
  creatoIl: '',
});

describe('stato di una scadenza', () => {
  const s = scad('s1', '2026-01-10');

  it('pagata se ricevuto ≥ dovuto', () => {
    expect(statoScadenza(s, 5000, '2026-03-01', 0)).toMatchObject({ stato: 'pagata', residuo: 0, giorniRitardo: 0 });
  });

  it('in attesa prima della scadenza e il giorno stesso', () => {
    expect(statoScadenza(s, 0, '2026-01-05', 0).stato).toBe('inAttesa');
    expect(statoScadenza(s, 0, '2026-01-10', 0).stato).toBe('inAttesa');
  });

  it('parziale se ricevuto qualcosa ma non tutto', () => {
    expect(statoScadenza(s, 2000, '2026-01-08', 0)).toMatchObject({ stato: 'parziale', parziale: true, residuo: 3000 });
  });

  it('in ritardo dal giorno dopo, anche se parziale', () => {
    expect(statoScadenza(s, 0, '2026-01-11', 0)).toMatchObject({ stato: 'inRitardo', giorniRitardo: 1, residuo: 5000 });
    expect(statoScadenza(s, 2000, '2026-01-20', 0)).toMatchObject({
      stato: 'inRitardo',
      parziale: true,
      giorniRitardo: 10,
      residuo: 3000,
    });
  });

  it('rispetta i giorni di tolleranza; i giorni di ritardo contano dalla scadenza', () => {
    expect(statoScadenza(s, 0, '2026-01-13', 3).stato).toBe('inAttesa');
    expect(statoScadenza(s, 0, '2026-01-14', 3)).toMatchObject({ stato: 'inRitardo', giorniRitardo: 4 });
  });

  it('conta i giorni giusti a cavallo di febbraio, bisestile e non', () => {
    expect(statoScadenza(scad('a', '2028-02-28'), 0, '2028-03-01', 0).giorniRitardo).toBe(2);
    expect(statoScadenza(scad('b', '2027-02-28'), 0, '2027-03-01', 0).giorniRitardo).toBe(1);
    expect(statoScadenza(scad('c', '2026-12-31'), 0, '2027-01-01', 0).giorniRitardo).toBe(1);
  });

  it('una scadenza da 0 € è sempre pagata', () => {
    expect(statoScadenza(scad('z', '2026-01-01', 0), 0, '2026-05-01', 0).stato).toBe('pagata');
  });
});

describe('ripartizione dei pagamenti', () => {
  it('somma più pagamenti parziali sulla stessa scadenza', () => {
    const r = ripartisciPagamenti([scad('s1', '2026-01-10')], [pag(2000, 's1'), pag(1500, 's1')]);
    expect(r.pagatoPerScadenza.get('s1')).toBe(3500);
    expect(r.credito).toBe(0);
  });

  it('gli acconti liberi coprono le scadenze dalla più vecchia', () => {
    const scadenze = [scad('feb', '2026-02-10'), scad('gen', '2026-01-10'), scad('mar', '2026-03-10')];
    const r = ripartisciPagamenti(scadenze, [pag(7000)]);
    expect(r.pagatoPerScadenza.get('gen')).toBe(5000);
    expect(r.pagatoPerScadenza.get('feb')).toBe(2000);
    expect(r.pagatoPerScadenza.get('mar')).toBe(0);
  });

  it('chi paga di più su una scadenza copre le successive; il resto è credito', () => {
    const scadenze = [scad('gen', '2026-01-10'), scad('feb', '2026-02-10')];
    const r = ripartisciPagamenti(scadenze, [pag(12000, 'gen')]);
    expect(r.pagatoPerScadenza.get('gen')).toBe(5000);
    expect(r.pagatoPerScadenza.get('feb')).toBe(5000);
    expect(r.credito).toBe(2000);
  });

  it('i pagamenti collegati hanno la precedenza sugli acconti liberi', () => {
    const scadenze = [scad('gen', '2026-01-10'), scad('feb', '2026-02-10')];
    const r = ripartisciPagamenti(scadenze, [pag(3000), pag(5000, 'feb')]);
    expect(r.pagatoPerScadenza.get('feb')).toBe(5000);
    expect(r.pagatoPerScadenza.get('gen')).toBe(3000);
  });
});

describe('stato di una persona', () => {
  const scadenze = [scad('gen', '2026-01-10'), scad('feb', '2026-02-10'), scad('mar', '2026-03-10'), scad('apr', '2026-04-10')];

  it('rossa con importo e giorni di ritardo', () => {
    const s = statoPersona(scadenze, [pag(5000, 'gen'), pag(1000, 'feb')], '2026-03-15', 0);
    expect(s).toMatchObject({
      colore: 'rosso',
      dovutoFinoAOggi: 15000,
      totalePagato: 6000,
      daPagareOra: 9000,
      importoInRitardo: 9000,
      scadenzeInRitardo: 2,
      maxGiorniRitardo: 33,
      credito: 0,
    });
    expect(s.prossimaScadenza?.scadenza.id).toBe('apr');
    expect(s.scadenze.map((c) => c.stato)).toEqual(['pagata', 'inRitardo', 'inRitardo', 'inAttesa']);
  });

  it('gialla se scaduta ma ancora entro la tolleranza, o con un parziale', () => {
    const pagamenti = [pag(5000, 'gen'), pag(5000, 'feb')];
    expect(statoPersona(scadenze, pagamenti, '2026-03-12', 5).colore).toBe('giallo');
    expect(statoPersona(scadenze, [...pagamenti, pag(5000, 'mar'), pag(100, 'apr')], '2026-03-12', 0).colore).toBe('giallo');
  });

  it('verde se tutto il dovuto fino a oggi è pagato', () => {
    const s = statoPersona(scadenze, [pag(10000)], '2026-02-20', 0);
    expect(s).toMatchObject({ colore: 'verde', daPagareOra: 0, importoInRitardo: 0 });
  });

  it('verde anche senza scadenze', () => {
    expect(statoPersona([], [], '2026-02-20', 0)).toMatchObject({ colore: 'verde', totalePagato: 0 });
  });
});
