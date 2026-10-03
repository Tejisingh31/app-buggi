import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './database';
import * as repo from './repository';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

const pianoMensile = (personaId: string): repo.DatiPiano => ({
  personaId,
  descrizione: 'Quota mensile',
  importo: 5000,
  frequenza: 'mensile',
  dataInizio: '2026-01-01',
  giornoScadenza: 1,
});

describe('persone', () => {
  it('crea, modifica, archivia e ripristina', async () => {
    const p = await repo.creaPersona({ nome: '  Mario Rossi ', telefono: '333' });
    expect(p.nome).toBe('Mario Rossi');
    expect(p.attivo).toBe(true);

    await repo.aggiornaPersona(p.id, { categoria: 'squadra' });
    expect((await repo.leggiPersona(p.id))?.categoria).toBe('squadra');

    await repo.impostaPersonaAttiva(p.id, false);
    expect(await repo.elencoPersone()).toHaveLength(0);
    expect(await repo.elencoPersone({ inclusiArchiviati: true })).toHaveLength(1);

    await repo.impostaPersonaAttiva(p.id, true);
    expect(await repo.elencoPersone()).toHaveLength(1);
  });

  it('rifiuta il nome vuoto', async () => {
    await expect(repo.creaPersona({ nome: '   ' })).rejects.toThrow('nome');
  });

  it('ordina alfabeticamente ignorando maiuscole e accenti', async () => {
    await repo.creaPersona({ nome: 'zeno' });
    await repo.creaPersona({ nome: 'Èlia' });
    await repo.creaPersona({ nome: 'anna' });
    expect((await repo.elencoPersone()).map((p) => p.nome)).toEqual(['anna', 'Èlia', 'zeno']);
  });

  it('eliminando una persona sparisce anche tutto il suo storico', async () => {
    const p = await repo.creaPersona({ nome: 'Luca' });
    const altra = await repo.creaPersona({ nome: 'Sara' });
    const piano = await repo.creaPiano(pianoMensile(p.id));
    const [s] = await repo.aggiungiScadenze([{ pianoId: piano.id, personaId: p.id, dataScadenza: '2026-01-01', importoDovuto: 5000 }]);
    await repo.creaPagamento({ personaId: p.id, scadenzaId: s.id, dataPagamento: '2026-01-02', importo: 5000, metodo: 'contanti' });
    await repo.creaPagamento({ personaId: altra.id, dataPagamento: '2026-01-02', importo: 100, metodo: 'carta' });

    await repo.eliminaPersona(p.id);
    expect(await repo.conteggi()).toEqual({ persone: 1, piani: 0, scadenze: 0, pagamenti: 1 });
  });
});

describe('piani', () => {
  it('controlla importi in centesimi e campi della frequenza', async () => {
    const p = await repo.creaPersona({ nome: 'Luca' });
    await expect(repo.creaPiano({ ...pianoMensile(p.id), importo: 12.5 })).rejects.toThrow('centesimi');
    await expect(repo.creaPiano({ ...pianoMensile(p.id), giornoScadenza: 32 })).rejects.toThrow('Giorno');
    await expect(repo.creaPiano({ ...pianoMensile(p.id), frequenza: 'ogniNMesi' })).rejects.toThrow('mesi');
    await expect(repo.creaPiano({ ...pianoMensile(p.id), dataInizio: '2026-02-30' })).rejects.toThrow('data non valida');
    await expect(repo.creaPiano({ ...pianoMensile(p.id), dataFine: '2025-12-31' })).rejects.toThrow('fine');
    await expect(
      repo.creaPiano({ ...pianoMensile(p.id), frequenza: 'annuale', giornoScadenza: 10 }),
    ).rejects.toThrow('Mese');
    await expect(repo.creaPiano(pianoMensile('inesistente'))).rejects.toThrow('Persona');

    const piano = await repo.creaPiano({ ...pianoMensile(p.id), frequenza: 'annuale', giornoScadenza: 10, meseScadenza: 1 });
    await repo.aggiornaPiano(piano.id, { importo: 6000 });
    expect((await repo.leggiPiano(piano.id))?.importo).toBe(6000);
    await expect(repo.aggiornaPiano(piano.id, { meseScadenza: 13 })).rejects.toThrow('Mese');
  });

  it('eliminando un piano i pagamenti restano come acconti liberi', async () => {
    const p = await repo.creaPersona({ nome: 'Luca' });
    const piano = await repo.creaPiano(pianoMensile(p.id));
    const [s] = await repo.aggiungiScadenze([{ pianoId: piano.id, personaId: p.id, dataScadenza: '2026-01-01', importoDovuto: 5000 }]);
    const pag = await repo.creaPagamento({ personaId: p.id, scadenzaId: s.id, dataPagamento: '2026-01-02', importo: 2000, metodo: 'bonifico' });

    await repo.eliminaPiano(piano.id);
    const rimasto = await repo.leggiPagamento(pag.id);
    expect(rimasto?.importo).toBe(2000);
    expect(rimasto?.scadenzaId).toBeUndefined();
    expect(await repo.conteggi()).toMatchObject({ piani: 0, scadenze: 0, pagamenti: 1 });
  });
});

describe('scadenze', () => {
  it('non crea doppioni per lo stesso piano e la stessa data', async () => {
    const p = await repo.creaPersona({ nome: 'Luca' });
    const piano = await repo.creaPiano(pianoMensile(p.id));
    const base = { pianoId: piano.id, personaId: p.id, importoDovuto: 5000 };

    const prime = await repo.aggiungiScadenze([
      { ...base, dataScadenza: '2026-01-01' },
      { ...base, dataScadenza: '2026-02-01' },
      { ...base, dataScadenza: '2026-02-01' },
    ]);
    expect(prime).toHaveLength(2);

    const seconde = await repo.aggiungiScadenze([
      { ...base, dataScadenza: '2026-02-01' },
      { ...base, dataScadenza: '2026-03-01' },
    ]);
    expect(seconde).toHaveLength(1);
    expect((await repo.scadenzeDelPiano(piano.id)).map((s) => s.dataScadenza)).toEqual([
      '2026-01-01',
      '2026-02-01',
      '2026-03-01',
    ]);
  });

  it("si può cambiare l'importo di un singolo periodo", async () => {
    const p = await repo.creaPersona({ nome: 'Luca' });
    const piano = await repo.creaPiano(pianoMensile(p.id));
    const [s] = await repo.aggiungiScadenze([{ pianoId: piano.id, personaId: p.id, dataScadenza: '2026-01-01', importoDovuto: 5000 }]);
    await repo.aggiornaImportoDovuto(s.id, 2500);
    expect((await repo.leggiScadenza(s.id))?.importoDovuto).toBe(2500);
    await expect(repo.aggiornaImportoDovuto(s.id, -1)).rejects.toThrow('centesimi');
  });
});

describe('pagamenti', () => {
  it('registra pagamenti parziali e acconti liberi, dal più recente', async () => {
    const p = await repo.creaPersona({ nome: 'Luca' });
    const piano = await repo.creaPiano(pianoMensile(p.id));
    const [s] = await repo.aggiungiScadenze([{ pianoId: piano.id, personaId: p.id, dataScadenza: '2026-01-01', importoDovuto: 5000 }]);

    await repo.creaPagamento({ personaId: p.id, scadenzaId: s.id, dataPagamento: '2026-01-05', importo: 2000, metodo: 'contanti' });
    await repo.creaPagamento({ personaId: p.id, dataPagamento: '2026-01-20', importo: 1000, metodo: 'altro', nota: 'acconto' });

    expect(await repo.pagamentiDellaScadenza(s.id)).toHaveLength(1);
    expect((await repo.pagamentiDellaPersona(p.id)).map((x) => x.dataPagamento)).toEqual(['2026-01-20', '2026-01-05']);
  });

  it('rifiuta importi zero, decimali o scadenze di altre persone', async () => {
    const p = await repo.creaPersona({ nome: 'Luca' });
    const altra = await repo.creaPersona({ nome: 'Sara' });
    const piano = await repo.creaPiano(pianoMensile(altra.id));
    const [s] = await repo.aggiungiScadenze([{ pianoId: piano.id, personaId: altra.id, dataScadenza: '2026-01-01', importoDovuto: 5000 }]);
    const base = { personaId: p.id, dataPagamento: '2026-01-05', metodo: 'contanti' as const };

    await expect(repo.creaPagamento({ ...base, importo: 0 })).rejects.toThrow('maggiore di zero');
    await expect(repo.creaPagamento({ ...base, importo: 10.5 })).rejects.toThrow('centesimi');
    await expect(repo.creaPagamento({ ...base, importo: 100, scadenzaId: s.id })).rejects.toThrow('Scadenza');
  });
});

describe('impostazioni', () => {
  it('usa i valori predefiniti e salva le modifiche', async () => {
    expect(await repo.leggiImpostazioni()).toMatchObject({ valuta: '€', giorniTolleranza: 0, tema: 'sistema', nomeApp: 'Buggi' });
    await repo.aggiornaImpostazioni({ giorniTolleranza: 3, categorie: ['squadra'] });
    expect(await repo.leggiImpostazioni()).toMatchObject({ giorniTolleranza: 3, categorie: ['squadra'], valuta: '€' });
    await expect(repo.aggiornaImpostazioni({ giorniTolleranza: -1 })).rejects.toThrow('tolleranza');
  });
});

describe('generazione automatica delle scadenze', () => {
  it('crea le scadenze fino a oggi + 3 mesi, senza doppioni e solo per persone attive', async () => {
    const p = await repo.creaPersona({ nome: 'Luca' });
    const archiviata = await repo.creaPersona({ nome: 'Sara' });
    const piano = await repo.creaPiano({ ...pianoMensile(p.id), dataInizio: '2026-08-01' });
    await repo.creaPiano(pianoMensile(archiviata.id));
    await repo.impostaPersonaAttiva(archiviata.id, false);

    expect(await repo.sincronizzaScadenze('2026-09-10')).toBe(5);
    expect(await repo.sincronizzaScadenze('2026-09-10')).toBe(0);
    expect(await repo.sincronizzaScadenze('2026-10-10')).toBe(1);
    expect((await repo.scadenzeDelPiano(piano.id)).map((s) => s.dataScadenza)).toEqual([
      '2026-08-01',
      '2026-09-01',
      '2026-10-01',
      '2026-11-01',
      '2026-12-01',
      '2027-01-01',
    ]);
    expect((await repo.scadenzeDellaPersona(archiviata.id)).length).toBe(0);
  });
});

describe('modifica di un piano e scadenze', () => {
  async function prepara() {
    const p = await repo.creaPersona({ nome: 'Luca' });
    const piano = await repo.creaPiano({ ...pianoMensile(p.id), dataInizio: '2026-07-01' });
    await repo.sincronizzaScadenze('2026-09-10'); // lug → dic
    const scadenze = await repo.scadenzeDelPiano(piano.id);
    return { p, piano, scadenze };
  }
  const date = async (pianoId: string) => (await repo.scadenzeDelPiano(pianoId)).map((s) => `${s.dataScadenza}:${s.importoDovuto}`);

  it('una scadenza eliminata non viene ricreata', async () => {
    const { piano, scadenze } = await prepara();
    await repo.eliminaScadenza(scadenze[0].id);
    expect(await repo.sincronizzaScadenze('2026-09-20')).toBe(0);
    expect((await repo.scadenzeDelPiano(piano.id)).map((s) => s.dataScadenza)).not.toContain('2026-07-01');
  });

  it('nuovo importo: cambiano solo le scadenze future non pagate', async () => {
    const { p, piano, scadenze } = await prepara();
    const ottobre = scadenze.find((s) => s.dataScadenza === '2026-10-01')!;
    await repo.creaPagamento({ personaId: p.id, scadenzaId: ottobre.id, dataPagamento: '2026-09-15', importo: 5000, metodo: 'contanti' });

    await repo.aggiornaPiano(piano.id, { importo: 6000 }, '2026-09-15');
    expect(await date(piano.id)).toEqual([
      '2026-07-01:5000',
      '2026-08-01:5000',
      '2026-09-01:5000',
      '2026-10-01:5000', // già pagata: resta
      '2026-11-01:6000',
      '2026-12-01:6000',
    ]);
  });

  it('cambiando il giorno non vengono aggiunti periodi passati', async () => {
    const { piano } = await prepara();
    await repo.aggiornaPiano(piano.id, { giornoScadenza: 15 }, '2026-09-10');
    expect((await repo.scadenzeDelPiano(piano.id)).map((s) => s.dataScadenza)).toEqual([
      '2026-07-01',
      '2026-08-01',
      '2026-09-01',
      '2026-09-15',
      '2026-10-15',
      '2026-11-15',
    ]);
  });

  it('spostando la data di inizio in avanti si tolgono le scadenze passate non pagate', async () => {
    const { piano } = await prepara();
    await repo.aggiornaPiano(piano.id, { dataInizio: '2026-09-01' }, '2026-09-10');
    expect((await repo.scadenzeDelPiano(piano.id)).map((s) => s.dataScadenza)).toEqual([
      '2026-09-01',
      '2026-10-01',
      '2026-11-01',
      '2026-12-01',
    ]);
  });
});
