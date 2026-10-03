import { useRef, useState, type FormEvent } from 'react';
import { PasswordSbagliata } from '../backup/cifratura';
import { anteprima, leggiBackup, richiedePassword, ripristina, type BackupLetto, type ModoRipristino } from '../backup/importJson';
import { dataLeggibile } from '../utils/descrizioni';
import { formattaEuro } from '../utils/formattazione';
import Campo, { stileInput } from './Campo';
import Conferma from './Conferma';
import Foglio from './Foglio';
import Pulsante from './Pulsante';

type Props = {
  etichetta: string;
  variante?: 'primario' | 'secondario';
  /** true al primo avvio: l'app è vuota, c'è solo "Ripristina" */
  soloSostituisci?: boolean;
  onFatto: (modo: ModoRipristino) => void;
};

type Passo =
  | { tipo: 'chiuso' }
  | { tipo: 'password'; testo: string; errore?: string }
  | { tipo: 'anteprima'; letto: BackupLetto }
  | { tipo: 'errore'; messaggio: string };

/** Pulsante "Importa backup": scelta del file → (password) → anteprima → Sostituisci tutto / Unisci. */
export default function ImportaBackup({ etichetta, variante = 'secondario', soloSostituisci, onFatto }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [passo, setPasso] = useState<Passo>({ tipo: 'chiuso' });
  const [password, setPassword] = useState('');
  const [lavoro, setLavoro] = useState(false);
  const [confermaSostituisci, setConfermaSostituisci] = useState(false);

  async function fileScelto(file: File | undefined) {
    if (!file) return;
    if (input.current) input.current.value = '';
    try {
      const testo = await file.text();
      if (richiedePassword(testo)) {
        setPassword('');
        setPasso({ tipo: 'password', testo });
      } else {
        setPasso({ tipo: 'anteprima', letto: await leggiBackup(testo) });
      }
    } catch (e) {
      setPasso({ tipo: 'errore', messaggio: e instanceof Error ? e.message : 'File non leggibile' });
    }
  }

  async function sblocca(e: FormEvent) {
    e.preventDefault();
    if (passo.tipo !== 'password') return;
    setLavoro(true);
    try {
      setPasso({ tipo: 'anteprima', letto: await leggiBackup(passo.testo, password) });
    } catch (err) {
      setPasso({
        ...passo,
        errore: err instanceof PasswordSbagliata ? 'Password sbagliata' : err instanceof Error ? err.message : 'Errore',
      });
    } finally {
      setLavoro(false);
    }
  }

  async function esegui(modo: ModoRipristino) {
    if (passo.tipo !== 'anteprima') return;
    setLavoro(true);
    setConfermaSostituisci(false);
    try {
      await ripristina(passo.letto.dati, modo);
      setPasso({ tipo: 'chiuso' });
      onFatto(modo);
    } catch (e) {
      setPasso({ tipo: 'errore', messaggio: e instanceof Error ? e.message : 'Ripristino non riuscito' });
    } finally {
      setLavoro(false);
    }
  }

  const chiudi = () => setPasso({ tipo: 'chiuso' });

  return (
    <>
      <Pulsante variante={variante} largo onClick={() => input.current?.click()}>
        {etichetta}
      </Pulsante>
      <input
        ref={input}
        type="file"
        accept=".json,application/json"
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => fileScelto(e.target.files?.[0])}
      />

      {passo.tipo === 'password' && (
        <Foglio titolo="Backup protetto" onChiudi={chiudi}>
          <form onSubmit={sblocca} className="space-y-4">
            <p className="text-base text-slate-700">Questo backup è protetto da password. Scrivi la password usata quando l'hai creato.</p>
            <Campo etichetta="Password" per="imp-password" errore={passo.errore}>
              <input
                id="imp-password"
                type="password"
                className={stileInput}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                autoComplete="off"
              />
            </Campo>
            <Pulsante type="submit" largo disabled={lavoro || !password}>
              {lavoro ? 'Controllo…' : 'Apri backup'}
            </Pulsante>
          </form>
        </Foglio>
      )}

      {passo.tipo === 'anteprima' && (
        <Foglio titolo="Contenuto del backup" onChiudi={chiudi}>
          <Riepilogo letto={passo.letto} />
          <div className="mt-5 space-y-2">
            {soloSostituisci ? (
              <Pulsante largo disabled={lavoro} onClick={() => esegui('sostituisci')}>
                {lavoro ? 'Ripristino…' : 'Ripristina questi dati'}
              </Pulsante>
            ) : (
              <>
                <Pulsante largo disabled={lavoro} onClick={() => esegui('unisci')}>
                  Unisci ai dati attuali
                </Pulsante>
                <p className="text-sm text-slate-500">Aggiunge le persone e i pagamenti che mancano, senza cancellare niente.</p>
                <Pulsante variante="secondario" largo disabled={lavoro} className="mt-2 text-red-700" onClick={() => setConfermaSostituisci(true)}>
                  Sostituisci tutto
                </Pulsante>
                <p className="text-sm text-slate-500">Cancella i dati attuali e mette quelli del backup.</p>
              </>
            )}
          </div>
        </Foglio>
      )}

      {passo.tipo === 'errore' && (
        <Foglio titolo="Impossibile importare" onChiudi={chiudi}>
          <p className="text-base text-red-800" role="alert">
            {passo.messaggio}
          </p>
          <Pulsante variante="secondario" largo className="mt-4" onClick={chiudi}>
            Chiudi
          </Pulsante>
        </Foglio>
      )}

      <Conferma
        aperta={confermaSostituisci}
        titolo="Sostituire tutti i dati?"
        testo="I dati attuali verranno sostituiti da quelli del backup. Prima viene salvata in automatico una copia di sicurezza, che potrai ripristinare da Impostazioni."
        etichettaConferma="Sostituisci tutto"
        pericolo
        onConferma={() => esegui('sostituisci')}
        onAnnulla={() => setConfermaSostituisci(false)}
      />
    </>
  );
}

function Riepilogo({ letto }: { letto: BackupLetto }) {
  const a = anteprima(letto.dati);
  const valuta = letto.dati.impostazioni.valuta ?? '€';
  const righe: [string, string][] = [
    ['Creato il', letto.creatoIl ? new Date(letto.creatoIl).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' }) : '—'],
    ['Persone', String(a.persone)],
    ['Quote', String(a.quote)],
    ['Pagamenti', `${a.pagamenti} (${formattaEuro(a.totalePagamenti, valuta)})`],
    ['Ultimo pagamento', a.ultimoPagamento ? dataLeggibile(a.ultimoPagamento) : '—'],
  ];
  return (
    <dl className="divide-y divide-slate-100 rounded-2xl border border-slate-200">
      {righe.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3 px-3 py-2 text-base">
          <dt className="text-slate-600">{k}</dt>
          <dd className="text-right font-semibold text-slate-900">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
