import { addDays, differenceInCalendarDays } from 'date-fns';
import type { DataIso, Pagamento, Scadenza } from '../db/tipi';
import { aIso, daIso } from '../utils/date';

/**
 * Stato dei pagamenti: si calcola SEMPRE qui, non si salva mai nel database.
 *
 * Regole per ogni scadenza:
 * - pagata     se quanto ricevuto ≥ dovuto
 * - in ritardo se non pagata e oggi > scadenza + giorni di tolleranza
 * - parziale   se ricevuto qualcosa (> 0) ma meno del dovuto, e non in ritardo
 * - in attesa  altrimenti
 */

export type StatoScadenza = 'pagata' | 'inRitardo' | 'parziale' | 'inAttesa';

export interface CalcoloScadenza {
  scadenza: Scadenza;
  /** centesimi attribuiti a questa scadenza */
  pagato: number;
  /** centesimi ancora da pagare (mai negativo) */
  residuo: number;
  stato: StatoScadenza;
  /** true se ha ricevuto qualcosa ma non tutto (vale anche se è in ritardo) */
  parziale: boolean;
  /** giorni passati dalla scadenza, solo se in ritardo; altrimenti 0 */
  giorniRitardo: number;
}

export interface Ripartizione {
  /** quanto è attribuito a ogni scadenza (per id) */
  pagatoPerScadenza: Map<string, number>;
  /** soldi in più non attribuibili a nessuna scadenza (credito della persona) */
  credito: number;
}

/**
 * Ripartisce i pagamenti di UNA persona sulle sue scadenze:
 * 1. ogni pagamento collegato va alla sua scadenza, fino a coprirla;
 * 2. gli acconti liberi e le eccedenze coprono le scadenze rimaste, dalla più vecchia;
 * 3. ciò che avanza è credito.
 */
export function ripartisciPagamenti(scadenze: Scadenza[], pagamenti: Pagamento[]): Ripartizione {
  const pagatoPerScadenza = new Map<string, number>(scadenze.map((s) => [s.id, 0]));
  const perId = new Map(scadenze.map((s) => [s.id, s]));
  let libero = 0;

  for (const p of pagamenti) {
    const s = p.scadenzaId ? perId.get(p.scadenzaId) : undefined;
    if (!s) {
      libero += p.importo;
      continue;
    }
    const gia = pagatoPerScadenza.get(s.id)!;
    const quota = Math.min(p.importo, Math.max(0, s.importoDovuto - gia));
    pagatoPerScadenza.set(s.id, gia + quota);
    libero += p.importo - quota;
  }

  const inOrdine = [...scadenze].sort((a, b) => a.dataScadenza.localeCompare(b.dataScadenza) || a.id.localeCompare(b.id));
  for (const s of inOrdine) {
    if (libero <= 0) break;
    const gia = pagatoPerScadenza.get(s.id)!;
    const quota = Math.min(libero, Math.max(0, s.importoDovuto - gia));
    pagatoPerScadenza.set(s.id, gia + quota);
    libero -= quota;
  }

  return { pagatoPerScadenza, credito: libero };
}

/** Lo stato di una singola scadenza, dato quanto le è stato attribuito. */
export function statoScadenza(scadenza: Scadenza, pagato: number, oggi: DataIso, giorniTolleranza: number): CalcoloScadenza {
  const residuo = Math.max(0, scadenza.importoDovuto - pagato);
  const parziale = pagato > 0 && residuo > 0;
  const limite = aIso(addDays(daIso(scadenza.dataScadenza), giorniTolleranza));
  const inRitardo = residuo > 0 && oggi > limite;

  let stato: StatoScadenza;
  if (residuo === 0) stato = 'pagata';
  else if (inRitardo) stato = 'inRitardo';
  else if (parziale) stato = 'parziale';
  else stato = 'inAttesa';

  return {
    scadenza,
    pagato,
    residuo,
    stato,
    parziale,
    giorniRitardo: inRitardo ? differenceInCalendarDays(daIso(oggi), daIso(scadenza.dataScadenza)) : 0,
  };
}

/** Colore riassuntivo di una persona: rosso = in ritardo, giallo = da sistemare, verde = in regola. */
export type ColoreStato = 'verde' | 'giallo' | 'rosso';

export interface StatoPersona {
  scadenze: CalcoloScadenza[];
  /** dovuto per le scadenze già arrivate (data ≤ oggi) */
  dovutoFinoAOggi: number;
  /** totale di tutti i pagamenti ricevuti */
  totalePagato: number;
  /** residuo delle scadenze già arrivate (in ritardo o entro la tolleranza) */
  daPagareOra: number;
  importoInRitardo: number;
  scadenzeInRitardo: number;
  /** giorni della scadenza in ritardo più vecchia */
  maxGiorniRitardo: number;
  credito: number;
  /** prima scadenza non ancora pagata con data ≥ oggi */
  prossimaScadenza?: CalcoloScadenza;
  colore: ColoreStato;
}

/** Calcola tutto lo stato di una persona da scadenze e pagamenti (solo i suoi). */
export function statoPersona(
  scadenze: Scadenza[],
  pagamenti: Pagamento[],
  oggi: DataIso,
  giorniTolleranza: number,
): StatoPersona {
  const { pagatoPerScadenza, credito } = ripartisciPagamenti(scadenze, pagamenti);
  const calcolate = [...scadenze]
    .sort((a, b) => a.dataScadenza.localeCompare(b.dataScadenza))
    .map((s) => statoScadenza(s, pagatoPerScadenza.get(s.id) ?? 0, oggi, giorniTolleranza));

  const arrivate = calcolate.filter((c) => c.scadenza.dataScadenza <= oggi);
  const inRitardo = calcolate.filter((c) => c.stato === 'inRitardo');
  const daPagareOra = arrivate.reduce((t, c) => t + c.residuo, 0);
  const parzialiAperte = calcolate.some((c) => c.parziale);

  return {
    scadenze: calcolate,
    dovutoFinoAOggi: arrivate.reduce((t, c) => t + c.scadenza.importoDovuto, 0),
    totalePagato: pagamenti.reduce((t, p) => t + p.importo, 0),
    daPagareOra,
    importoInRitardo: inRitardo.reduce((t, c) => t + c.residuo, 0),
    scadenzeInRitardo: inRitardo.length,
    maxGiorniRitardo: inRitardo.reduce((m, c) => Math.max(m, c.giorniRitardo), 0),
    credito,
    prossimaScadenza: calcolate.find((c) => c.residuo > 0 && c.scadenza.dataScadenza >= oggi),
    colore: inRitardo.length > 0 ? 'rosso' : daPagareOra > 0 || parzialiAperte ? 'giallo' : 'verde',
  };
}
