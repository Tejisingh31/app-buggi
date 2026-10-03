import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { eliminaPagamento } from '../db/repository';
import type { Pagamento } from '../db/tipi';
import { useDati, type Dati } from '../hooks/useDati';
import { statiPersone } from '../logic/statistiche';
import { percorso, vai } from '../navigazione';
import { oggiIso } from '../utils/date';
import { formattaEuro } from '../utils/formattazione';
import { corrisponde } from '../utils/testo';
import BarraRicerca from './BarraRicerca';
import Foglio from './Foglio';
import FoglioPagamento from './FoglioPagamento';
import { StatoVuoto } from './Pagina';
import Pulsante from './Pulsante';

type Richiesta = { personaId?: string; scadenzaId?: string };

const ContestoPagamenti = createContext<{ apriPagamento: (r?: Richiesta) => void }>({ apriPagamento: () => {} });

/** Per aprire il foglio "Pagato" da qualsiasi pagina. */
export const usePagamenti = () => useContext(ContestoPagamenti);

const DURATA_ANNULLA = 5000;

/**
 * Contiene il pulsante "+" sempre visibile, il foglio di pagamento
 * e l'avviso con "Annulla" che resta 5 secondi dopo ogni pagamento.
 */
export default function GestorePagamenti({ children }: { children: ReactNode }) {
  const dati = useDati();
  const [richiesta, setRichiesta] = useState<Richiesta | null>(null);
  const [avviso, setAvviso] = useState<{ testo: string; pagamentoId?: string } | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const mostraAvviso = useCallback((testo: string, pagamentoId?: string) => {
    window.clearTimeout(timer.current);
    setAvviso({ testo, pagamentoId });
    timer.current = window.setTimeout(() => setAvviso(null), pagamentoId ? DURATA_ANNULLA : 2500);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const apriPagamento = useCallback((r: Richiesta = {}) => setRichiesta(r), []);
  const contesto = useMemo(() => ({ apriPagamento }), [apriPagamento]);

  function registrato(p: Pagamento, nome: string) {
    setRichiesta(null);
    mostraAvviso(`Pagamento di ${nome} registrato: ${formattaEuro(p.importo, dati?.impostazioni.valuta)}`, p.id);
  }

  async function annulla() {
    if (!avviso?.pagamentoId) return;
    await eliminaPagamento(avviso.pagamentoId);
    mostraAvviso('Pagamento annullato');
  }

  return (
    <ContestoPagamenti.Provider value={contesto}>
      {children}

      <button
        type="button"
        onClick={() => apriPagamento()}
        aria-label="Registra un pagamento"
        className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-20 flex h-16 w-16 items-center justify-center rounded-full bg-[#0f766e] text-[#fff] shadow-lg active:brightness-90 print:hidden"
      >
        <svg viewBox="0 0 24 24" className="h-9 w-9" fill="currentColor" aria-hidden="true">
          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6Z" />
        </svg>
      </button>

      {richiesta && dati && !richiesta.personaId && (
        <SceltaPersona dati={dati} onScelta={(personaId) => setRichiesta({ personaId })} onChiudi={() => setRichiesta(null)} />
      )}
      {richiesta?.personaId && dati && (
        <FoglioPagamento
          dati={dati}
          personaId={richiesta.personaId}
          scadenzaId={richiesta.scadenzaId}
          onChiudi={() => setRichiesta(null)}
          onRegistrato={registrato}
        />
      )}

      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(9.5rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-4"
      >
        {avviso && (
          <div className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl bg-[#0f172a] py-2 pr-2 pl-4 text-base text-[#f8fafc] shadow-xl ring-1 ring-[#334155]">
            <p className="min-w-0 flex-1">{avviso.testo}</p>
            {avviso.pagamentoId && (
              <button
                type="button"
                onClick={annulla}
                className="min-h-11 shrink-0 rounded-xl px-3 font-bold text-[#5eead4] active:bg-[#334155]"
              >
                Annulla
              </button>
            )}
          </div>
        )}
      </div>
    </ContestoPagamenti.Provider>
  );
}

/** Primo passo del pulsante "+": chi ha pagato? Prima chi è in ritardo o deve pagare. */
function SceltaPersona({ dati, onScelta, onChiudi }: { dati: Dati; onScelta: (id: string) => void; onChiudi: () => void }) {
  const [cerca, setCerca] = useState('');
  const oggi = oggiIso();
  const stati = useMemo(() => statiPersone(dati, oggi, dati.impostazioni.giorniTolleranza), [dati, oggi]);
  const priorita = (id: string) => {
    const s = stati.get(id);
    return s?.colore === 'rosso' ? 0 : s && s.daPagareOra > 0 ? 1 : 2;
  };
  const elenco = dati.persone
    .filter((p) => p.attivo && corrisponde(cerca, [p.nome, p.categoria, p.telefono]))
    .sort((a, b) => priorita(a.id) - priorita(b.id));

  return (
    <Foglio titolo="Chi ha pagato?" onChiudi={onChiudi}>
      <BarraRicerca valore={cerca} onCambia={setCerca} segnaposto="Cerca persona…" />
      <div className="mt-3">
        {dati.persone.filter((p) => p.attivo).length === 0 ? (
          <StatoVuoto titolo="Nessuna persona" testo="Prima aggiungi una persona.">
            <Pulsante
              onClick={() => {
                onChiudi();
                vai(percorso.nuovaPersona());
              }}
            >
              Aggiungi persona
            </Pulsante>
          </StatoVuoto>
        ) : elenco.length === 0 ? (
          <StatoVuoto titolo="Nessun risultato" testo={`Nessuna persona corrisponde a «${cerca}».`} />
        ) : (
          <ul className="divide-y divide-slate-100">
            {elenco.map((p) => {
              const s = stati.get(p.id);
              const dovuto = s?.daPagareOra || s?.prossimaScadenza?.residuo || 0;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => onScelta(p.id)}
                    className="flex min-h-14 w-full items-center gap-3 px-1 py-2 text-left active:bg-slate-50"
                  >
                    <span className="min-w-0 flex-1 truncate text-lg font-medium text-slate-900">{p.nome}</span>
                    {dovuto > 0 && (
                      <span className={`shrink-0 text-base font-semibold ${s?.colore === 'rosso' ? 'text-red-700' : 'text-slate-600'}`}>
                        {formattaEuro(dovuto, dati.impostazioni.valuta)}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Foglio>
  );
}
