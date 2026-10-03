import { describe, expect, it } from 'vitest';
import type { Piano } from '../db/tipi';
import { anteprimaScadenze, dateScadenzePiano, occorrenze, scadenzeMancanti, type RegolaScadenza } from './scadenze';

/** Le prime n date di una regola. */
function prime(regola: RegolaScadenza, n: number): string[] {
  const out: string[] = [];
  for (const d of occorrenze(regola)) {
    out.push(d);
    if (out.length === n) break;
  }
  return out;
}

describe('data singola', () => {
  it('genera solo quella data, anche se oltre i 3 mesi', () => {
    const r: RegolaScadenza = { frequenza: 'singola', dataInizio: '2027-11-20' };
    expect(dateScadenzePiano(r, '2026-10-03')).toEqual(['2027-11-20']);
  });
});

describe('mensile', () => {
  it('ogni 1 del mese fino a oggi + 3 mesi', () => {
    const r: RegolaScadenza = { frequenza: 'mensile', dataInizio: '2026-01-01', giornoScadenza: 1 };
    expect(dateScadenzePiano(r, '2026-03-10')).toEqual([
      '2026-01-01',
      '2026-02-01',
      '2026-03-01',
      '2026-04-01',
      '2026-05-01',
      '2026-06-01',
    ]);
  });

  it('il 31 nei mesi corti diventa l\'ultimo giorno del mese', () => {
    const r: RegolaScadenza = { frequenza: 'mensile', dataInizio: '2026-01-01', giornoScadenza: 31 };
    expect(prime(r, 5)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31']);
  });

  it('il 30 e il 29 a febbraio, anno normale e bisestile', () => {
    expect(prime({ frequenza: 'mensile', dataInizio: '2027-02-01', giornoScadenza: 30 }, 2)).toEqual([
      '2027-02-28',
      '2027-03-30',
    ]);
    expect(prime({ frequenza: 'mensile', dataInizio: '2028-02-01', giornoScadenza: 30 }, 2)).toEqual([
      '2028-02-29',
      '2028-03-30',
    ]);
    expect(prime({ frequenza: 'mensile', dataInizio: '2028-02-01', giornoScadenza: 29 }, 1)).toEqual(['2028-02-29']);
  });

  it('salta il giorno del primo mese se è prima della data di inizio', () => {
    const r: RegolaScadenza = { frequenza: 'mensile', dataInizio: '2026-01-20', giornoScadenza: 15 };
    expect(prime(r, 2)).toEqual(['2026-02-15', '2026-03-15']);
  });

  it('si ferma alla data di fine', () => {
    const r: RegolaScadenza = { frequenza: 'mensile', dataInizio: '2026-01-01', dataFine: '2026-03-01', giornoScadenza: 1 };
    expect(dateScadenzePiano(r, '2026-10-03')).toEqual(['2026-01-01', '2026-02-01', '2026-03-01']);
  });

  it('attraversa il cambio d\'anno', () => {
    const r: RegolaScadenza = { frequenza: 'mensile', dataInizio: '2026-11-01', giornoScadenza: 15 };
    expect(prime(r, 3)).toEqual(['2026-11-15', '2026-12-15', '2027-01-15']);
  });
});

describe('ogni N mesi', () => {
  it('ogni 3 mesi dal mese di inizio', () => {
    const r: RegolaScadenza = { frequenza: 'ogniNMesi', intervalloMesi: 3, dataInizio: '2026-01-10', giornoScadenza: 10 };
    expect(prime(r, 5)).toEqual(['2026-01-10', '2026-04-10', '2026-07-10', '2026-10-10', '2027-01-10']);
  });

  it('ogni 3 mesi con il 31 e i mesi corti', () => {
    const r: RegolaScadenza = { frequenza: 'ogniNMesi', intervalloMesi: 3, dataInizio: '2026-05-01', giornoScadenza: 31 };
    expect(prime(r, 4)).toEqual(['2026-05-31', '2026-08-31', '2026-11-30', '2027-02-28']);
  });
});

describe('settimanale', () => {
  it('ogni lunedì a partire dal primo lunedì dopo l\'inizio', () => {
    // 03/10/2026 è un sabato
    const r: RegolaScadenza = { frequenza: 'settimanale', dataInizio: '2026-10-03', giornoScadenza: 1 };
    expect(prime(r, 3)).toEqual(['2026-10-05', '2026-10-12', '2026-10-19']);
  });

  it('se l\'inizio è proprio quel giorno, conta anche lui', () => {
    const r: RegolaScadenza = { frequenza: 'settimanale', dataInizio: '2026-10-05', giornoScadenza: 1 };
    expect(prime(r, 2)).toEqual(['2026-10-05', '2026-10-12']);
  });

  it('attraversa febbraio bisestile', () => {
    // 22/02/2028 è un martedì
    const r: RegolaScadenza = { frequenza: 'settimanale', dataInizio: '2028-02-22', giornoScadenza: 2 };
    expect(prime(r, 3)).toEqual(['2028-02-22', '2028-02-29', '2028-03-07']);
  });
});

describe('annuale', () => {
  it('ogni anno il 10/01', () => {
    const r: RegolaScadenza = { frequenza: 'annuale', dataInizio: '2026-03-01', giornoScadenza: 10, meseScadenza: 1 };
    expect(prime(r, 3)).toEqual(['2027-01-10', '2028-01-10', '2029-01-10']);
  });

  it('il 29 febbraio negli anni non bisestili diventa il 28', () => {
    const r: RegolaScadenza = { frequenza: 'annuale', dataInizio: '2024-01-01', giornoScadenza: 29, meseScadenza: 2 };
    expect(prime(r, 5)).toEqual(['2024-02-29', '2025-02-28', '2026-02-28', '2027-02-28', '2028-02-29']);
  });
});

describe('anteprima', () => {
  it('mostra le prossime 3 scadenze da oggi', () => {
    const r: RegolaScadenza = { frequenza: 'mensile', dataInizio: '2026-01-01', giornoScadenza: 15 };
    expect(anteprimaScadenze(r, '2026-10-03')).toEqual(['2026-10-15', '2026-11-15', '2026-12-15']);
  });

  it('include oggi se è un giorno di scadenza; si ferma alla data di fine', () => {
    const r: RegolaScadenza = { frequenza: 'mensile', dataInizio: '2026-01-01', dataFine: '2026-11-30', giornoScadenza: 3 };
    expect(anteprimaScadenze(r, '2026-10-03')).toEqual(['2026-10-03', '2026-11-03']);
  });
});

describe('scadenze mancanti', () => {
  it('crea solo quelle non ancora in archivio, con l\'importo del piano', () => {
    const piano: Piano = {
      id: 'p1',
      personaId: 'u1',
      descrizione: 'Quota',
      importo: 5000,
      frequenza: 'mensile',
      dataInizio: '2026-08-01',
      giornoScadenza: 1,
      creatoIl: '',
      modificatoIl: '',
    };
    const esistente = { id: 's1', pianoId: 'p1', personaId: 'u1', dataScadenza: '2026-08-01', importoDovuto: 4000 };
    const nuove = scadenzeMancanti(piano, [esistente], '2026-09-10');
    expect(nuove.map((s) => s.dataScadenza)).toEqual(['2026-09-01', '2026-10-01', '2026-11-01', '2026-12-01']);
    expect(nuove.every((s) => s.importoDovuto === 5000 && s.personaId === 'u1')).toBe(true);
  });
});
