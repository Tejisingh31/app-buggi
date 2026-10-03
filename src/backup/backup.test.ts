import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/database';
import * as repo from '../db/repository';
import { cifra, decifra, PasswordSbagliata } from './cifratura';
import { creaBackup, testoBackup } from './exportJson';
import { anteprima, elencoCopie, leggiBackup, PasswordNecessaria, richiedePassword, ripristina, ripristinaCopia } from './importJson';
import { VERSIONE_BACKUP } from './formato';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

/** Una persona con quota mensile, 2 scadenze e 1 pagamento. */
async function datiDiProva(nome = 'Luca') {
  const p = await repo.creaPersona({ nome, telefono: '333' });
  const piano = await repo.creaPiano({
    personaId: p.id,
    descrizione: 'Quota',
    importo: 5000,
    frequenza: 'mensile',
    dataInizio: '2026-08-01',
    giornoScadenza: 1,
  });
  await repo.sincronizzaScadenze('2026-08-15'); // ago → nov
  const [s] = await repo.scadenzeDelPiano(piano.id);
  await repo.creaPagamento({ personaId: p.id, scadenzaId: s.id, dataPagamento: '2026-08-02', importo: 5000, metodo: 'contanti' });
  return { p, piano };
}

describe('cifratura', () => {
  it('cifra e decifra; con la password sbagliata dà errore', async () => {
    const c = await cifra('ciao Buggi è', 'segreta', 1000);
    expect(c.dati).not.toContain('ciao');
    expect(await decifra(c, 'segreta')).toBe('ciao Buggi è');
    await expect(decifra(c, 'altra')).rejects.toBeInstanceOf(PasswordSbagliata);
  });
});

describe('backup JSON', () => {
  it('contiene versione e tutti i dati, ma non il PIN', async () => {
    await datiDiProva();
    await repo.aggiornaImpostazioni({ pinHash: 'HASH', pinSale: 'SALE', giorniTolleranza: 3, categorie: ['Squadra'] });
    const b = await creaBackup();
    expect(b.app).toBe('Buggi');
    expect(b.versione).toBe(VERSIONE_BACKUP);
    expect(b.dati.persone).toHaveLength(1);
    expect(b.dati.scadenze).toHaveLength(4);
    expect(b.dati.impostazioni).toMatchObject({ giorniTolleranza: 3, categorie: ['Squadra'] });
    const testo = await testoBackup(b);
    expect(testo).not.toContain('HASH');
    expect(testo).not.toContain('SALE');
  });

  it('esporta e reimporta identico (anche cifrato)', async () => {
    await datiDiProva();
    const b = await creaBackup();
    const letto = await leggiBackup(await testoBackup(b));
    expect(letto.dati).toEqual(b.dati);

    const protetto = await testoBackup(b, 'pw');
    expect(protetto).not.toContain('Luca');
    expect(richiedePassword(protetto)).toBe(true);
    await expect(leggiBackup(protetto)).rejects.toBeInstanceOf(PasswordNecessaria);
    await expect(leggiBackup(protetto, 'no')).rejects.toBeInstanceOf(PasswordSbagliata);
    expect((await leggiBackup(protetto, 'pw')).dati).toEqual(b.dati);
  });

  it('rifiuta file non validi con messaggi chiari', async () => {
    await expect(leggiBackup('ciao')).rejects.toThrow('non è un backup valido');
    await expect(leggiBackup('{"a":1}')).rejects.toThrow('non è un backup di Buggi');
    await expect(leggiBackup(JSON.stringify({ app: 'Buggi', versione: VERSIONE_BACKUP + 1, dati: {} }))).rejects.toThrow('più nuova');
    const rotto = { app: 'Buggi', versione: 1, dati: { persone: [{ id: 'x', nome: 'A', attivo: true }], piani: [], scadenze: [], pagamenti: [{ id: 'p', personaId: 'x', dataPagamento: '2026-01-01', importo: 12.5, metodo: 'carta' }] } };
    await expect(leggiBackup(JSON.stringify(rotto))).rejects.toThrow('"pagamenti" n. 1 danneggiato');
  });

  it('legge i backup della versione 1 (compatibilità con i backup vecchi)', async () => {
    const v1 = {
      app: 'Buggi',
      versione: 1,
      creatoIl: '2026-10-01T10:00:00.000Z',
      dati: {
        persone: [{ id: 'u1', nome: 'Anna', attivo: true, creatoIl: '', modificatoIl: '' }],
        piani: [],
        scadenze: [],
        pagamenti: [{ id: 'g1', personaId: 'u1', dataPagamento: '2026-09-01', importo: 1000, metodo: 'contanti', creatoIl: '' }],
        impostazioni: { valuta: '€', pinHash: 'non deve passare' },
      },
    };
    const letto = await leggiBackup(JSON.stringify(v1));
    expect(anteprima(letto.dati)).toMatchObject({ persone: 1, pagamenti: 1, totalePagamenti: 1000, ultimoPagamento: '2026-09-01' });
    expect(letto.dati.impostazioni).not.toHaveProperty('pinHash');
  });
});

describe('ripristino', () => {
  it('sostituisci: carica il backup, salva una copia di sicurezza e mantiene il PIN del telefono', async () => {
    await datiDiProva('Luca');
    const backupLuca = await creaBackup();
    await db.delete();
    await db.open();
    await datiDiProva('Sara');
    await repo.aggiornaImpostazioni({ pinHash: 'PIN-DI-QUESTO-TELEFONO' });

    await ripristina(backupLuca.dati, 'sostituisci');
    expect((await repo.elencoPersone()).map((p) => p.nome)).toEqual(['Luca']);
    expect((await repo.leggiImpostazioni()).pinHash).toBe('PIN-DI-QUESTO-TELEFONO');

    // la copia di sicurezza permette di tornare indietro
    const copie = await elencoCopie();
    expect(copie).toHaveLength(1);
    await ripristinaCopia(copie[0].id);
    expect((await repo.elencoPersone()).map((p) => p.nome)).toEqual(['Sara']);
  });

  it('unisci: aggiunge senza doppioni e tiene la versione più recente', async () => {
    const { p } = await datiDiProva('Luca');
    const backup = await creaBackup();
    // sul telefono: Luca rinominato dopo il backup + una persona nuova
    await new Promise((r) => setTimeout(r, 5));
    await repo.aggiornaPersona(p.id, { nome: 'Luca Rossi' });
    await repo.creaPersona({ nome: 'Sara' });

    await ripristina(backup.dati, 'unisci');
    expect((await repo.elencoPersone()).map((x) => x.nome)).toEqual(['Luca Rossi', 'Sara']);
    expect(await repo.conteggi()).toMatchObject({ persone: 2, piani: 1, pagamenti: 1 });
  });

  it('unisci: scadenze create su due telefoni per la stessa quota non si raddoppiano', async () => {
    const { p, piano } = await datiDiProva('Luca');
    const backup = await creaBackup();
    // l'altro telefono ha le stesse scadenze ma con id diversi, e un pagamento di settembre
    const altro = structuredClone(backup.dati);
    const settembre = altro.scadenze.find((s) => s.dataScadenza === '2026-09-01')!;
    altro.scadenze = altro.scadenze.map((s) => ({ ...s, id: 'altro-' + s.id }));
    altro.pagamenti = [
      ...altro.pagamenti,
      { id: 'pag-sett', personaId: p.id, scadenzaId: 'altro-' + settembre.id, dataPagamento: '2026-09-02', importo: 5000, metodo: 'carta', creatoIl: '' },
    ];

    await ripristina(altro, 'unisci');
    const date = (await repo.scadenzeDelPiano(piano.id)).map((s) => s.dataScadenza);
    expect(new Set(date).size).toBe(date.length); // nessuna data doppia
    expect(date.slice(0, 4)).toEqual(['2026-08-01', '2026-09-01', '2026-10-01', '2026-11-01']);
    expect((await repo.leggiPagamento('pag-sett'))?.scadenzaId).toBe(settembre.id);
  });
});
