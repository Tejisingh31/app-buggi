import type { Persona } from '../db/tipi';
import { coloreMostrato, type StatoPersona } from '../logic/stato';
import { percorso, vai } from '../navigazione';
import { dataLeggibile } from '../utils/descrizioni';
import { formattaEuro } from '../utils/formattazione';
import BadgeStato from './BadgeStato';

type Props = {
  persona: Persona;
  stato: StatoPersona;
  valuta: string;
  /** false = solo "In regola" / "In ritardo", senza scadenze future */
  mostraFuturo: boolean;
};

const BORDO = { verde: 'border-l-green-500', giallo: 'border-l-amber-400', rosso: 'border-l-red-500' };

/** Riga dell'elenco persone: nome, stato colorato e, se è in ritardo, quanto deve. */
export default function CartaPersona({ persona, stato, valuta, mostraFuturo }: Props) {
  const colore = coloreMostrato(stato.colore, mostraFuturo);
  let importo = '';
  let dettaglio = '';
  if (!persona.attivo) {
    dettaglio = persona.categoria ?? '';
  } else if (colore === 'rosso') {
    importo = formattaEuro(stato.importoInRitardo, valuta);
    dettaglio = `da ${stato.maxGiorniRitardo} ${stato.maxGiorniRitardo === 1 ? 'giorno' : 'giorni'}`;
  } else if (!mostraFuturo) {
    // solo "In regola": niente importi futuri
  } else if (stato.daPagareOra > 0) {
    importo = formattaEuro(stato.daPagareOra, valuta);
    dettaglio = 'scaduto, in tolleranza';
  } else if (stato.prossimaScadenza) {
    importo = formattaEuro(stato.prossimaScadenza.residuo, valuta);
    dettaglio = `entro il ${dataLeggibile(stato.prossimaScadenza.scadenza.dataScadenza)}`;
  } else {
    dettaglio = 'nessuna scadenza';
  }

  return (
    <button
      type="button"
      onClick={() => vai(percorso.persona(persona.id))}
      className={`flex min-h-18 w-full items-center gap-3 rounded-2xl border border-l-8 border-slate-200 bg-white p-3 text-left active:bg-slate-50 ${
        persona.attivo ? BORDO[colore] : 'border-l-slate-300'
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-lg font-semibold text-slate-900">{persona.nome}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <BadgeStato colore={colore} archiviata={!persona.attivo} />
          {persona.categoria && persona.attivo && <span className="truncate text-sm text-slate-500">{persona.categoria}</span>}
        </div>
      </div>
      {(importo || dettaglio) && (
        <div className="shrink-0 text-right">
          {importo && <p className={`text-lg font-bold ${colore === 'rosso' ? 'text-red-700' : 'text-slate-900'}`}>{importo}</p>}
          <p className="text-sm text-slate-500">{dettaglio}</p>
        </div>
      )}
    </button>
  );
}
