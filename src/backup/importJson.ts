import { db } from '../db/database';
import { leggiImpostazioni, sincronizzaScadenze } from '../db/repository';
import type { CopiaSicurezza, Impostazioni, Pagamento, Persona, Piano, Scadenza } from '../db/tipi';
import { decifra, type DatiCifrati } from './cifratura';
import { creaBackup } from './exportJson';
import { VERSIONE_BACKUP, type DatiBackup, type FileBackup } from './formato';

export class PasswordNecessaria extends Error {
  constructor() {
    super('Questo backup è protetto da password');
    this.name = 'PasswordNecessaria';
  }
}

/* ---------- lettura e controllo del file ---------- */

const eOggetto = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const eTesto = (x: unknown) => typeof x === 'string';
const eTestoOpz = (x: unknown) => x === undefined || typeof x === 'string';
const eData = (x: unknown) => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x);
const eCentesimi = (x: unknown) => Number.isInteger(x) && (x as number) >= 0;

function controllaElenco<T>(elenco: unknown, nome: string, valido: (x: Record<string, unknown>) => boolean): T[] {
  if (!Array.isArray(elenco)) throw new Error(`Backup non valido: manca l'elenco "${nome}"`);
  elenco.forEach((x, i) => {
    if (!eOggetto(x) || !eTesto(x.id) || !valido(x)) throw new Error(`Backup non valido: "${nome}" n. ${i + 1} danneggiato`);
  });
  return elenco as T[];
}

/** Converte i backup di versioni precedenti al formato attuale. Per ora esiste solo la versione 1. */
function aggiornaFormato(dati: unknown, versione: number): unknown {
  // es. if (versione < 2) { ...conversione da 1 a 2... }
  void versione;
  return dati;
}

function controllaDati(grezzi: unknown): DatiBackup {
  if (!eOggetto(grezzi)) throw new Error('Backup non valido: dati mancanti');
  const persone = controllaElenco<Persona>(
    grezzi.persone,
    'persone',
    (p) => eTesto(p.nome) && typeof p.attivo === 'boolean' && eTestoOpz(p.telefono) && eTestoOpz(p.categoria),
  );
  const piani = controllaElenco<Piano>(
    grezzi.piani,
    'quote',
    (p) => eTesto(p.personaId) && eCentesimi(p.importo) && eTesto(p.frequenza) && eData(p.dataInizio),
  );
  const scadenze = controllaElenco<Scadenza>(
    grezzi.scadenze,
    'scadenze',
    (s) => eTesto(s.pianoId) && eTesto(s.personaId) && eData(s.dataScadenza) && eCentesimi(s.importoDovuto),
  );
  const pagamenti = controllaElenco<Pagamento>(
    grezzi.pagamenti,
    'pagamenti',
    (p) => eTesto(p.personaId) && eData(p.dataPagamento) && eCentesimi(p.importo) && eTesto(p.metodo) && eTestoOpz(p.scadenzaId),
  );
  const impostazioni = eOggetto(grezzi.impostazioni) ? grezzi.impostazioni : {};
  // il PIN non arriva mai da un backup
  for (const campo of ['id', 'pinHash', 'pinSale', 'pinErrori', 'pinBloccatoFino', 'pinIterazioni', 'pinProposto']) delete impostazioni[campo];
  return { persone, piani, scadenze, pagamenti, impostazioni };
}

export interface BackupLetto {
  creatoIl?: string;
  versione: number;
  dati: DatiBackup;
}

/** true se il testo è un backup di Buggi protetto da password. */
export function richiedePassword(testo: string): boolean {
  try {
    const f = JSON.parse(testo);
    return eOggetto(f) && f.app === 'Buggi' && eOggetto(f.cifrato);
  } catch {
    return false;
  }
}

/**
 * Legge e controlla il testo di un file di backup.
 * Errori: file non di Buggi, versione troppo nuova, password mancante/sbagliata, dati danneggiati.
 */
export async function leggiBackup(testo: string, password?: string): Promise<BackupLetto> {
  let file: unknown;
  try {
    file = JSON.parse(testo);
  } catch {
    throw new Error('Il file non è un backup valido (non è un file .json di Buggi)');
  }
  if (!eOggetto(file) || file.app !== 'Buggi' || typeof file.versione !== 'number') {
    throw new Error('Questo file non è un backup di Buggi');
  }
  if (file.versione > VERSIONE_BACKUP) {
    throw new Error('Questo backup è stato creato con una versione più nuova di Buggi: aggiorna l’app e riprova');
  }
  let dati: unknown = file.dati;
  if (eOggetto(file.cifrato)) {
    if (!password) throw new PasswordNecessaria();
    dati = JSON.parse(await decifra(file.cifrato as unknown as DatiCifrati, password));
  }
  return {
    creatoIl: eTesto(file.creatoIl) ? (file.creatoIl as string) : undefined,
    versione: file.versione,
    dati: controllaDati(aggiornaFormato(dati, file.versione)),
  };
}

/* ---------- anteprima ---------- */

export interface Anteprima {
  persone: number;
  quote: number;
  scadenze: number;
  pagamenti: number;
  totalePagamenti: number;
  ultimoPagamento?: string;
}

export function anteprima(dati: DatiBackup): Anteprima {
  return {
    persone: dati.persone.length,
    quote: dati.piani.length,
    scadenze: dati.scadenze.length,
    pagamenti: dati.pagamenti.length,
    totalePagamenti: dati.pagamenti.reduce((t, p) => t + p.importo, 0),
    ultimoPagamento: dati.pagamenti.reduce<string | undefined>((m, p) => (!m || p.dataPagamento > m ? p.dataPagamento : m), undefined),
  };
}

/* ---------- copie di sicurezza ---------- */

const MAX_COPIE = 5;

/** Salva nell'app una copia di tutti i dati attuali (si può ripristinare da Impostazioni). */
export async function salvaCopiaSicurezza(motivo: string): Promise<CopiaSicurezza> {
  const copia: CopiaSicurezza = { id: crypto.randomUUID(), creatoIl: new Date().toISOString(), motivo, contenuto: await creaBackup() };
  await db.transaction('rw', db.copie, async () => {
    await db.copie.add(copia);
    const vecchie = await db.copie.orderBy('creatoIl').reverse().offset(MAX_COPIE).primaryKeys();
    await db.copie.bulkDelete(vecchie);
  });
  return copia;
}

export const elencoCopie = () => db.copie.orderBy('creatoIl').reverse().toArray();

/* ---------- ripristino ---------- */

export type ModoRipristino = 'sostituisci' | 'unisci';

const piuRecente = <T extends { modificatoIl?: string }>(a: T, b: T) => ((b.modificatoIl ?? '') > (a.modificatoIl ?? '') ? b : a);

/**
 * Ripristina i dati di un backup.
 * - sostituisci: prima salva una copia di sicurezza, poi cancella tutto e carica il backup.
 * - unisci: aggiunge ciò che manca; se una persona/quota c'è in entrambi tiene la versione modificata più di recente.
 * Il PIN di questo telefono resta com'è.
 */
export async function ripristina(dati: DatiBackup, modo: ModoRipristino): Promise<void> {
  if (modo === 'sostituisci') await salvaCopiaSicurezza('Prima di un ripristino');

  await db.transaction('rw', [db.persone, db.piani, db.scadenze, db.pagamenti, db.impostazioni], async () => {
    const attuali = await leggiImpostazioni();
    if (modo === 'sostituisci') {
      await Promise.all([db.persone.clear(), db.piani.clear(), db.scadenze.clear(), db.pagamenti.clear()]);
      await db.persone.bulkAdd(dati.persone);
      await db.piani.bulkAdd(dati.piani);
      await db.scadenze.bulkAdd(dati.scadenze);
      await db.pagamenti.bulkAdd(dati.pagamenti);
      const nuove: Impostazioni = {
        ...attuali,
        ...dati.impostazioni,
        id: 'principale',
        pinHash: attuali.pinHash,
        pinSale: attuali.pinSale,
        pinErrori: attuali.pinErrori,
        pinBloccatoFino: attuali.pinBloccatoFino,
        pinIterazioni: attuali.pinIterazioni,
        pinProposto: attuali.pinProposto,
        benvenutoVisto: true,
      };
      await db.impostazioni.put(nuove);
      return;
    }

    // unisci: persone e quote → tiene la versione modificata più di recente
    const persone = await db.persone.bulkGet(dati.persone.map((p) => p.id));
    await db.persone.bulkPut(dati.persone.map((p, i) => (persone[i] ? piuRecente(persone[i]!, p) : p)));
    const piani = await db.piani.bulkGet(dati.piani.map((p) => p.id));
    await db.piani.bulkPut(dati.piani.map((p, i) => (piani[i] ? piuRecente(piani[i]!, p) : p)));

    // scadenze: si aggiungono quelle che mancano. Se esiste già una scadenza della stessa
    // quota nello stesso giorno (creata in automatico su entrambi i telefoni) si usa quella.
    const stessoId = new Map<string, string>();
    for (const s of dati.scadenze) {
      if (await db.scadenze.get(s.id)) continue;
      const gemella = await db.scadenze.where('[pianoId+dataScadenza]').equals([s.pianoId, s.dataScadenza]).first();
      if (gemella) stessoId.set(s.id, gemella.id);
      else await db.scadenze.add(s);
    }

    // pagamenti: si aggiungono quelli che mancano, collegati alla scadenza giusta
    const pagamenti = await db.pagamenti.bulkGet(dati.pagamenti.map((p) => p.id));
    await db.pagamenti.bulkAdd(
      dati.pagamenti
        .filter((_, i) => !pagamenti[i])
        .map((p) => (p.scadenzaId && stessoId.has(p.scadenzaId) ? { ...p, scadenzaId: stessoId.get(p.scadenzaId) } : p)),
    );

    const categorie = [...new Set([...attuali.categorie, ...(dati.impostazioni.categorie ?? [])])];
    await db.impostazioni.put({ ...attuali, categorie, benvenutoVisto: true });
  });

  await sincronizzaScadenze();
}

/** Ripristina una copia di sicurezza salvata nell'app. */
export async function ripristinaCopia(id: string): Promise<void> {
  const copia = await db.copie.get(id);
  if (!copia) throw new Error('Copia non trovata');
  const letto = await leggiBackup(JSON.stringify(copia.contenuto as FileBackup));
  await ripristina(letto.dati, 'sostituisci');
}
