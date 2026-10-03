import { useState } from 'react';
import Campo, { stileInput } from '../components/Campo';
import Foglio from '../components/Foglio';
import Pulsante from '../components/Pulsante';
import { reimpostaApp } from './pin';

const PAROLA = 'CANCELLA';

/** Foglio "Reimposta app": spiega cosa succede e chiede di scrivere CANCELLA per confermare. */
export default function ReimpostaApp({ onChiudi, daPinDimenticato }: { onChiudi: () => void; daPinDimenticato?: boolean }) {
  const [scritto, setScritto] = useState('');
  const [lavoro, setLavoro] = useState(false);

  async function conferma() {
    setLavoro(true);
    await reimpostaApp();
    window.location.reload();
  }

  return (
    <Foglio titolo={daPinDimenticato ? 'PIN dimenticato?' : 'Reimposta app'} onChiudi={onChiudi}>
      <div className="space-y-4 text-base text-slate-700">
        {daPinDimenticato && (
          <p>
            Il PIN <strong>non si può recuperare</strong>: non è salvato da nessuna parte, nemmeno sul telefono (c'è solo un codice
            che serve a controllarlo).
          </p>
        )}
        <p>
          L'unica soluzione è <strong>reimpostare l'app</strong>: tutti i dati di Buggi su questo telefono vengono cancellati. Dopo potrai
          ripristinare l'ultimo backup (file <em>pagamenti-backup-….json</em>) e scegliere un nuovo PIN.
        </p>
        <p className="rounded-xl bg-red-50 p-3 text-red-800">
          I pagamenti registrati dopo l'ultimo backup andranno persi.
        </p>
        <Campo etichetta={`Per confermare scrivi ${PAROLA}`} per="reimposta-conferma">
          <input
            id="reimposta-conferma"
            className={stileInput}
            value={scritto}
            onChange={(e) => setScritto(e.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
          />
        </Campo>
        <Pulsante variante="pericolo" largo disabled={lavoro || scritto.trim().toUpperCase() !== PAROLA} onClick={conferma}>
          {lavoro ? 'Cancellazione…' : 'Cancella tutto e reimposta'}
        </Pulsante>
        <Pulsante variante="secondario" largo onClick={onChiudi}>
          Annulla
        </Pulsante>
      </div>
    </Foglio>
  );
}
