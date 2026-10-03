import Dexie, { type EntityTable } from 'dexie';
import type { CopiaSicurezza, Impostazioni, Pagamento, Persona, Piano, Scadenza } from './tipi';

/**
 * Database locale (IndexedDB) di Buggi.
 *
 * REGOLA: ogni modifica allo schema = nuova `this.version(N + 1)` con eventuale
 * `.upgrade(...)` per convertire i dati esistenti. Non modificare mai le versioni
 * già pubblicate, altrimenti i dati sui telefoni andrebbero persi.
 */
export class BuggiDB extends Dexie {
  persone!: EntityTable<Persona, 'id'>;
  piani!: EntityTable<Piano, 'id'>;
  scadenze!: EntityTable<Scadenza, 'id'>;
  pagamenti!: EntityTable<Pagamento, 'id'>;
  impostazioni!: EntityTable<Impostazioni, 'id'>;
  copie!: EntityTable<CopiaSicurezza, 'id'>;
  /** valori vari da ricordare sul telefono, es. la cartella scelta per i backup (non va nei backup) */
  archivio!: EntityTable<{ chiave: string; valore: unknown }, 'chiave'>;

  constructor(nome = 'buggi') {
    super(nome);

    // Versione 1 (Fase 2). Solo i campi usati per cercare/ordinare sono indicizzati.
    this.version(1).stores({
      persone: 'id, nome, categoria',
      piani: 'id, personaId',
      scadenze: 'id, pianoId, personaId, dataScadenza, [pianoId+dataScadenza]',
      pagamenti: 'id, personaId, scadenzaId, dataPagamento',
      impostazioni: 'id',
    });

    // Versione 2 (Fase 4): nuovo campo Piano.generatoFino (non indicizzato).
    // Migrazione: per i piani esistenti vale la data dell'ultima scadenza già creata.
    this.version(2)
      .stores({})
      .upgrade(async (tx) => {
        const ultima = new Map<string, string>();
        await tx
          .table<Scadenza>('scadenze')
          .each((s) => {
            const attuale = ultima.get(s.pianoId);
            if (!attuale || s.dataScadenza > attuale) ultima.set(s.pianoId, s.dataScadenza);
          });
        await tx
          .table<Piano>('piani')
          .toCollection()
          .modify((p) => {
            if (!p.generatoFino && ultima.has(p.id)) p.generatoFino = ultima.get(p.id);
          });
      });

    // Versione 3 (Fase 7): nuova tabella con le copie di sicurezza automatiche. Nessun dato da convertire.
    this.version(3).stores({
      copie: 'id, creatoIl',
    });

    // Versione 4: tabella "archivio" (es. la cartella dei backup automatici). Nessun dato da convertire.
    this.version(4).stores({
      archivio: 'chiave',
    });

    // Versione 5: gli importi si mostrano senza simbolo € (solo la cifra). Si toglie il "€" salvato.
    this.version(5)
      .stores({})
      .upgrade(async (tx) => {
        await tx
          .table<Impostazioni>('impostazioni')
          .toCollection()
          .modify((imp) => {
            if (imp.valuta === '€') imp.valuta = '';
          });
      });
  }
}

export const db = new BuggiDB();
