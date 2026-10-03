import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/database';
import { creaPersona, elencoPersone, leggiImpostazioni } from '../db/repository';
import { creaBackup, testoBackup } from '../backup/exportJson';
import { creaHashPin, impostaPin, pinCorretto, pinValido, provaPin, reimpostaApp, rimuoviPin, secondiDiAttesa } from './pin';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('PIN', () => {
  it('accetta solo 4–6 cifre', () => {
    expect(['1234', '123456'].every(pinValido)).toBe(true);
    expect(['123', '1234567', '12a4', ' 1234', ''].some(pinValido)).toBe(false);
  });

  it('salva solo un hash con sale casuale, mai il PIN in chiaro', async () => {
    const a = await creaHashPin('1234', 1000);
    const b = await creaHashPin('1234', 1000);
    expect(a.hash).not.toContain('1234');
    expect(a.hash).not.toBe(b.hash); // sale diverso → hash diverso
    expect(await pinCorretto('1234', a.hash, a.sale, 1000)).toBe(true);
    expect(await pinCorretto('1235', a.hash, a.sale, 1000)).toBe(false);
  });

  it('attese dopo gli errori: 30 secondi al 5°, poi crescenti', () => {
    expect([1, 2, 3, 4].map(secondiDiAttesa)).toEqual([0, 0, 0, 0]);
    expect([5, 6, 7, 8].map(secondiDiAttesa)).toEqual([30, 60, 120, 240]);
    expect(secondiDiAttesa(30)).toBe(3600);
  });

  it('nel database: imposta, sbaglia 5 volte → attesa, poi sblocca e azzera', async () => {
    await impostaPin('2468');
    const imp = await leggiImpostazioni();
    expect(imp.pinHash).toBeTruthy();
    expect(JSON.stringify(imp)).not.toContain('2468');

    const t0 = new Date('2026-10-03T10:00:00Z');
    for (let i = 1; i <= 4; i++) expect(await provaPin('0000', t0)).toEqual({ ok: false, errori: i, attesaFino: undefined });
    const quinto = await provaPin('0000', t0);
    expect(quinto).toMatchObject({ ok: false, errori: 5, attesaFino: '2026-10-03T10:00:30.000Z' });

    // durante l'attesa anche il PIN giusto non passa
    expect(await provaPin('2468', new Date('2026-10-03T10:00:10Z'))).toMatchObject({ ok: false });
    // dopo l'attesa sì, e gli errori si azzerano
    expect(await provaPin('2468', new Date('2026-10-03T10:00:31Z'))).toEqual({ ok: true });
    expect((await leggiImpostazioni()).pinErrori).toBe(0);
  });

  it('il PIN non finisce nel backup', async () => {
    await impostaPin('2468');
    const testo = await testoBackup(await creaBackup());
    const imp = await leggiImpostazioni();
    expect(testo).not.toContain(imp.pinHash!);
    expect(testo).not.toContain(imp.pinSale!);
  });

  it('togliere il PIN', async () => {
    await impostaPin('2468');
    await rimuoviPin();
    expect((await leggiImpostazioni()).pinHash).toBeUndefined();
    expect(await provaPin('9999')).toEqual({ ok: true });
  });

  it('"Reimposta app" cancella tutti i dati', async () => {
    await creaPersona({ nome: 'Anna' });
    await impostaPin('2468');
    await reimpostaApp();
    await db.open();
    expect(await elencoPersone({ inclusiArchiviati: true })).toHaveLength(0);
    expect((await leggiImpostazioni()).pinHash).toBeUndefined();
  });
});
