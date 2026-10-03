import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { leggiImpostazioni } from '../db/repository';

/**
 * Tutti i dati dell'app, aggiornati da soli quando cambiano.
 * undefined mentre si caricano. (I dati sono pochi: caricarli tutti è veloce.)
 */
export function useDati() {
  return useLiveQuery(async () => {
    const [persone, piani, scadenze, pagamenti, impostazioni] = await Promise.all([
      db.persone.toArray(),
      db.piani.toArray(),
      db.scadenze.toArray(),
      db.pagamenti.toArray(),
      leggiImpostazioni(),
    ]);
    persone.sort((a, b) => a.nome.localeCompare(b.nome, 'it', { sensitivity: 'base' }));
    return { persone, piani, scadenze, pagamenti, impostazioni };
  });
}

export type Dati = NonNullable<ReturnType<typeof useDati>>;
