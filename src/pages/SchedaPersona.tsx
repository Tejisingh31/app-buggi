import { useMemo, useState, type ReactNode } from 'react';
import BadgeStato from '../components/BadgeStato';
import Conferma from '../components/Conferma';
import { usePagamenti } from '../components/GestorePagamenti';
import Pagina, { Caricamento, StatoVuoto } from '../components/Pagina';
import Pulsante, { stileLinkPulsante } from '../components/Pulsante';
import { eliminaPagamento, impostaPersonaAttiva, sincronizzaScadenze } from '../db/repository';
import type { MetodoPagamento, Pagamento } from '../db/tipi';
import { useDati } from '../hooks/useDati';
import { coloreMostrato, statoPersona, type CalcoloScadenza } from '../logic/stato';
import { percorso, vai } from '../navigazione';
import { oggiIso } from '../utils/date';
import { dataLeggibile, descriviRegola } from '../utils/descrizioni';
import { formattaEuro } from '../utils/formattazione';
import { linkChiamata, linkWhatsApp } from '../utils/telefono';

const METODI: Record<MetodoPagamento, string> = {
  contanti: 'Contanti',
  bonifico: 'Bonifico',
  carta: 'Carta',
  altro: 'Altro',
};

export default function SchedaPersona({ id }: { id: string }) {
  const dati = useDati();
  const oggi = oggiIso();
  const { apriPagamento } = usePagamenti();
  const [daEliminare, setDaEliminare] = useState<Pagamento | null>(null);

  const calcolo = useMemo(() => {
    if (!dati) return undefined;
    const persona = dati.persone.find((p) => p.id === id);
    if (!persona) return null;
    const scadenze = dati.scadenze.filter((s) => s.personaId === id);
    const pagamenti = dati.pagamenti
      .filter((p) => p.personaId === id)
      .sort((a, b) => b.dataPagamento.localeCompare(a.dataPagamento) || b.creatoIl.localeCompare(a.creatoIl));
    const piani = dati.piani
      .filter((p) => p.personaId === id)
      .sort((a, b) => a.descrizione.localeCompare(b.descrizione, 'it'));
    return { persona, piani, pagamenti, stato: statoPersona(scadenze, pagamenti, oggi, dati.impostazioni.giorniTolleranza) };
  }, [dati, id, oggi]);

  if (calcolo === undefined || !dati) return <Caricamento />;
  if (calcolo === null) {
    return (
      <Pagina titolo="Persona" indietro={percorso.persone()}>
        <StatoVuoto titolo="Persona non trovata" testo="Forse è stata eliminata." />
      </Pagina>
    );
  }

  const { persona, piani, pagamenti, stato } = calcolo;
  const valuta = dati.impostazioni.valuta;
  const euro = (c: number) => formattaEuro(c, valuta);
  const nomePiano = new Map(piani.map((p) => [p.id, p.descrizione]));
  const dataScadenza = new Map(stato.scadenze.map((c) => [c.scadenza.id, c.scadenza.dataScadenza]));
  const mostraFuturo = !!dati.impostazioni.mostraFuturo;
  const colore = coloreMostrato(stato.colore, mostraFuturo);
  // senza scadenze future si vedono solo quelle in ritardo
  const aperte = stato.scadenze.filter(
    (c) => c.residuo > 0 && c.scadenza.dataScadenza <= oggi && (mostraFuturo || c.stato === 'inRitardo'),
  );

  async function riattiva() {
    await impostaPersonaAttiva(persona.id, true);
    await sincronizzaScadenze();
  }

  return (
    <Pagina
      titolo={persona.nome}
      indietro={percorso.persone()}
      azione={
        <Pulsante variante="leggero" onClick={() => vai(percorso.modificaPersona(persona.id))}>
          Modifica
        </Pulsante>
      }
    >
      <div className="-mt-1 mb-4 flex flex-wrap items-center gap-2">
        <BadgeStato colore={colore} archiviata={!persona.attivo} />
        {persona.categoria && <span className="text-base text-slate-600">{persona.categoria}</span>}
      </div>

      {!persona.attivo && (
        <div className="mb-4 rounded-2xl bg-slate-200 p-4">
          <p className="text-base text-slate-800">Questa persona è archiviata: non vengono create nuove scadenze.</p>
          <Pulsante variante="secondario" className="mt-3" onClick={riattiva}>
            Riattiva
          </Pulsante>
        </div>
      )}

      {persona.telefono && (
        <div className="mb-4 flex gap-2">
          <a href={linkChiamata(persona.telefono)} className={stileLinkPulsante}>
            📞 Chiama
          </a>
          <a href={linkWhatsApp(persona.telefono)} target="_blank" rel="noopener noreferrer" className={stileLinkPulsante}>
            💬 WhatsApp
          </a>
        </div>
      )}

      {persona.attivo && (
        <Pulsante largo className="mb-4 min-h-14 text-lg" onClick={() => apriPagamento({ personaId: persona.id })}>
          ✓ Segna pagato
        </Pulsante>
      )}

      {/* Mini-dashboard */}
      <div className="grid grid-cols-2 gap-2">
        <Riquadro etichetta="Pagato in totale" valore={euro(stato.totalePagato)} />
        {mostraFuturo && (
          <Riquadro
            etichetta="Da pagare ora"
            valore={euro(stato.daPagareOra)}
            tono={stato.daPagareOra > 0 ? (stato.colore === 'rosso' ? 'rosso' : 'giallo') : undefined}
          />
        )}
        <Riquadro
          etichetta="In ritardo"
          valore={euro(stato.importoInRitardo)}
          nota={stato.scadenzeInRitardo > 0 ? `da ${stato.maxGiorniRitardo} ${stato.maxGiorniRitardo === 1 ? 'giorno' : 'giorni'}` : undefined}
          tono={stato.importoInRitardo > 0 ? 'rosso' : undefined}
        />
        {mostraFuturo && (
          <Riquadro
            etichetta="Prossima scadenza"
            valore={stato.prossimaScadenza ? euro(stato.prossimaScadenza.residuo) : '—'}
            nota={stato.prossimaScadenza ? dataLeggibile(stato.prossimaScadenza.scadenza.dataScadenza) : 'nessuna'}
          />
        )}
      </div>
      {stato.credito > 0 && (
        <p className="mt-2 rounded-xl bg-green-50 p-3 text-base text-green-900">
          Ha un credito di <strong>{euro(stato.credito)}</strong> (pagato più del dovuto).
        </p>
      )}

      {/* Scadenze da pagare */}
      {aperte.length > 0 && (
        <Sezione titolo={mostraFuturo ? 'Da pagare' : 'In ritardo'}>
          <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
            {aperte.map((c) => (
              <RigaScadenza
                key={c.scadenza.id}
                calcolo={c}
                descrizione={nomePiano.get(c.scadenza.pianoId)}
                euro={euro}
                onPagato={() => apriPagamento({ personaId: persona.id, scadenzaId: c.scadenza.id })}
              />
            ))}
          </ul>
        </Sezione>
      )}

      {/* Quote */}
      <Sezione
        titolo="Quote"
        azione={
          <Pulsante variante="leggero" onClick={() => vai(percorso.nuovoPiano(persona.id))}>
            + Aggiungi
          </Pulsante>
        }
      >
        {piani.length === 0 ? (
          <StatoVuoto titolo="Nessuna quota" testo="Aggiungi una quota per indicare quanto deve pagare e quando.">
            <Pulsante onClick={() => vai(percorso.nuovoPiano(persona.id))}>Aggiungi quota</Pulsante>
          </StatoVuoto>
        ) : (
          <ul className="space-y-2">
            {piani.map((p) => {
              const concluso = (p.frequenza === 'singola' ? p.dataInizio : p.dataFine ?? '9999') < oggi;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => vai(percorso.modificaPiano(persona.id, p.id))}
                    className="flex min-h-16 w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left active:bg-slate-50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-semibold text-slate-900">
                        {p.descrizione}
                        {concluso && <span className="ml-2 text-sm font-normal text-slate-500">(conclusa)</span>}
                      </p>
                      <p className="text-sm text-slate-600">
                        {descriviRegola(p)}
                        {p.dataFine && p.frequenza !== 'singola' && `, fino al ${dataLeggibile(p.dataFine)}`}
                      </p>
                    </div>
                    <p className="shrink-0 text-lg font-bold text-slate-900">{euro(p.importo)}</p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Sezione>

      {/* Storico pagamenti */}
      <Sezione titolo="Storico pagamenti">
        {pagamenti.length === 0 ? (
          <StatoVuoto titolo="Nessun pagamento registrato" />
        ) : (
          <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
            {pagamenti.map((p) => {
              const riferimento = p.scadenzaId && dataScadenza.get(p.scadenzaId);
              return (
                <li key={p.id} className="flex items-start gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-semibold text-slate-900">{dataLeggibile(p.dataPagamento)}</p>
                    <p className="text-sm text-slate-600">
                      {METODI[p.metodo]}
                      {riferimento ? ` · scadenza del ${dataLeggibile(riferimento)}` : ' · acconto'}
                    </p>
                    {p.nota && <p className="text-sm text-slate-500 italic">{p.nota}</p>}
                  </div>
                  <p className="shrink-0 text-lg font-bold text-green-700">{euro(p.importo)}</p>
                  <button
                    type="button"
                    onClick={() => setDaEliminare(p)}
                    aria-label={`Elimina il pagamento del ${dataLeggibile(p.dataPagamento)}`}
                    className="-my-2 -mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-400 active:bg-slate-100"
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
                      <path d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6ZM19 4h-3.5l-1-1h-5l-1 1H5v2h14Z" />
                    </svg>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Sezione>

      {(persona.email || persona.note) && (
        <Sezione titolo="Altre informazioni">
          <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 text-base">
            {persona.telefono && <p className="text-slate-700">Telefono: {persona.telefono}</p>}
            {persona.email && (
              <p className="break-all text-slate-700">
                Email: <a href={`mailto:${persona.email}`} className="text-teal-700 underline">{persona.email}</a>
              </p>
            )}
            {persona.note && <p className="whitespace-pre-wrap text-slate-700">{persona.note}</p>}
          </div>
        </Sezione>
      )}

      <Conferma
        aperta={!!daEliminare}
        titolo="Eliminare questo pagamento?"
        testo={
          daEliminare
            ? `Pagamento di ${euro(daEliminare.importo)} del ${dataLeggibile(daEliminare.dataPagamento)}. La scadenza tornerà da pagare.`
            : ''
        }
        etichettaConferma="Elimina pagamento"
        pericolo
        onConferma={async () => {
          if (daEliminare) await eliminaPagamento(daEliminare.id);
          setDaEliminare(null);
        }}
        onAnnulla={() => setDaEliminare(null)}
      />
    </Pagina>
  );
}

const TONI = {
  rosso: 'bg-red-50 text-red-800',
  giallo: 'bg-amber-50 text-amber-900',
};

function Riquadro({ etichetta, valore, nota, tono }: { etichetta: string; valore: string; nota?: string; tono?: keyof typeof TONI }) {
  return (
    <div className={`rounded-2xl border border-slate-200 p-3 ${tono ? TONI[tono] : 'bg-white text-slate-900'}`}>
      <p className="text-sm opacity-80">{etichetta}</p>
      <p className="text-xl font-bold">{valore}</p>
      {nota && <p className="text-sm opacity-80">{nota}</p>}
    </div>
  );
}

function Sezione({ titolo, azione, children }: { titolo: string; azione?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-6">
      <div className="mb-2 flex min-h-11 items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900">{titolo}</h2>
        {azione}
      </div>
      {children}
    </section>
  );
}

function RigaScadenza({
  calcolo,
  descrizione,
  euro,
  onPagato,
}: {
  calcolo: CalcoloScadenza;
  descrizione?: string;
  euro: (c: number) => string;
  onPagato: () => void;
}) {
  const { scadenza, residuo, stato, parziale, giorniRitardo, pagato } = calcolo;
  return (
    <li className="flex items-center gap-3 p-3">
      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold text-slate-900">
          {dataLeggibile(scadenza.dataScadenza)}
          {descrizione && <span className="font-normal text-slate-600"> · {descrizione}</span>}
        </p>
        <p className={`text-sm ${stato === 'inRitardo' ? 'text-red-700' : 'text-amber-800'}`}>
          {stato === 'inRitardo' ? `In ritardo di ${giorniRitardo} ${giorniRitardo === 1 ? 'giorno' : 'giorni'}` : 'Scaduta, in tolleranza'}
          {parziale && ` · pagato ${euro(pagato)} su ${euro(scadenza.importoDovuto)}`}
        </p>
        <p className={`text-lg font-bold ${stato === 'inRitardo' ? 'text-red-700' : 'text-slate-900'}`}>{euro(residuo)}</p>
      </div>
      <Pulsante variante="secondario" className="shrink-0 border-green-600 text-green-800" onClick={onPagato}>
        ✓ Pagato
      </Pulsante>
    </li>
  );
}
