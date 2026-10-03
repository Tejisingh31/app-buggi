import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import { BuggiDB } from './database';

describe('migrazione del database', () => {
  it('dalla versione 1 alla 2 conserva i dati e imposta generatoFino', async () => {
    const nome = 'test-migrazione';
    const v1 = new Dexie(nome);
    v1.version(1).stores({
      persone: 'id, nome, categoria',
      piani: 'id, personaId',
      scadenze: 'id, pianoId, personaId, dataScadenza, [pianoId+dataScadenza]',
      pagamenti: 'id, personaId, scadenzaId, dataPagamento',
      impostazioni: 'id',
    });
    await v1.table('persone').add({ id: 'u1', nome: 'Luca', attivo: true, creatoIl: '', modificatoIl: '' });
    await v1.table('piani').bulkAdd([
      { id: 'p1', personaId: 'u1', descrizione: 'Quota', importo: 5000, frequenza: 'mensile', dataInizio: '2026-01-01', giornoScadenza: 1 },
      { id: 'p2', personaId: 'u1', descrizione: 'Nuova', importo: 100, frequenza: 'singola', dataInizio: '2026-05-01' },
    ]);
    await v1.table('scadenze').bulkAdd([
      { id: 's1', pianoId: 'p1', personaId: 'u1', dataScadenza: '2026-01-01', importoDovuto: 5000 },
      { id: 's2', pianoId: 'p1', personaId: 'u1', dataScadenza: '2026-03-01', importoDovuto: 5000 },
      { id: 's3', pianoId: 'p1', personaId: 'u1', dataScadenza: '2026-02-01', importoDovuto: 5000 },
    ]);
    await v1.table('pagamenti').add({ id: 'g1', personaId: 'u1', scadenzaId: 's1', dataPagamento: '2026-01-02', importo: 5000, metodo: 'contanti', creatoIl: '' });
    v1.close();

    const db = new BuggiDB(nome);
    await db.open();
    expect(db.verno).toBe(4);
    expect((await db.piani.get('p1'))?.generatoFino).toBe('2026-03-01');
    expect((await db.piani.get('p2'))?.generatoFino).toBeUndefined();
    expect(await db.persone.count()).toBe(1);
    expect(await db.scadenze.count()).toBe(3);
    expect(await db.pagamenti.count()).toBe(1);
    db.close();
  });
});
