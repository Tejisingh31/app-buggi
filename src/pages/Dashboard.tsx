import { lazy, Suspense, useMemo, useState } from 'react';
import Contatti from '../components/Contatti';
import { usePagamenti } from '../components/GestorePagamenti';
import Pagina, { Caricamento, StatoVuoto } from '../components/Pagina';
import Pulsante from '../components/Pulsante';
import { useDati } from '../hooks/useDati';
import { incassiUltimi12Mesi, personeInRitardo, riepilogoGenerale } from '../logic/statistiche';
import { percorso, vai } from '../navigazione';
import { oggiIso } from '../utils/date';
import { formattaEuro } from '../utils/formattazione';
import PromemoriaBackup from '../components/PromemoriaBackup';

// Il grafico si carica a parte, così l'app si apre più in fretta.
const GraficoIncassi = lazy(() => import('../components/GraficoIncassi'));

export default function Dashboard() {
  const dati = useDati();
  const { apriPagamento } = usePagamenti();
  const [elencoAperto, setElencoAperto] = useState(false);
  const oggi = oggiIso();

  const calcoli = useMemo(() => {
    if (!dati) return undefined;
    const t = dati.impostazioni.giorniTolleranza;
    return {
      riepilogo: riepilogoGenerale(dati, oggi, t),
      ritardi: personeInRitardo(dati, oggi, t),
      mesi: incassiUltimi12Mesi(dati.pagamenti, oggi),
    };
  }, [dati, oggi]);

  if (!dati || !calcoli) return <Caricamento />;
  const valuta = dati.impostazioni.valuta;
  const euro = (c: number) => formattaEuro(c, valuta);
  const { riepilogo, ritardi, mesi } = calcoli;

  return (
    <Pagina titolo={dati.impostazioni.nomeApp || 'Buggi'} logo>
      <PromemoriaBackup dati={dati} />

      {dati.persone.length === 0 ? (
        <StatoVuoto titolo="Benvenuto!" testo="Aggiungi le persone che devono pagare: qui vedrai subito chi è in ritardo e quanto hai incassato.">
          <Pulsante onClick={() => vai(percorso.nuovaPersona())}>Aggiungi la prima persona</Pulsante>
        </StatoVuoto>
      ) : (
        <>
          {/* Riquadro principale: chi non ha pagato */}
          {ritardi.length > 0 ? (
            <div className="rounded-2xl bg-[#b91c1c] text-[#fff] shadow-sm">
              <button
                type="button"
                onClick={() => setElencoAperto((a) => !a)}
                aria-expanded={elencoAperto}
                className="flex w-full items-center gap-3 rounded-2xl p-4 text-left active:brightness-95"
              >
                <div className="flex-1">
                  <p className="text-base font-medium">Non hanno pagato</p>
                  <p className="text-2xl font-bold">
                    {ritardi.length} {ritardi.length === 1 ? 'persona' : 'persone'} · {euro(riepilogo.importoInRitardo)}
                  </p>
                  <p className="mt-1 text-sm">{elencoAperto ? 'Tocca per chiudere' : 'Tocca per vedere chi'}</p>
                </div>
                <svg viewBox="0 0 24 24" className={`h-8 w-8 transition-transform ${elencoAperto ? 'rotate-180' : ''}`} fill="currentColor" aria-hidden="true">
                  <path d="M7.4 8.6 12 13.2l4.6-4.6L18 10l-6 6-6-6Z" />
                </svg>
              </button>
            </div>
          ) : (
            <div className="rounded-2xl bg-[#15803d] p-4 text-[#fff]">
              <p className="text-2xl font-bold">✓ Tutti in regola</p>
              <p className="text-base">Nessuno è in ritardo con i pagamenti.</p>
            </div>
          )}

          {elencoAperto && ritardi.length > 0 && (
            <ul className="mt-2 divide-y divide-slate-100 rounded-2xl border border-red-200 bg-white">
              {ritardi.map(({ persona, stato }) => (
                <li key={persona.id} className="flex flex-wrap items-center gap-2 p-3">
                  <button type="button" onClick={() => vai(percorso.persona(persona.id))} className="min-w-[55%] flex-1 text-left">
                    <p className="truncate text-lg font-semibold text-slate-900">{persona.nome}</p>
                    <p className="text-base">
                      <strong className="text-red-700">{euro(stato.importoInRitardo)}</strong>{' '}
                      <span className="text-sm text-slate-500">
                        da {stato.maxGiorniRitardo} {stato.maxGiorniRitardo === 1 ? 'giorno' : 'giorni'}
                      </span>
                    </p>
                  </button>
                  <div className="ml-auto flex gap-2">
                    <Contatti telefono={persona.telefono} nome={persona.nome} />
                  <Pulsante
                    variante="secondario"
                    className="shrink-0 border-green-600 px-3 text-green-800"
                    onClick={() => apriPagamento({ personaId: persona.id })}
                  >
                    ✓ Pagato
                  </Pulsante>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* Numeri del mese */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Scheda etichetta="Incassato questo mese" valore={euro(riepilogo.incassatoMese)} colore="text-green-700" />
            {dati.impostazioni.mostraFuturo && <Scheda etichetta="Da incassare questo mese" valore={euro(riepilogo.daIncassareMese)} />}
            <Scheda etichetta="In ritardo" valore={euro(riepilogo.importoInRitardo)} colore={riepilogo.importoInRitardo ? 'text-red-700' : undefined} />
            <Scheda
              etichetta="Persone in ritardo"
              valore={String(riepilogo.personeInRitardo)}
              colore={riepilogo.personeInRitardo ? 'text-red-700' : undefined}
              onClick={() => vai('/mancanti')}
            />
          </div>

          {/* Grafico */}
          <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="text-lg font-bold text-slate-900">Incassi ultimi 12 mesi</h2>
            <p className="mb-2 text-sm text-slate-500">Totale: {euro(mesi.reduce((t, m) => t + m.totale, 0))}</p>
            <Suspense fallback={<div className="h-56" />}>
              <GraficoIncassi mesi={mesi} valuta={valuta} />
            </Suspense>
          </section>
        </>
      )}
    </Pagina>
  );
}

function Scheda({ etichetta, valore, colore, onClick }: { etichetta: string; valore: string; colore?: string; onClick?: () => void }) {
  const contenuto = (
    <>
      <p className="text-sm text-slate-600">{etichetta}</p>
      <p className={`text-xl font-bold ${colore ?? 'text-slate-900'}`}>{valore}</p>
    </>
  );
  const stile = 'rounded-2xl border border-slate-200 bg-white p-3 text-left';
  return onClick ? (
    <button type="button" onClick={onClick} className={`${stile} active:bg-slate-50`}>
      {contenuto}
    </button>
  ) : (
    <div className={stile}>{contenuto}</div>
  );
}
