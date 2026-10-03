import { useMemo } from 'react';
import Pagina, { Caricamento } from '../components/Pagina';
import Pulsante from '../components/Pulsante';
import { useDati } from '../hooks/useDati';
import { personeInRitardo, riepilogoGenerale, statiPersone } from '../logic/statistiche';
import { oggiIso } from '../utils/date';
import { dataLeggibile } from '../utils/descrizioni';
import { formattaEuro } from '../utils/formattazione';

/**
 * Report stampabile: riepilogo, chi è in ritardo e situazione di ogni persona.
 * "Stampa / Salva PDF" apre la stampa del sistema (da lì si può salvare in PDF).
 */
export default function Report() {
  const dati = useDati();
  const oggi = oggiIso();
  const calcoli = useMemo(() => {
    if (!dati) return undefined;
    const t = dati.impostazioni.giorniTolleranza;
    return {
      riepilogo: riepilogoGenerale(dati, oggi, t),
      ritardi: personeInRitardo(dati, oggi, t),
      stati: statiPersone(dati, oggi, t),
    };
  }, [dati, oggi]);
  if (!dati || !calcoli) return <Caricamento />;

  const euro = (c: number) => formattaEuro(c, dati.impostazioni.valuta);
  const futuro = !!dati.impostazioni.mostraFuturo;
  const { riepilogo, ritardi, stati } = calcoli;
  const attive = dati.persone.filter((p) => p.attivo);
  const cella = 'border border-slate-300 px-2 py-1.5 text-left';
  const numero = `${cella} text-right whitespace-nowrap`;

  return (
    <Pagina titolo="Report" indietro="/impostazioni">
      <div className="mb-4 flex flex-wrap gap-2 print:hidden">
        <Pulsante onClick={() => window.print()}>🖨️ Stampa / Salva PDF</Pulsante>
      </div>

      <article className="space-y-6 rounded-2xl bg-white p-4 text-slate-900 print:rounded-none print:p-0">
        <header>
          <h2 className="text-xl font-bold">{dati.impostazioni.nomeApp || 'Buggi'} – situazione pagamenti</h2>
          <p className="text-sm text-slate-600">Al {dataLeggibile(oggi)}</p>
        </header>

        <section>
          <h3 className="mb-2 text-lg font-bold">Riepilogo</h3>
          <table className="w-full border-collapse text-sm">
            <tbody>
              <tr>
                <th className={cella}>Persone attive</th>
                <td className={numero}>{attive.length}</td>
              </tr>
              <tr>
                <th className={cella}>Persone in ritardo</th>
                <td className={numero}>{riepilogo.personeInRitardo}</td>
              </tr>
              <tr>
                <th className={cella}>Importo in ritardo</th>
                <td className={numero}>{euro(riepilogo.importoInRitardo)}</td>
              </tr>
              <tr>
                <th className={cella}>Incassato questo mese</th>
                <td className={numero}>{euro(riepilogo.incassatoMese)}</td>
              </tr>
              {futuro && (
                <tr>
                  <th className={cella}>Da incassare questo mese</th>
                  <td className={numero}>{euro(riepilogo.daIncassareMese)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="break-inside-avoid">
          <h3 className="mb-2 text-lg font-bold">In ritardo</h3>
          {ritardi.length === 0 ? (
            <p className="text-sm">Nessuno è in ritardo.</p>
          ) : (
            <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Tabella">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className={cella}>Persona</th>
                    <th className={cella}>Telefono</th>
                    <th className={numero}>Importo</th>
                    <th className={numero}>Giorni</th>
                  </tr>
                </thead>
                <tbody>
                  {ritardi.map(({ persona, stato }) => (
                    <tr key={persona.id}>
                      <td className={cella}>{persona.nome}</td>
                      <td className={cella}>{persona.telefono ?? ''}</td>
                      <td className={numero}>{euro(stato.importoInRitardo)}</td>
                      <td className={numero}>{stato.maxGiorniRitardo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <h3 className="mb-2 text-lg font-bold">Per persona</h3>
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Tabella">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className={cella}>Persona</th>
                  <th className={numero}>Pagato</th>
                  {futuro && <th className={numero}>Da pagare</th>}
                  <th className={numero}>In ritardo</th>
                  {futuro && <th className={cella}>Prossima scadenza</th>}
                </tr>
              </thead>
              <tbody>
                {attive.map((p) => {
                  const s = stati.get(p.id)!;
                  return (
                    <tr key={p.id} className="break-inside-avoid">
                      <td className={cella}>
                        {p.nome}
                        {p.categoria && <span className="text-slate-500"> · {p.categoria}</span>}
                      </td>
                      <td className={numero}>{euro(s.totalePagato)}</td>
                      {futuro && <td className={numero}>{euro(s.daPagareOra)}</td>}
                      <td className={numero}>{s.importoInRitardo ? euro(s.importoInRitardo) : '—'}</td>
                      {futuro && (
                        <td className={cella}>
                          {s.prossimaScadenza
                            ? `${dataLeggibile(s.prossimaScadenza.scadenza.dataScadenza)} · ${euro(s.prossimaScadenza.residuo)}`
                            : '—'}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </article>
    </Pagina>
  );
}
