import { useState, type FormEvent } from 'react';
import { getDaysInMonth } from 'date-fns';
import Campo, { SceltaGrande, stileInput } from '../components/Campo';
import Conferma from '../components/Conferma';
import Pagina, { Caricamento, StatoVuoto } from '../components/Pagina';
import Pulsante from '../components/Pulsante';
import { aggiornaPiano, creaPiano, eliminaPiano, sincronizzaScadenze } from '../db/repository';
import type { Persona, Piano } from '../db/tipi';
import { useDati } from '../hooks/useDati';
import { anteprimaScadenze, dateScadenzePiano, type RegolaScadenza } from '../logic/scadenze';
import { percorso, vai } from '../navigazione';
import { oggiIso } from '../utils/date';
import { dataLeggibile, descriviRegola, GIORNI_SETTIMANA, MESI } from '../utils/descrizioni';
import { formattaEuro } from '../utils/formattazione';
import { importoPerInput, leggiImporto } from '../utils/importi';

type Tipo = 'una' | 'ripete';
type Ripetizione = 'mensile' | 'settimanale' | 'annuale' | 'ogniNMesi';

const RIPETIZIONI: { valore: Ripetizione; testo: string }[] = [
  { valore: 'mensile', testo: 'Ogni mese' },
  { valore: 'settimanale', testo: 'Ogni settimana' },
  { valore: 'annuale', testo: 'Ogni anno' },
  { valore: 'ogniNMesi', testo: 'Ogni N mesi' },
];

const GIORNI_MESE = Array.from({ length: 31 }, (_, i) => i + 1);

/** Crea una nuova quota per la persona (senza pianoId) o modifica quella indicata. */
export default function ModuloPiano({ personaId, pianoId }: { personaId: string; pianoId?: string }) {
  const dati = useDati();
  if (!dati) return <Caricamento />;
  const persona = dati.persone.find((p) => p.id === personaId);
  const piano = pianoId ? dati.piani.find((p) => p.id === pianoId) : undefined;
  if (!persona || (pianoId && !piano)) {
    return (
      <Pagina titolo="Quota" indietro={persona ? percorso.persona(persona.id) : percorso.persone()}>
        <StatoVuoto titolo="Quota non trovata" testo="Forse è stata eliminata." />
      </Pagina>
    );
  }
  return <Modulo key={pianoId ?? 'nuovo'} persona={persona} piano={piano} valuta={dati.impostazioni.valuta} />;
}

function Modulo({ persona, piano, valuta }: { persona: Persona; piano?: Piano; valuta: string }) {
  const oggi = oggiIso();
  const f = piano?.frequenza;
  const [descrizione, setDescrizione] = useState(piano?.descrizione ?? '');
  const [importoTesto, setImportoTesto] = useState(piano ? importoPerInput(piano.importo) : '');
  const [tipo, setTipo] = useState<Tipo>(f === 'singola' ? 'una' : piano ? 'ripete' : 'una');
  const [ripetizione, setRipetizione] = useState<Ripetizione>(f && f !== 'singola' ? f : 'mensile');
  const [dataSingola, setDataSingola] = useState(f === 'singola' ? piano!.dataInizio : oggi);
  const [dataInizio, setDataInizio] = useState(f && f !== 'singola' ? piano!.dataInizio : oggi);
  const [conFine, setConFine] = useState(!!piano?.dataFine && f !== 'singola');
  const [dataFine, setDataFine] = useState(piano?.dataFine ?? '');
  const [giornoMese, setGiornoMese] = useState(
    f === 'mensile' || f === 'ogniNMesi' || f === 'annuale' ? piano!.giornoScadenza! : 1,
  );
  const [giornoSettimana, setGiornoSettimana] = useState(f === 'settimanale' ? piano!.giornoScadenza! : 1);
  const [meseAnno, setMeseAnno] = useState(f === 'annuale' ? piano!.meseScadenza! : 1);
  const [intervallo, setIntervallo] = useState(String(piano?.intervalloMesi ?? 3));
  const [errori, setErrori] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);
  const [chiediElimina, setChiediElimina] = useState(false);

  // Giorni possibili nel mese scelto per la quota annuale (febbraio: fino al 29).
  const maxGiornoAnno = meseAnno === 2 ? 29 : getDaysInMonth(new Date(2026, meseAnno - 1, 1));

  /** La regola delle scadenze come scritta nel modulo, o un errore. */
  function costruisciRegola(): { regola?: RegolaScadenza; errore?: [string, string] } {
    if (tipo === 'una') {
      if (!dataSingola) return { errore: ['data', 'Scegli la data'] };
      return { regola: { frequenza: 'singola', dataInizio: dataSingola } };
    }
    if (!dataInizio) return { errore: ['inizio', 'Scegli da quando parte'] };
    if (conFine && !dataFine) return { errore: ['fine', 'Scegli la data di fine o togli la spunta'] };
    if (conFine && dataFine < dataInizio) return { errore: ['fine', 'La fine è prima dell’inizio'] };
    const base = { dataInizio, dataFine: conFine ? dataFine : undefined };
    switch (ripetizione) {
      case 'mensile':
        return { regola: { ...base, frequenza: 'mensile', giornoScadenza: giornoMese } };
      case 'settimanale':
        return { regola: { ...base, frequenza: 'settimanale', giornoScadenza: giornoSettimana } };
      case 'annuale':
        return { regola: { ...base, frequenza: 'annuale', giornoScadenza: Math.min(giornoMese, maxGiornoAnno), meseScadenza: meseAnno } };
      case 'ogniNMesi': {
        const n = Number(intervallo);
        if (!Number.isInteger(n) || n < 1 || n > 120) return { errore: ['intervallo', 'Scrivi un numero di mesi da 1 a 120'] };
        return { regola: { ...base, frequenza: 'ogniNMesi', intervalloMesi: n, giornoScadenza: giornoMese } };
      }
    }
  }

  const { regola, errore: erroreRegola } = costruisciRegola();
  const prossime = regola ? anteprimaScadenze(regola, oggi, 3) : [];
  const passate = regola && !piano ? dateScadenzePiano(regola, oggi).filter((d) => d < oggi) : [];
  const importo = leggiImporto(importoTesto);

  async function salva(e: FormEvent) {
    e.preventDefault();
    const nuoviErrori: Record<string, string> = {};
    if (importo === null) nuoviErrori.importo = 'Scrivi un importo valido, es. 50 oppure 12,50';
    if (erroreRegola) nuoviErrori[erroreRegola[0]] = erroreRegola[1];
    setErrori(nuoviErrori);
    if (Object.keys(nuoviErrori).length || !regola || importo === null) return;

    setSalvando(true);
    // I campi non usati dal tipo scelto vanno svuotati (es. passando da annuale a mensile).
    const campi = {
      descrizione: descrizione.trim() || (regola.frequenza === 'singola' ? 'Pagamento' : 'Quota'),
      importo,
      frequenza: regola.frequenza,
      dataInizio: regola.dataInizio,
      dataFine: regola.dataFine,
      giornoScadenza: regola.giornoScadenza,
      meseScadenza: regola.meseScadenza,
      intervalloMesi: regola.intervalloMesi,
    };
    try {
      if (piano) {
        await aggiornaPiano(piano.id, campi, oggi);
      } else {
        const nuovo = await creaPiano({ ...campi, personaId: persona.id });
        await sincronizzaScadenze(oggi, nuovo.id);
      }
      vai(percorso.persona(persona.id), true);
    } catch (err) {
      setErrori({ generale: err instanceof Error ? err.message : 'Salvataggio non riuscito' });
      setSalvando(false);
    }
  }

  async function elimina() {
    if (!piano) return;
    await eliminaPiano(piano.id);
    vai(percorso.persona(persona.id), true);
  }

  const stileSelect = `${stileInput} appearance-auto`;

  return (
    <Pagina titolo={piano ? 'Modifica quota' : 'Nuova quota'} indietro={percorso.persona(persona.id)}>
      <p className="-mt-2 mb-4 text-base text-slate-600">
        Per <strong className="text-slate-900">{persona.nome}</strong>
      </p>

      <form onSubmit={salva} className="space-y-5" noValidate>
        <Campo etichetta="Descrizione" per="descrizione">
          <input
            id="descrizione"
            className={stileInput}
            value={descrizione}
            onChange={(e) => setDescrizione(e.target.value)}
            placeholder="Es. Quota mensile"
            autoComplete="off"
          />
        </Campo>

        <Campo etichetta={`Importo (${valuta}) *`} per="importo" errore={errori.importo}>
          <input
            id="importo"
            inputMode="decimal"
            className={`${stileInput} text-xl font-semibold`}
            value={importoTesto}
            onChange={(e) => setImportoTesto(e.target.value)}
            placeholder="0,00"
            autoComplete="off"
          />
        </Campo>

        <fieldset className="space-y-3">
          <legend className="mb-1 text-base font-medium text-slate-700">Quando si paga?</legend>
          <SceltaGrande
            etichetta="Quando si paga"
            valore={tipo}
            onCambia={setTipo}
            opzioni={[
              { valore: 'una', testo: 'Una data' },
              { valore: 'ripete', testo: 'Si ripete' },
            ]}
          />

          {tipo === 'una' ? (
            <Campo etichetta="Data" per="data" errore={errori.data}>
              <input id="data" type="date" className={stileInput} value={dataSingola} onChange={(e) => setDataSingola(e.target.value)} />
            </Campo>
          ) : (
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
              <SceltaGrande etichetta="Ogni quanto" valore={ripetizione} onCambia={setRipetizione} opzioni={RIPETIZIONI} colonne={2} />

              {ripetizione === 'ogniNMesi' && (
                <Campo etichetta="Ogni quanti mesi" per="intervallo" errore={errori.intervallo}>
                  <input
                    id="intervallo"
                    inputMode="numeric"
                    className={stileInput}
                    value={intervallo}
                    onChange={(e) => setIntervallo(e.target.value.replace(/\D/g, ''))}
                  />
                </Campo>
              )}

              {(ripetizione === 'mensile' || ripetizione === 'ogniNMesi') && (
                <Campo
                  etichetta="Giorno del mese"
                  per="giorno"
                  aiuto={giornoMese > 28 ? 'Nei mesi più corti si usa l’ultimo giorno del mese.' : undefined}
                >
                  <select id="giorno" className={stileSelect} value={giornoMese} onChange={(e) => setGiornoMese(Number(e.target.value))}>
                    {GIORNI_MESE.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </Campo>
              )}

              {ripetizione === 'settimanale' && (
                <Campo etichetta="Giorno della settimana" per="settimana">
                  <select
                    id="settimana"
                    className={stileSelect}
                    value={giornoSettimana}
                    onChange={(e) => setGiornoSettimana(Number(e.target.value))}
                  >
                    {GIORNI_SETTIMANA.map((g) => (
                      <option key={g.valore} value={g.valore}>
                        {g.nome}
                      </option>
                    ))}
                  </select>
                </Campo>
              )}

              {ripetizione === 'annuale' && (
                <div className="grid grid-cols-[1fr_2fr] gap-2">
                  <Campo etichetta="Giorno" per="giorno-anno">
                    <select
                      id="giorno-anno"
                      className={stileSelect}
                      value={Math.min(giornoMese, maxGiornoAnno)}
                      onChange={(e) => setGiornoMese(Number(e.target.value))}
                    >
                      {GIORNI_MESE.slice(0, maxGiornoAnno).map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </Campo>
                  <Campo etichetta="Mese" per="mese-anno">
                    <select id="mese-anno" className={stileSelect} value={meseAnno} onChange={(e) => setMeseAnno(Number(e.target.value))}>
                      {MESI.map((m, i) => (
                        <option key={m} value={i + 1}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </Campo>
                </div>
              )}

              <Campo etichetta="A partire dal" per="inizio" errore={errori.inizio}>
                <input id="inizio" type="date" className={stileInput} value={dataInizio} onChange={(e) => setDataInizio(e.target.value)} />
              </Campo>

              <label className="flex min-h-11 items-center gap-3 text-base text-slate-700">
                <input type="checkbox" className="h-6 w-6 accent-teal-600" checked={conFine} onChange={(e) => setConFine(e.target.checked)} />
                Ha una data di fine
              </label>
              {conFine && (
                <Campo etichetta="Fino al" per="fine" errore={errori.fine}>
                  <input id="fine" type="date" className={stileInput} value={dataFine} onChange={(e) => setDataFine(e.target.value)} />
                </Campo>
              )}
            </div>
          )}
        </fieldset>

        {/* Anteprima: si aggiorna mentre si compila */}
        <div className="rounded-2xl bg-teal-50 p-4 text-teal-950" aria-live="polite">
          {regola ? (
            <>
              <p className="font-semibold">
                {descriviRegola(regola)}
                {importo !== null && importo > 0 && ` · ${formattaEuro(importo, valuta)}`}
              </p>
              {prossime.length > 0 ? (
                <>
                  <p className="mt-2 text-sm">{prossime.length === 1 ? 'Prossima scadenza:' : `Prossime ${prossime.length} scadenze:`}</p>
                  <ul className="mt-1 flex flex-wrap gap-2">
                    {prossime.map((d) => (
                      <li key={d} className="rounded-lg bg-white px-3 py-1.5 text-base font-semibold">
                        {dataLeggibile(d)}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="mt-2 text-sm">Nessuna scadenza da oggi in poi.</p>
              )}
              {passate.length > 0 && (
                <p className="mt-3 rounded-lg bg-amber-100 p-2 text-sm text-amber-950">
                  Attenzione: verranno create anche {passate.length === 1 ? '1 scadenza già passata' : `${passate.length} scadenze già passate`}{' '}
                  (dal {dataLeggibile(passate[0])}), che risulteranno da pagare.
                </p>
              )}
            </>
          ) : (
            <p className="text-sm">{erroreRegola?.[1]}</p>
          )}
        </div>

        {piano && (
          <p className="text-sm text-slate-500">
            Le scadenze passate restano come sono. Quelle da oggi in poi non ancora pagate vengono ricalcolate.
          </p>
        )}
        {!persona.attivo && (
          <p className="text-sm text-amber-800">La persona è archiviata: le scadenze verranno create quando la riattivi.</p>
        )}
        {errori.generale && (
          <p className="text-sm font-medium text-red-700" role="alert">
            {errori.generale}
          </p>
        )}

        <Pulsante type="submit" largo disabled={salvando}>
          {piano ? 'Salva modifiche' : 'Aggiungi quota'}
        </Pulsante>
      </form>

      {piano && (
        <div className="mt-10 border-t border-slate-200 pt-6">
          <Pulsante variante="leggero" largo className="text-red-700 active:bg-red-50" onClick={() => setChiediElimina(true)}>
            Elimina quota
          </Pulsante>
        </div>
      )}

      <Conferma
        aperta={chiediElimina}
        titolo="Eliminare questa quota?"
        testo="Verranno tolte tutte le sue scadenze. I pagamenti già ricevuti restano nello storico come acconti."
        etichettaConferma="Elimina quota"
        pericolo
        onConferma={elimina}
        onAnnulla={() => setChiediElimina(false)}
      />
    </Pagina>
  );
}
