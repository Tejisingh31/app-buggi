import { endOfWeek, format, subMonths } from 'date-fns';
import { it } from 'date-fns/locale';
import type { DataIso, Pagamento, Persona, Scadenza } from '../db/tipi';
import { aIso, daIso } from '../utils/date';
import { statoPersona, type CalcoloScadenza, type StatoPersona } from './stato';

export interface DatiCompleti {
  persone: Persona[];
  scadenze: Scadenza[];
  pagamenti: Pagamento[];
}

/** Raggruppa per persona. */
function perPersona<T extends { personaId: string }>(elenco: T[]): Map<string, T[]> {
  const mappa = new Map<string, T[]>();
  for (const x of elenco) {
    const lista = mappa.get(x.personaId);
    if (lista) lista.push(x);
    else mappa.set(x.personaId, [x]);
  }
  return mappa;
}

/** Stato di ogni persona (per id). */
export function statiPersone(dati: DatiCompleti, oggi: DataIso, giorniTolleranza: number): Map<string, StatoPersona> {
  const scadenze = perPersona(dati.scadenze);
  const pagamenti = perPersona(dati.pagamenti);
  return new Map(
    dati.persone.map((p) => [p.id, statoPersona(scadenze.get(p.id) ?? [], pagamenti.get(p.id) ?? [], oggi, giorniTolleranza)]),
  );
}

export interface RiepilogoGenerale {
  /** riquadro rosso "Non hanno pagato" */
  personeInRitardo: number;
  importoInRitardo: number;
  /** pagamenti ricevuti nel mese corrente */
  incassatoMese: number;
  /** ancora da ricevere per le scadenze del mese corrente che non sono in ritardo */
  daIncassareMese: number;
}

/** Numeri della Dashboard. Le persone archiviate non vengono contate. */
export function riepilogoGenerale(dati: DatiCompleti, oggi: DataIso, giorniTolleranza: number): RiepilogoGenerale {
  const attive = dati.persone.filter((p) => p.attivo);
  const stati = statiPersone({ ...dati, persone: attive }, oggi, giorniTolleranza);
  const mese = oggi.slice(0, 7);
  const idAttive = new Set(attive.map((p) => p.id));

  let personeInRitardo = 0;
  let importoInRitardo = 0;
  let daIncassareMese = 0;
  for (const s of stati.values()) {
    if (s.scadenzeInRitardo > 0) personeInRitardo++;
    importoInRitardo += s.importoInRitardo;
    for (const c of s.scadenze) {
      if (c.scadenza.dataScadenza.startsWith(mese) && c.stato !== 'inRitardo') daIncassareMese += c.residuo;
    }
  }

  const incassatoMese = dati.pagamenti
    .filter((p) => idAttive.has(p.personaId) && p.dataPagamento.startsWith(mese))
    .reduce((t, p) => t + p.importo, 0);

  return { personeInRitardo, importoInRitardo, incassatoMese, daIncassareMese };
}

export interface IncassoMese {
  /** "2026-11" */
  mese: string;
  /** "nov 26" */
  etichetta: string;
  totale: number;
}

/** Incassi degli ultimi 12 mesi (mese corrente compreso), dal più vecchio. Include le persone archiviate. */
export function incassiUltimi12Mesi(pagamenti: Pagamento[], oggi: DataIso): IncassoMese[] {
  const mesi: IncassoMese[] = [];
  for (let k = 11; k >= 0; k--) {
    const d = subMonths(daIso(oggi.slice(0, 7) + '-01'), k);
    mesi.push({ mese: aIso(d).slice(0, 7), etichetta: format(d, 'MMM yy', { locale: it }), totale: 0 });
  }
  const indice = new Map(mesi.map((m) => [m.mese, m]));
  for (const p of pagamenti) {
    const m = indice.get(p.dataPagamento.slice(0, 7));
    if (m) m.totale += p.importo;
  }
  return mesi;
}

export interface VoceMancante extends CalcoloScadenza {
  persona: Persona;
}

export interface GruppiMancanti {
  inRitardo: VoceMancante[];
  /** da oggi (o già scadute ma ancora entro la tolleranza) fino a domenica */
  questaSettimana: VoceMancante[];
  prossime: VoceMancante[];
}

/** Scadenze non ancora pagate delle persone attive, raggruppate per la pagina Mancanti. */
export function mancanti(dati: DatiCompleti, oggi: DataIso, giorniTolleranza: number): GruppiMancanti {
  const attive = dati.persone.filter((p) => p.attivo);
  const stati = statiPersone({ ...dati, persone: attive }, oggi, giorniTolleranza);
  const fineSettimana = aIso(endOfWeek(daIso(oggi), { weekStartsOn: 1 }));
  const gruppi: GruppiMancanti = { inRitardo: [], questaSettimana: [], prossime: [] };

  for (const persona of attive) {
    for (const c of stati.get(persona.id)!.scadenze) {
      if (c.residuo === 0) continue;
      const voce = { ...c, persona };
      if (c.stato === 'inRitardo') gruppi.inRitardo.push(voce);
      else if (c.scadenza.dataScadenza <= fineSettimana) gruppi.questaSettimana.push(voce);
      else gruppi.prossime.push(voce);
    }
  }

  gruppi.inRitardo.sort((a, b) => b.giorniRitardo - a.giorniRitardo || a.persona.nome.localeCompare(b.persona.nome, 'it'));
  gruppi.questaSettimana.sort((a, b) => a.scadenza.dataScadenza.localeCompare(b.scadenza.dataScadenza));
  gruppi.prossime.sort((a, b) => a.scadenza.dataScadenza.localeCompare(b.scadenza.dataScadenza));
  return gruppi;
}

/** Somma dei residui di un gruppo. */
export const totaleResiduo = (voci: CalcoloScadenza[]) => voci.reduce((t, v) => t + v.residuo, 0);

export interface PersonaInRitardo {
  persona: Persona;
  stato: StatoPersona;
}

/** Chi non ha pagato (persone attive con almeno una scadenza in ritardo), dal debito più alto. */
export function personeInRitardo(dati: DatiCompleti, oggi: DataIso, giorniTolleranza: number): PersonaInRitardo[] {
  const attive = dati.persone.filter((p) => p.attivo);
  const stati = statiPersone({ ...dati, persone: attive }, oggi, giorniTolleranza);
  return attive
    .map((persona) => ({ persona, stato: stati.get(persona.id)! }))
    .filter((x) => x.stato.scadenzeInRitardo > 0)
    .sort((a, b) => b.stato.importoInRitardo - a.stato.importoInRitardo || a.persona.nome.localeCompare(b.persona.nome, 'it'));
}

export interface FiltroMancanti {
  /** '' = tutte */
  categoria: string;
  /** "AAAA-MM", '' = tutti */
  mese: string;
}

/** Applica i filtri di categoria e mese (della scadenza) ai gruppi della pagina Mancanti. */
export function filtraMancanti(gruppi: GruppiMancanti, filtro: FiltroMancanti): GruppiMancanti {
  const passa = (v: VoceMancante) =>
    (!filtro.categoria || v.persona.categoria === filtro.categoria) &&
    (!filtro.mese || v.scadenza.dataScadenza.startsWith(filtro.mese));
  return {
    inRitardo: gruppi.inRitardo.filter(passa),
    questaSettimana: gruppi.questaSettimana.filter(passa),
    prossime: gruppi.prossime.filter(passa),
  };
}
