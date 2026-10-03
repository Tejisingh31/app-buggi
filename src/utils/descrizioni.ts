import type { RegolaScadenza } from '../logic/scadenze';
import { daIso } from './date';
import { formattaData } from './formattazione';

/** Lunedì per primo, come sul calendario italiano. Il valore è quello di Date.getDay(). */
export const GIORNI_SETTIMANA: { valore: number; nome: string }[] = [
  { valore: 1, nome: 'lunedì' },
  { valore: 2, nome: 'martedì' },
  { valore: 3, nome: 'mercoledì' },
  { valore: 4, nome: 'giovedì' },
  { valore: 5, nome: 'venerdì' },
  { valore: 6, nome: 'sabato' },
  { valore: 0, nome: 'domenica' },
];

export const MESI = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
];

/** "2026-11-20" → "20/11/2026" */
export const dataLeggibile = (iso: string) => formattaData(daIso(iso));

/** Descrive la regola a parole: "Ogni mese il giorno 15", "Ogni lunedì", "Il 20/11/2026"… */
export function descriviRegola(r: RegolaScadenza): string {
  const g = r.giornoScadenza;
  switch (r.frequenza) {
    case 'singola':
      return `Il ${dataLeggibile(r.dataInizio)}`;
    case 'mensile':
      return `Ogni mese il giorno ${g}`;
    case 'ogniNMesi':
      return r.intervalloMesi === 1 ? `Ogni mese il giorno ${g}` : `Ogni ${r.intervalloMesi} mesi il giorno ${g}`;
    case 'settimanale': {
      const nome = GIORNI_SETTIMANA.find((x) => x.valore === g)?.nome ?? '';
      return nome === 'domenica' ? 'Ogni domenica' : `Ogni ${nome}`;
    }
    case 'annuale':
      return `Ogni anno il ${g} ${MESI[(r.meseScadenza ?? 1) - 1]}`;
  }
}
