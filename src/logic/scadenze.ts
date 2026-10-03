import { addDays, addMonths, getDaysInMonth } from 'date-fns';
import type { DataIso, Piano, Scadenza } from '../db/tipi';
import { aIso, daIso } from '../utils/date';

/** Fin dove si generano le scadenze ricorrenti: oggi + 3 mesi. */
export const MESI_ORIZZONTE = 3;

/** Limite di sicurezza: nessun piano genera più di così (es. settimanale per decenni). */
const MAX_OCCORRENZE = 5000;

/** I campi del piano che servono a calcolare le date. */
export type RegolaScadenza = Pick<
  Piano,
  'frequenza' | 'dataInizio' | 'dataFine' | 'giornoScadenza' | 'meseScadenza' | 'intervalloMesi'
>;

/** Giorno `giorno` del mese indicato; se il mese è più corto si usa l'ultimo giorno (31 → 30, 28 o 29). */
function giornoNelMese(anno: number, mese0: number, giorno: number): Date {
  const ultimo = getDaysInMonth(new Date(anno, mese0, 1));
  return new Date(anno, mese0, Math.min(giorno, ultimo));
}

/** Tutte le date candidate in ordine crescente, senza filtri di inizio/fine. */
function* candidati(regola: RegolaScadenza): Generator<Date> {
  const inizio = daIso(regola.dataInizio);
  const giorno = regola.giornoScadenza ?? inizio.getDate();

  switch (regola.frequenza) {
    case 'singola':
      yield inizio;
      return;

    case 'mensile':
    case 'ogniNMesi': {
      const passo = regola.frequenza === 'mensile' ? 1 : Math.max(1, regola.intervalloMesi ?? 1);
      for (let k = 0; ; k += passo) {
        const mese = addMonths(new Date(inizio.getFullYear(), inizio.getMonth(), 1), k);
        yield giornoNelMese(mese.getFullYear(), mese.getMonth(), giorno);
      }
    }

    case 'settimanale': {
      const giornoSettimana = regola.giornoScadenza ?? inizio.getDay();
      let d = addDays(inizio, (giornoSettimana - inizio.getDay() + 7) % 7);
      for (;;) {
        yield d;
        d = addDays(d, 7);
      }
    }

    case 'annuale': {
      const mese0 = (regola.meseScadenza ?? inizio.getMonth() + 1) - 1;
      for (let anno = inizio.getFullYear(); ; anno++) {
        yield giornoNelMese(anno, mese0, giorno);
      }
    }
  }
}

/**
 * Le date di scadenza del piano, in ordine, dalla data di inizio alla data di fine
 * (se c'è). Sequenza potenzialmente infinita: usare con un limite.
 */
export function* occorrenze(regola: RegolaScadenza): Generator<DataIso> {
  let contate = 0;
  for (const d of candidati(regola)) {
    const iso = aIso(d);
    if (iso < regola.dataInizio) continue;
    if (regola.dataFine && iso > regola.dataFine) return;
    if (++contate > MAX_OCCORRENZE) return;
    yield iso;
  }
}

/** Fino a che data generare le scadenze: oggi + 3 mesi. */
export function limiteGenerazione(oggi: DataIso): DataIso {
  return aIso(addMonths(daIso(oggi), MESI_ORIZZONTE));
}

/**
 * Date delle scadenze da avere in archivio per questo piano: tutte fino a oggi + 3 mesi.
 * Una "data singola" si genera sempre, anche se è più lontana.
 */
export function dateScadenzePiano(regola: RegolaScadenza, oggi: DataIso): DataIso[] {
  const limite = limiteGenerazione(oggi);
  const date: DataIso[] = [];
  for (const d of occorrenze(regola)) {
    if (d > limite && regola.frequenza !== 'singola') break;
    date.push(d);
  }
  return date;
}

/** Le prossime `quante` scadenze a partire da oggi (per l'anteprima quando si crea un piano). */
export function anteprimaScadenze(regola: RegolaScadenza, oggi: DataIso, quante = 3): DataIso[] {
  const date: DataIso[] = [];
  for (const d of occorrenze(regola)) {
    if (d < oggi) continue;
    date.push(d);
    if (date.length >= quante) break;
  }
  return date;
}

/**
 * Le scadenze che mancano in archivio per questo piano. Salta quelle già presenti
 * e quelle fino a `piano.generatoFino` (già create in passato, magari poi eliminate).
 */
export function scadenzeMancanti(piano: Piano, esistenti: Scadenza[], oggi: DataIso): Omit<Scadenza, 'id'>[] {
  const giaPresenti = new Set(esistenti.filter((s) => s.pianoId === piano.id).map((s) => s.dataScadenza));
  return dateScadenzePiano(piano, oggi)
    .filter((d) => !giaPresenti.has(d) && !(piano.generatoFino && d <= piano.generatoFino))
    .map((dataScadenza) => ({
      pianoId: piano.id,
      personaId: piano.personaId,
      dataScadenza,
      importoDovuto: piano.importo,
    }));
}
