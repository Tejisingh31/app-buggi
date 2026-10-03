import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/database';
import * as repo from '../db/repository';
import { eseguiBackupAutomatico } from './automatico';
import { elencoCopie, salvaCopiaSicurezza } from './importJson';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

/** Cartella finta: tiene i file in memoria. */
function cartellaFinta(permesso: PermissionState = 'granted', fileIniziali: string[] = []) {
  const file = new Map<string, string>(fileIniziali.map((n) => [n, '{}']));
  const cartella = {
    kind: 'directory',
    name: 'Buggi backup',
    queryPermission: async () => permesso,
    getFileHandle: async (nome: string) => ({
      createWritable: async () => {
        let testo = '';
        return {
          write: async (t: string) => {
            testo += t;
          },
          close: async () => {
            file.set(nome, testo);
          },
        };
      },
    }),
    async *values() {
      for (const name of [...file.keys()]) yield { kind: 'file', name };
    },
    removeEntry: async (nome: string) => {
      file.delete(nome);
    },
  };
  return { cartella: cartella as unknown as FileSystemDirectoryHandle, file };
}

describe('backup automatico', () => {
  it('senza dati non fa niente', async () => {
    expect(await eseguiBackupAutomatico({ oggi: '2026-10-03', cartella: null })).toEqual({ fatto: false });
  });

  it('una volta al giorno: copia nell’app e file nella cartella', async () => {
    await repo.creaPersona({ nome: 'Anna' });
    const { cartella, file } = cartellaFinta();

    expect(await eseguiBackupAutomatico({ oggi: '2026-10-03', cartella })).toEqual({ fatto: true, file: 'scritto' });
    expect([...file.keys()]).toEqual(['pagamenti-backup-2026-10-03.json']);
    expect(JSON.parse(file.get('pagamenti-backup-2026-10-03.json')!).dati.persone[0].nome).toBe('Anna');
    expect((await elencoCopie()).map((c) => c.tipo)).toEqual(['automatico']);
    expect((await repo.leggiImpostazioni()).ultimoBackup).toBeTruthy(); // il promemoria non serve più

    // stesso giorno: niente
    expect(await eseguiBackupAutomatico({ oggi: '2026-10-03', cartella })).toEqual({ fatto: false });
    // giorno dopo: di nuovo
    expect(await eseguiBackupAutomatico({ oggi: '2026-10-04', cartella })).toEqual({ fatto: true, file: 'scritto' });
    expect(file.size).toBe(2);
  });

  it('tiene 7 copie automatiche senza toccare le copie di sicurezza', async () => {
    await repo.creaPersona({ nome: 'Anna' });
    await salvaCopiaSicurezza('Prima di un ripristino');
    for (let g = 1; g <= 9; g++) await eseguiBackupAutomatico({ oggi: `2026-10-0${g}`, cartella: null });
    const copie = await elencoCopie();
    expect(copie.filter((c) => c.tipo === 'automatico')).toHaveLength(7);
    expect(copie.filter((c) => c.tipo !== 'automatico')).toHaveLength(1);
  });

  it('nella cartella tiene gli ultimi 30 file e non tocca gli altri', async () => {
    await repo.creaPersona({ nome: 'Anna' });
    const vecchi = Array.from({ length: 35 }, (_, i) => `pagamenti-backup-2026-08-${String(i + 1).padStart(2, '0')}.json`.replace('-08-3', '-09-0'));
    const { cartella, file } = cartellaFinta('granted', [...vecchi, 'appunti.txt']);
    await eseguiBackupAutomatico({ oggi: '2026-10-03', cartella });
    const backup = [...file.keys()].filter((n) => n.startsWith('pagamenti-backup-'));
    expect(backup).toHaveLength(30);
    expect(backup).toContain('pagamenti-backup-2026-10-03.json');
    expect(file.has('appunti.txt')).toBe(true);
  });

  it('se manca il permesso della cartella fa comunque la copia nell’app', async () => {
    await repo.creaPersona({ nome: 'Anna' });
    const { cartella, file } = cartellaFinta('prompt');
    expect(await eseguiBackupAutomatico({ oggi: '2026-10-03', cartella })).toEqual({ fatto: true, file: 'serve-permesso' });
    expect(file.size).toBe(0);
    expect(await elencoCopie()).toHaveLength(1);
  });

  it('si può disattivare', async () => {
    await repo.creaPersona({ nome: 'Anna' });
    await repo.aggiornaImpostazioni({ backupAutomatico: false });
    expect(await eseguiBackupAutomatico({ oggi: '2026-10-03', cartella: null })).toEqual({ fatto: false });
    expect(await elencoCopie()).toHaveLength(0);
  });

  it('i dati del backup automatico non vanno nei backup', async () => {
    await repo.creaPersona({ nome: 'Anna' });
    await eseguiBackupAutomatico({ oggi: '2026-10-03', cartella: null });
    const { file, cartella } = cartellaFinta();
    await eseguiBackupAutomatico({ oggi: '2026-10-04', cartella });
    const imp = JSON.parse(file.get('pagamenti-backup-2026-10-04.json')!).dati.impostazioni;
    expect(imp).not.toHaveProperty('ultimoBackupAutomatico');
  });
});
