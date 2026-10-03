import { subDays } from 'date-fns';
import { limiteGenerazione, scadenzeMancanti } from '../logic/scadenze';
import { aIso, daIso, oggiIso } from '../utils/date';
import { db } from './database';
import {
  IMPOSTAZIONI_PREDEFINITE,
  type DataIso,
  type Impostazioni,
  type Pagamento,
  type Persona,
  type Piano,
  type Scadenza,
} from './tipi';

/* ---------- controlli ---------- */

const nuovoId = () => crypto.randomUUID();
const adesso = () => new Date().toISOString();

function controllaImporto(valore: number, campo: string, consentiZero = true): void {
  if (!Number.isInteger(valore) || valore < 0 || (!consentiZero && valore === 0)) {
    throw new Error(`${campo}: deve essere un numero intero di centesimi${consentiZero ? '' : ' maggiore di zero'}`);
  }
}

function controllaData(valore: DataIso | undefined, campo: string): void {
  if (valore === undefined) return;
  const [a, m, g] = valore.split('-').map(Number);
  const d = new Date(a, m - 1, g);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valore) || d.getFullYear() !== a || d.getMonth() !== m - 1 || d.getDate() !== g) {
    throw new Error(`${campo}: data non valida (${valore})`);
  }
}

function controllaNome(nome: string): string {
  const pulito = nome.trim();
  if (!pulito) throw new Error('Il nome è obbligatorio');
  return pulito;
}

const interoTra = (v: number | undefined, min: number, max: number) => Number.isInteger(v) && v! >= min && v! <= max;

function controllaPiano(p: DatiPiano): void {
  controllaImporto(p.importo, 'Importo');
  controllaData(p.dataInizio, 'Data inizio');
  controllaData(p.dataFine, 'Data fine');
  if (p.dataFine && p.dataFine < p.dataInizio) throw new Error('La data di fine è prima della data di inizio');
  if (p.frequenza === 'ogniNMesi' && !interoTra(p.intervalloMesi, 1, 120)) {
    throw new Error('Indica ogni quanti mesi (numero intero da 1 in su)');
  }
  if (['mensile', 'ogniNMesi', 'annuale'].includes(p.frequenza) && !interoTra(p.giornoScadenza, 1, 31)) {
    throw new Error('Giorno di scadenza non valido (1–31)');
  }
  if (p.frequenza === 'settimanale' && !interoTra(p.giornoScadenza, 0, 6)) {
    throw new Error('Giorno della settimana non valido');
  }
  if (p.frequenza === 'annuale' && !interoTra(p.meseScadenza, 1, 12)) {
    throw new Error('Mese di scadenza non valido (1–12)');
  }
}

/* ---------- persone ---------- */

export type DatiPersona = Pick<Persona, 'nome'> & Partial<Pick<Persona, 'telefono' | 'email' | 'categoria' | 'note'>>;

export async function creaPersona(dati: DatiPersona): Promise<Persona> {
  const ora = adesso();
  const persona: Persona = {
    ...dati,
    nome: controllaNome(dati.nome),
    id: nuovoId(),
    attivo: true,
    creatoIl: ora,
    modificatoIl: ora,
  };
  await db.persone.add(persona);
  return persona;
}

export async function aggiornaPersona(id: string, modifiche: Partial<DatiPersona>): Promise<void> {
  const cambi: Partial<Persona> = { ...modifiche, modificatoIl: adesso() };
  if (modifiche.nome !== undefined) cambi.nome = controllaNome(modifiche.nome);
  if ((await db.persone.update(id, cambi)) === 0) throw new Error('Persona non trovata');
}

/** Archivia (attivo = false) o ripristina una persona, senza toccare lo storico. */
export async function impostaPersonaAttiva(id: string, attivo: boolean): Promise<void> {
  if ((await db.persone.update(id, { attivo, modificatoIl: adesso() })) === 0) throw new Error('Persona non trovata');
}

export const leggiPersona = (id: string) => db.persone.get(id);

/** Persone in ordine alfabetico; di default solo quelle attive. */
export async function elencoPersone(opzioni: { inclusiArchiviati?: boolean } = {}): Promise<Persona[]> {
  const tutte = await db.persone.toArray();
  return tutte
    .filter((p) => opzioni.inclusiArchiviati || p.attivo)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'it', { sensitivity: 'base' }));
}

/** Elimina definitivamente la persona con piani, scadenze e pagamenti. */
export async function eliminaPersona(id: string): Promise<void> {
  await db.transaction('rw', [db.persone, db.piani, db.scadenze, db.pagamenti], async () => {
    await db.pagamenti.where('personaId').equals(id).delete();
    await db.scadenze.where('personaId').equals(id).delete();
    await db.piani.where('personaId').equals(id).delete();
    await db.persone.delete(id);
  });
}

/* ---------- piani ---------- */

export type DatiPiano = Omit<Piano, 'id' | 'creatoIl' | 'modificatoIl' | 'generatoFino'>;

/** Crea il piano. Le scadenze si creano poi con `sincronizzaScadenze(oggi, piano.id)`. */
export async function creaPiano(dati: DatiPiano): Promise<Piano> {
  controllaPiano(dati);
  if (!(await db.persone.get(dati.personaId))) throw new Error('Persona non trovata');
  const ora = adesso();
  const piano: Piano = { ...dati, id: nuovoId(), creatoIl: ora, modificatoIl: ora };
  await db.piani.add(piano);
  return piano;
}

/**
 * Modifica il piano e ricalcola le sue scadenze:
 * - quelle da oggi in poi senza pagamenti collegati si ricreano con le nuove regole (es. nuovo importo);
 * - quelle passate restano come sono (sono storia), tranne quelle senza pagamenti
 *   che ora cadono fuori dal periodo inizio–fine, che vengono tolte.
 */
export async function aggiornaPiano(
  id: string,
  modifiche: Partial<Omit<DatiPiano, 'personaId'>>,
  oggi: DataIso = oggiIso(),
): Promise<void> {
  await db.transaction('rw', [db.piani, db.scadenze, db.pagamenti], async () => {
    const attuale = await db.piani.get(id);
    if (!attuale) throw new Error('Piano non trovato');
    const nuovo: Piano = { ...attuale, ...modifiche, modificatoIl: adesso() };
    controllaPiano(nuovo);

    const ieri = aIso(subDays(daIso(oggi), 1));
    if (nuovo.generatoFino && nuovo.generatoFino > ieri) nuovo.generatoFino = ieri;
    await db.piani.put(nuovo);

    const scadenze = await db.scadenze.where('pianoId').equals(id).toArray();
    const pagate = new Set(
      (await db.pagamenti.where('scadenzaId').anyOf(scadenze.map((s) => s.id)).toArray()).map((p) => p.scadenzaId),
    );
    const daTogliere = scadenze.filter(
      (s) =>
        !pagate.has(s.id) &&
        (s.dataScadenza >= oggi || s.dataScadenza < nuovo.dataInizio || (nuovo.dataFine && s.dataScadenza > nuovo.dataFine)),
    );
    await db.scadenze.bulkDelete(daTogliere.map((s) => s.id));
  });
  await sincronizzaScadenze(oggi, id);
}

export const leggiPiano = (id: string) => db.piani.get(id);
export const pianiDellaPersona = (personaId: string) => db.piani.where('personaId').equals(personaId).toArray();

/** Elimina il piano e le sue scadenze. I pagamenti restano come acconti liberi. */
export async function eliminaPiano(id: string): Promise<void> {
  await db.transaction('rw', [db.piani, db.scadenze, db.pagamenti], async () => {
    const idScadenze = await db.scadenze.where('pianoId').equals(id).primaryKeys();
    if (idScadenze.length) {
      await db.pagamenti
        .where('scadenzaId')
        .anyOf(idScadenze)
        .modify((p) => {
          delete p.scadenzaId;
        });
    }
    await db.scadenze.bulkDelete(idScadenze);
    await db.piani.delete(id);
  });
}

/* ---------- scadenze ---------- */

export type DatiScadenza = Omit<Scadenza, 'id'>;

/**
 * Salva nuove scadenze generate da un piano. Salta quelle già presenti
 * (stesso piano e stessa data), così si può chiamare più volte senza doppioni.
 */
export async function aggiungiScadenze(elenco: DatiScadenza[]): Promise<Scadenza[]> {
  elenco.forEach((s) => {
    controllaImporto(s.importoDovuto, 'Importo dovuto');
    controllaData(s.dataScadenza, 'Data scadenza');
  });
  return db.transaction('rw', db.scadenze, async () => {
    const nuove: Scadenza[] = [];
    for (const s of elenco) {
      const giaSalvata = await db.scadenze.where('[pianoId+dataScadenza]').equals([s.pianoId, s.dataScadenza]).count();
      const doppia = nuove.some((n) => n.pianoId === s.pianoId && n.dataScadenza === s.dataScadenza);
      if (!giaSalvata && !doppia) nuove.push({ ...s, id: nuovoId() });
    }
    await db.scadenze.bulkAdd(nuove);
    return nuove;
  });
}

/** Cambia l'importo dovuto di un singolo periodo. */
export async function aggiornaImportoDovuto(id: string, importoDovuto: number): Promise<void> {
  controllaImporto(importoDovuto, 'Importo dovuto');
  if ((await db.scadenze.update(id, { importoDovuto })) === 0) throw new Error('Scadenza non trovata');
}

export const leggiScadenza = (id: string) => db.scadenze.get(id);
export const scadenzeDellaPersona = (personaId: string) =>
  db.scadenze.where('personaId').equals(personaId).sortBy('dataScadenza');
export const scadenzeDelPiano = (pianoId: string) => db.scadenze.where('pianoId').equals(pianoId).sortBy('dataScadenza');
export const tutteLeScadenze = () => db.scadenze.orderBy('dataScadenza').toArray();

/** Elimina una scadenza. I suoi pagamenti restano come acconti liberi. */
export async function eliminaScadenza(id: string): Promise<void> {
  await db.transaction('rw', [db.scadenze, db.pagamenti], async () => {
    await db.pagamenti
      .where('scadenzaId')
      .equals(id)
      .modify((p) => {
        delete p.scadenzaId;
      });
    await db.scadenze.delete(id);
  });
}

/* ---------- pagamenti ---------- */

export type DatiPagamento = Omit<Pagamento, 'id' | 'creatoIl'>;

export async function creaPagamento(dati: DatiPagamento): Promise<Pagamento> {
  controllaImporto(dati.importo, 'Importo', false);
  controllaData(dati.dataPagamento, 'Data pagamento');
  return db.transaction('rw', [db.persone, db.scadenze, db.pagamenti], async () => {
    if (!(await db.persone.get(dati.personaId))) throw new Error('Persona non trovata');
    if (dati.scadenzaId) {
      const s = await db.scadenze.get(dati.scadenzaId);
      if (!s || s.personaId !== dati.personaId) throw new Error('Scadenza non trovata per questa persona');
    }
    const pagamento: Pagamento = { ...dati, id: nuovoId(), creatoIl: adesso() };
    await db.pagamenti.add(pagamento);
    return pagamento;
  });
}

export async function aggiornaPagamento(
  id: string,
  modifiche: Partial<Omit<DatiPagamento, 'personaId'>>,
): Promise<void> {
  if (modifiche.importo !== undefined) controllaImporto(modifiche.importo, 'Importo', false);
  controllaData(modifiche.dataPagamento, 'Data pagamento');
  if ((await db.pagamenti.update(id, modifiche)) === 0) throw new Error('Pagamento non trovato');
}

export const leggiPagamento = (id: string) => db.pagamenti.get(id);
export const eliminaPagamento = (id: string) => db.pagamenti.delete(id);

/** Pagamenti della persona, dal più recente al più vecchio. */
export async function pagamentiDellaPersona(personaId: string): Promise<Pagamento[]> {
  return (await db.pagamenti.where('personaId').equals(personaId).sortBy('dataPagamento')).reverse();
}
export const pagamentiDellaScadenza = (scadenzaId: string) =>
  db.pagamenti.where('scadenzaId').equals(scadenzaId).toArray();
export const tuttiIPagamenti = () => db.pagamenti.orderBy('dataPagamento').reverse().toArray();

/* ---------- impostazioni ---------- */

/** Le impostazioni salvate; i campi mancanti (es. da versioni vecchie) prendono il valore predefinito. */
export async function leggiImpostazioni(): Promise<Impostazioni> {
  const salvate = await db.impostazioni.get('principale');
  return { ...IMPOSTAZIONI_PREDEFINITE, ...salvate };
}

export async function aggiornaImpostazioni(modifiche: Partial<Omit<Impostazioni, 'id'>>): Promise<Impostazioni> {
  if (modifiche.giorniTolleranza !== undefined && !interoTra(modifiche.giorniTolleranza, 0, 365)) {
    throw new Error('Giorni di tolleranza non validi');
  }
  return db.transaction('rw', db.impostazioni, async () => {
    const nuove: Impostazioni = { ...(await leggiImpostazioni()), ...modifiche, id: 'principale' };
    await db.impostazioni.put(nuove);
    return nuove;
  });
}

/* ---------- generazione scadenze ---------- */

/**
 * Crea le scadenze che mancano (fino a oggi + 3 mesi) per i piani delle persone attive.
 * Si chiama all'apertura dell'app e dopo aver creato o modificato un piano.
 * Restituisce quante scadenze nuove ha creato.
 */
export async function sincronizzaScadenze(oggi: DataIso = oggiIso(), soloPianoId?: string): Promise<number> {
  const piani = soloPianoId ? await db.piani.where('id').equals(soloPianoId).toArray() : await db.piani.toArray();
  const attive = new Set((await db.persone.toArray()).filter((p) => p.attivo).map((p) => p.id));
  const limite = limiteGenerazione(oggi);
  let create = 0;
  for (const { id, personaId } of piani) {
    if (!attive.has(personaId)) continue;
    await db.transaction('rw', [db.piani, db.scadenze], async () => {
      const piano = await db.piani.get(id);
      if (!piano) return;
      const esistenti = await db.scadenze.where('pianoId').equals(id).toArray();
      const nuove = await aggiungiScadenze(scadenzeMancanti(piano, esistenti, oggi));
      create += nuove.length;
      const fino = [limite, piano.generatoFino ?? '', ...nuove.map((s) => s.dataScadenza)].reduce((a, b) => (b > a ? b : a));
      if (fino !== piano.generatoFino) await db.piani.update(id, { generatoFino: fino });
    });
  }
  return create;
}

/* ---------- riepilogo ---------- */

export async function conteggi() {
  const [persone, piani, scadenze, pagamenti] = await Promise.all([
    db.persone.count(),
    db.piani.count(),
    db.scadenze.count(),
    db.pagamenti.count(),
  ]);
  return { persone, piani, scadenze, pagamenti };
}
