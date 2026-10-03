import { useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { cartellaSupportata, dimenticaCartella, leggiCartella } from '../backup/automatico';
import { salvaFile } from '../backup/condividi';
import { creaBackup, testoBackup } from '../backup/exportJson';
import { creaExcel, nomeFileExcel } from '../backup/exportExcel';
import { nomeFileBackup } from '../backup/formato';
import { elencoCopie, ripristinaCopia } from '../backup/importJson';
import { giorniDallUltimoBackup } from '../backup/promemoria';
import Campo, { SceltaGrande, stileInput } from '../components/Campo';
import Conferma from '../components/Conferma';
import Foglio from '../components/Foglio';
import ImportaBackup from '../components/ImportaBackup';
import Pagina, { Caricamento } from '../components/Pagina';
import Pulsante from '../components/Pulsante';
import SceltaCartella from '../components/SceltaCartella';
import StatoArchivio from '../components/StatoArchivio';
import { aggiornaImpostazioni } from '../db/repository';
import type { Tema } from '../db/tipi';
import { ACCENTI, ACCENTO_PREDEFINITO } from '../hooks/useTema';
import { dataLeggibile } from '../utils/descrizioni';
import { useDati, type Dati } from '../hooks/useDati';
import { vai } from '../navigazione';
import ImpostaPin from '../sicurezza/ImpostaPin';
import { provaPin, rimuoviPin } from '../sicurezza/pin';
import ReimpostaApp from '../sicurezza/ReimpostaApp';
import TastierinoPin from '../sicurezza/TastierinoPin';
import { bloccaOra } from '../sicurezza/useBlocco';
import { oggiIso } from '../utils/date';

export default function Impostazioni() {
  const dati = useDati();
  if (!dati) return <Caricamento />;
  return (
    <Pagina titolo="Impostazioni">
      <div className="space-y-6">
        <SezioneVisualizzazione dati={dati} />
        <SezioneBackupAutomatico dati={dati} />
        <SezioneBackup dati={dati} />
        <SezioneExport dati={dati} />
        <SezionePreferenze dati={dati} />
        <SezioneSicurezza dati={dati} />
        <StatoArchivio />
        <p className="text-center text-sm text-slate-500">
          Buggi · tutti i dati restano su questo telefono, nessuna connessione a internet.
        </p>
      </div>
    </Pagina>
  );
}

export function Sezione({ titolo, children }: { titolo: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-lg font-bold text-slate-900">{titolo}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Messaggio({ testo, errore }: { testo: string; errore?: boolean }) {
  if (!testo) return null;
  return (
    <p role="status" className={`rounded-xl p-3 text-base ${errore ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-900'}`}>
      {testo}
    </p>
  );
}

/* ---------- backup ---------- */

function SezioneBackup({ dati }: { dati: Dati }) {
  const [conPassword, setConPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [ripeti, setRipeti] = useState('');
  const [msg, setMsg] = useState<{ testo: string; errore?: boolean }>({ testo: '' });
  const [lavoro, setLavoro] = useState(false);
  const [copiaDaRipristinare, setCopiaDaRipristinare] = useState<string | null>(null);
  const copie = useLiveQuery(elencoCopie) ?? [];

  const giorni = giorniDallUltimoBackup(dati.impostazioni.ultimoBackup, oggiIso());
  const statoBackup =
    giorni === null ? 'Non hai ancora fatto un backup.' : giorni === 0 ? 'Ultimo backup: oggi.' : `Ultimo backup: ${giorni} ${giorni === 1 ? 'giorno' : 'giorni'} fa.`;
  const vecchio = giorni === null || giorni > dati.impostazioni.promemoriaBackupGiorni;

  async function esporta() {
    if (conPassword && (password.length < 4 || password !== ripeti)) {
      setMsg({ testo: password.length < 4 ? 'La password deve avere almeno 4 caratteri.' : 'Le due password non sono uguali.', errore: true });
      return;
    }
    setLavoro(true);
    setMsg({ testo: '' });
    try {
      const testo = await testoBackup(await creaBackup(), conPassword ? password : undefined);
      const esito = await salvaFile(testo, nomeFileBackup(oggiIso()), 'application/json');
      if (esito === 'annullato') {
        setMsg({ testo: 'Backup annullato.', errore: true });
      } else {
        await aggiornaImpostazioni({ ultimoBackup: new Date().toISOString() });
        setMsg({ testo: esito === 'condiviso' ? 'Backup salvato.' : 'Backup scaricato. Conservalo in un posto sicuro (es. Drive o email).' });
      }
    } catch (e) {
      setMsg({ testo: e instanceof Error ? e.message : 'Backup non riuscito', errore: true });
    } finally {
      setLavoro(false);
    }
  }

  return (
    <Sezione titolo="Backup manuale">
      <p className={`text-base font-medium ${vecchio ? 'text-amber-800' : 'text-green-800'}`}>{statoBackup}</p>
      <p className="text-sm text-slate-600">
        Il backup è un file con tutti i dati. Salvalo su iCloud, Google Drive o mandalo per email: serve se cambi telefono o se l'app viene cancellata.
      </p>

      <label className="flex min-h-11 items-center gap-3 text-base text-slate-700">
        <input type="checkbox" className="h-6 w-6 accent-teal-600" checked={conPassword} onChange={(e) => setConPassword(e.target.checked)} />
        Proteggi con password
      </label>
      {conPassword && (
        <div className="space-y-3 rounded-xl bg-slate-50 p-3">
          <Campo etichetta="Password" per="bk-password">
            <input id="bk-password" type="password" className={stileInput} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          </Campo>
          <Campo etichetta="Ripeti la password" per="bk-ripeti">
            <input id="bk-ripeti" type="password" className={stileInput} value={ripeti} onChange={(e) => setRipeti(e.target.value)} autoComplete="new-password" />
          </Campo>
          <p className="text-sm text-amber-800">Attenzione: senza la password il backup non si può aprire. Non c'è modo di recuperarla.</p>
        </div>
      )}

      <Pulsante largo disabled={lavoro} onClick={esporta}>
        {lavoro ? 'Preparo il backup…' : '⬆️ Esporta backup'}
      </Pulsante>
      <ImportaBackup
        etichetta="⬇️ Importa backup"
        onFatto={(modo) => setMsg({ testo: modo === 'unisci' ? 'Dati uniti correttamente.' : 'Backup ripristinato.' })}
      />
      <Messaggio {...msg} />

      {copie.length > 0 && (
        <div className="pt-2">
          <h3 className="text-base font-semibold text-slate-800">Copie salvate nell’app</h3>
          <p className="mb-2 text-sm text-slate-500">Il backup automatico di ogni giorno (ultimi 7) e le copie fatte prima di ogni ripristino. Servono a tornare indietro se hai sbagliato.</p>
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {copie.map((c) => (
              <li key={c.id} className="flex items-center gap-2 p-2 pl-3">
                <span className="flex-1 text-sm text-slate-700">
                  {new Date(c.creatoIl).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })} · {c.motivo}
                </span>
                <Pulsante variante="leggero" onClick={() => setCopiaDaRipristinare(c.id)}>
                  Ripristina
                </Pulsante>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Conferma
        aperta={!!copiaDaRipristinare}
        titolo="Ripristinare questa copia?"
        testo="I dati attuali verranno sostituiti da quelli della copia (prima ne viene salvata un'altra, per sicurezza)."
        etichettaConferma="Ripristina"
        pericolo
        onConferma={async () => {
          const id = copiaDaRipristinare;
          setCopiaDaRipristinare(null);
          if (!id) return;
          try {
            await ripristinaCopia(id);
            setMsg({ testo: 'Copia ripristinata.' });
          } catch (e) {
            setMsg({ testo: e instanceof Error ? e.message : 'Ripristino non riuscito', errore: true });
          }
        }}
        onAnnulla={() => setCopiaDaRipristinare(null)}
      />
    </Sezione>
  );
}

/* ---------- export ---------- */

function SezioneExport({ dati }: { dati: Dati }) {
  const [msg, setMsg] = useState<{ testo: string; errore?: boolean }>({ testo: '' });
  const [lavoro, setLavoro] = useState(false);

  async function excel() {
    setLavoro(true);
    setMsg({ testo: '' });
    try {
      const oggi = oggiIso();
      const file = await creaExcel((await creaBackup()).dati, oggi, dati.impostazioni.giorniTolleranza, dati.impostazioni.valuta);
      const esito = await salvaFile(file as BlobPart, nomeFileExcel(oggi), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      if (esito !== 'annullato') setMsg({ testo: 'File Excel pronto: si apre con Excel, Numbers o Google Fogli.' });
    } catch (e) {
      setMsg({ testo: e instanceof Error ? e.message : 'Export non riuscito', errore: true });
    } finally {
      setLavoro(false);
    }
  }

  return (
    <Sezione titolo="Esporta per leggere">
      <p className="text-sm text-slate-600">File da leggere anche senza l'app. Per ripristinare i dati usa invece il backup.</p>
      <Pulsante variante="secondario" largo disabled={lavoro} onClick={excel}>
        📊 {lavoro ? 'Preparo il file…' : 'Esporta Excel'}
      </Pulsante>
      <Pulsante variante="secondario" largo onClick={() => vai('/report')}>
        🖨️ Report stampabile / PDF
      </Pulsante>
      <Messaggio {...msg} />
    </Sezione>
  );
}

/* ---------- preferenze ---------- */

const TOLLERANZE = [0, 1, 2, 3, 5, 7, 10, 15, 30];
const PROMEMORIA = [3, 7, 14, 30];

function SezionePreferenze({ dati }: { dati: Dati }) {
  const imp = dati.impostazioni;
  const [valuta, setValuta] = useState(imp.valuta);
  const [nuovaCategoria, setNuovaCategoria] = useState('');

  const salvaValuta = () => {
    const v = valuta.trim();
    setValuta(v);
    if (v !== imp.valuta) void aggiornaImpostazioni({ valuta: v });
  };
  const aggiungiCategoria = () => {
    const c = nuovaCategoria.trim();
    if (c && !imp.categorie.includes(c)) void aggiornaImpostazioni({ categorie: [...imp.categorie, c].sort((a, b) => a.localeCompare(b, 'it')) });
    setNuovaCategoria('');
  };

  return (
    <Sezione titolo="Preferenze">
      <div className="space-y-1">
        <p className="text-base font-medium text-slate-700">Tema</p>
        <SceltaGrande<Tema>
          etichetta="Tema"
          valore={imp.tema}
          onCambia={(tema) => aggiornaImpostazioni({ tema })}
          opzioni={[
            { valore: 'sistema', testo: 'Automatico' },
            { valore: 'chiaro', testo: '☀️ Chiaro' },
            { valore: 'scuro', testo: '🌙 Scuro' },
          ]}
        />
      </div>
      <div className="space-y-2">
        <p className="text-base font-medium text-slate-700">Colore</p>
        <div className="flex flex-wrap gap-3" role="radiogroup" aria-label="Colore dell'app">
          {ACCENTI.map((a) => {
            const scelto = (imp.accento ?? ACCENTO_PREDEFINITO) === a.valore;
            return (
              <button
                key={a.valore}
                type="button"
                role="radio"
                aria-checked={scelto}
                aria-label={a.nome}
                title={a.nome}
                onClick={() => aggiornaImpostazioni({ accento: a.valore })}
                className={`flex h-12 w-12 items-center justify-center rounded-full text-xl text-[#fff] ${scelto ? 'ring-4 ring-slate-400 ring-offset-2' : ''}`}
                style={{ backgroundColor: a.colore }}
              >
                {scelto ? '✓' : ''}
              </button>
            );
          })}
        </div>
        <p className="text-sm text-slate-500">Colore di pulsanti e titoli: {ACCENTI.find((a) => a.valore === (imp.accento ?? ACCENTO_PREDEFINITO))?.nome}.</p>
      </div>
      <Campo etichetta="Simbolo dopo gli importi (facoltativo)" per="pref-valuta" aiuto="Vuoto = solo la cifra, es. 1.234,50. Puoi scrivere ad esempio € se lo vuoi vedere.">
        <input
          id="pref-valuta"
          className={`${stileInput} w-28`}
          value={valuta}
          maxLength={4}
          onChange={(e) => setValuta(e.target.value)}
          onBlur={salvaValuta}
        />
      </Campo>
      <Campo etichetta="Giorni di tolleranza" per="pref-tolleranza" aiuto="Dopo la scadenza, quanti giorni aspettare prima di segnare «in ritardo».">
        <select
          id="pref-tolleranza"
          className={`${stileInput} appearance-auto`}
          value={imp.giorniTolleranza}
          onChange={(e) => aggiornaImpostazioni({ giorniTolleranza: Number(e.target.value) })}
        >
          {TOLLERANZE.map((g) => (
            <option key={g} value={g}>
              {g === 0 ? 'Nessuna (in ritardo dal giorno dopo)' : `${g} ${g === 1 ? 'giorno' : 'giorni'}`}
            </option>
          ))}
        </select>
      </Campo>
      <Campo etichetta="Ricordami il backup ogni" per="pref-promemoria">
        <select
          id="pref-promemoria"
          className={`${stileInput} appearance-auto`}
          value={imp.promemoriaBackupGiorni}
          onChange={(e) => aggiornaImpostazioni({ promemoriaBackupGiorni: Number(e.target.value) })}
        >
          {PROMEMORIA.map((g) => (
            <option key={g} value={g}>
              {g} giorni
            </option>
          ))}
        </select>
      </Campo>

      <div>
        <p className="text-base font-medium text-slate-700">Categorie</p>
        <p className="mb-2 text-sm text-slate-500">Le trovi già pronte quando aggiungi una persona.</p>
        {imp.categorie.length > 0 && (
          <ul className="mb-2 flex flex-wrap gap-2">
            {imp.categorie.map((c) => (
              <li key={c} className="flex items-center rounded-full bg-slate-100 pl-3 text-base text-slate-800">
                {c}
                <button
                  type="button"
                  aria-label={`Togli la categoria ${c}`}
                  className="flex h-11 w-11 items-center justify-center rounded-full text-slate-500 active:bg-slate-200"
                  onClick={() => aggiornaImpostazioni({ categorie: imp.categorie.filter((x) => x !== c) })}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <input
            aria-label="Nuova categoria"
            placeholder="Nuova categoria"
            className={stileInput}
            value={nuovaCategoria}
            onChange={(e) => setNuovaCategoria(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') aggiungiCategoria();
            }}
          />
          <Pulsante variante="secondario" onClick={aggiungiCategoria} disabled={!nuovaCategoria.trim()}>
            Aggiungi
          </Pulsante>
        </div>
      </div>
    </Sezione>
  );
}

/* ---------- sicurezza ---------- */

const MINUTI_BLOCCO = [1, 5, 15];

function SezioneSicurezza({ dati }: { dati: Dati }) {
  const imp = dati.impostazioni;
  const [foglio, setFoglio] = useState<'imposta' | 'cambia' | 'togli' | 'reimposta' | null>(null);
  const [verificato, setVerificato] = useState(false);
  const [msg, setMsg] = useState('');
  const chiudi = () => {
    setFoglio(null);
    setVerificato(false);
  };

  return (
    <Sezione titolo="Sicurezza">
      <p className={`text-base font-medium ${imp.pinHash ? 'text-green-800' : 'text-slate-700'}`}>
        {imp.pinHash ? '🔒 PIN attivo: viene chiesto all’apertura.' : 'Nessun PIN: chiunque prenda il telefono può aprire Buggi.'}
      </p>
      {imp.pinHash ? (
        <>
          <Campo etichetta="Blocca dopo" per="sic-minuti" aiuto="Tempo con l'app chiusa o in background prima di chiedere di nuovo il PIN.">
            <select
              id="sic-minuti"
              className={`${stileInput} appearance-auto`}
              value={imp.bloccoAutomaticoMinuti}
              onChange={(e) => aggiornaImpostazioni({ bloccoAutomaticoMinuti: Number(e.target.value) })}
            >
              {MINUTI_BLOCCO.map((m) => (
                <option key={m} value={m}>
                  {m} {m === 1 ? 'minuto' : 'minuti'}
                </option>
              ))}
            </select>
          </Campo>
          <Pulsante variante="secondario" largo onClick={bloccaOra}>
            🔒 Blocca ora
          </Pulsante>
          <div className="grid grid-cols-2 gap-2">
            <Pulsante variante="secondario" onClick={() => setFoglio('cambia')}>
              Cambia PIN
            </Pulsante>
            <Pulsante variante="secondario" onClick={() => setFoglio('togli')}>
              Togli PIN
            </Pulsante>
          </div>
        </>
      ) : (
        <Pulsante largo onClick={() => setFoglio('imposta')}>
          Imposta un PIN
        </Pulsante>
      )}
      <p className="text-sm text-slate-500">Se dimentichi il PIN non si può recuperare: si reimposta l'app e si ripristina un backup.</p>
      <Messaggio testo={msg} />

      <div className="border-t border-slate-200 pt-3">
        <Pulsante variante="leggero" largo className="text-red-700 active:bg-red-50" onClick={() => setFoglio('reimposta')}>
          Reimposta app (cancella tutti i dati)
        </Pulsante>
      </div>

      {foglio === 'imposta' && (
        <Foglio titolo="Imposta PIN" onChiudi={chiudi}>
          <ImpostaPin
            onFatto={() => {
              chiudi();
              setMsg('PIN impostato.');
            }}
          />
        </Foglio>
      )}
      {(foglio === 'cambia' || foglio === 'togli') && (
        <Foglio titolo={foglio === 'cambia' ? 'Cambia PIN' : 'Togli PIN'} onChiudi={chiudi}>
          {!verificato ? (
            <VerificaPin
              onOk={async () => {
                if (foglio === 'togli') {
                  await rimuoviPin();
                  chiudi();
                  setMsg('PIN tolto.');
                } else {
                  setVerificato(true);
                }
              }}
            />
          ) : (
            <ImpostaPin
              onFatto={() => {
                chiudi();
                setMsg('PIN cambiato.');
              }}
            />
          )}
        </Foglio>
      )}
      {foglio === 'reimposta' && <ReimpostaApp onChiudi={chiudi} />}
    </Sezione>
  );
}

/** Chiede il PIN attuale (con le stesse attese della schermata di blocco). */
function VerificaPin({ onOk }: { onOk: () => void }) {
  const [pin, setPin] = useState('');
  const [errore, setErrore] = useState('');
  return (
    <div>
      <p className="mb-1 text-center text-lg font-semibold text-slate-900">Scrivi il PIN attuale</p>
      <p className="mb-5 min-h-6 text-center text-base text-red-700" role="alert">
        {errore}
      </p>
      <TastierinoPin
        valore={pin}
        onCambia={(v) => {
          setPin(v);
          setErrore('');
        }}
        etichetta="PIN attuale"
        onInvio={async () => {
          const esito = await provaPin(pin);
          setPin('');
          if (esito.ok) onOk();
          else setErrore(esito.attesaFino ? 'Troppi tentativi: riprova più tardi.' : 'PIN sbagliato.');
        }}
      />
    </div>
  );
}

/* ---------- cosa mostrare ---------- */

function SezioneVisualizzazione({ dati }: { dati: Dati }) {
  const futuro = !!dati.impostazioni.mostraFuturo;
  return (
    <Sezione titolo="Cosa mostrare">
      <label className="flex min-h-11 items-start gap-3 text-base text-slate-800">
        <input
          type="checkbox"
          className="mt-0.5 h-6 w-6 shrink-0 accent-teal-700"
          checked={futuro}
          onChange={(e) => aggiornaImpostazioni({ mostraFuturo: e.target.checked })}
        />
        <span>
          Mostra anche i pagamenti futuri
          <span className="block text-sm text-slate-500">
            {futuro
              ? 'Vedi anche quanto devono pagare e quando (prossime scadenze, da incassare).'
              : 'Ora per ogni persona vedi solo «In regola» o «In ritardo».'}
          </span>
        </span>
      </label>
    </Sezione>
  );
}

/* ---------- backup automatico ---------- */

function SezioneBackupAutomatico({ dati }: { dati: Dati }) {
  const imp = dati.impostazioni;
  const attivo = imp.backupAutomatico !== false;
  const cartella = useLiveQuery(leggiCartella);
  const supportata = cartellaSupportata();
  const [msg, setMsg] = useState('');
  const oggi = oggiIso();
  const quando = !imp.ultimoBackupAutomatico
    ? 'non ancora fatto'
    : imp.ultimoBackupAutomatico === oggi
      ? 'oggi'
      : `il ${dataLeggibile(imp.ultimoBackupAutomatico)}`;

  return (
    <Sezione titolo="Backup automatico">
      <label className="flex min-h-11 items-center gap-3 text-base text-slate-800">
        <input
          type="checkbox"
          className="h-6 w-6 accent-teal-700"
          checked={attivo}
          onChange={(e) => aggiornaImpostazioni({ backupAutomatico: e.target.checked })}
        />
        Fai un backup ogni giorno da solo
      </label>
      {attivo && (
        <>
          <p className="text-base text-slate-700">Ultimo backup automatico: <strong>{quando}</strong>.</p>
          {supportata ? (
            cartella ? (
              <div className="space-y-2 rounded-xl bg-slate-50 p-3">
                <p className="text-base text-slate-800">
                  📁 Salvato anche nella cartella <strong>«{cartella.name}»</strong> (ultimi 30 giorni).
                </p>
                <SceltaCartella etichetta="Cambia cartella" onFatto={(nome) => setMsg(`Backup salvato in «${nome}».`)} />
                <Pulsante
                  variante="leggero"
                  largo
                  onClick={async () => {
                    await dimenticaCartella();
                    setMsg('I backup automatici restano solo nell’app.');
                  }}
                >
                  Non salvare più nella cartella
                </Pulsante>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-slate-600">
                  Scegli una cartella (consigliata: Documenti): ogni giorno Buggi ci salverà da solo il file del backup.
                </p>
                <SceltaCartella onFatto={(nome) => setMsg(`Backup salvato in «${nome}». Da ora ci salvo ogni giorno.`)} />
              </div>
            )
          ) : (
            <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
              Ogni giorno, alla prima apertura, Buggi salva da solo una copia <strong>dentro l'app</strong> (ultimi 7 giorni). Su telefono il
              browser non permette di salvare file in una cartella senza un tuo tocco: per avere una copia anche fuori dal telefono usa
              «Esporta backup» qui sotto (te lo ricordo ogni {imp.promemoriaBackupGiorni} giorni).
            </p>
          )}
          {msg && (
            <p role="status" className="rounded-xl bg-green-50 p-3 text-base text-green-900">
              {msg}
            </p>
          )}
        </>
      )}
    </Sezione>
  );
}
