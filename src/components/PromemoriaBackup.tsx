import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { leggiCartella, permessoCartella, salvaInCartella } from '../backup/automatico';
import { giorniDallUltimoBackup, serveBackup } from '../backup/promemoria';
import type { Dati } from '../hooks/useDati';
import { vai } from '../navigazione';
import { oggiIso } from '../utils/date';
import Pulsante from './Pulsante';

/** Banner in Dashboard: cartella dei backup da riattivare, oppure backup troppo vecchio. */
export default function PromemoriaBackup({ dati }: { dati: Dati }) {
  const oggi = oggiIso();
  const { ultimoBackup, promemoriaBackupGiorni } = dati.impostazioni;
  const [errore, setErrore] = useState('');

  // la cartella scelta c'è ma il browser chiede di nuovo il permesso (succede dopo il riavvio del computer)
  const cartella = useLiveQuery(async () => {
    const c = await leggiCartella();
    return c && (await permessoCartella(c)) === 'prompt' ? c : null;
  }, [ultimoBackup]);

  if (cartella) {
    return (
      <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950" role="alert">
        <p className="text-base font-semibold">Riattiva il backup nella cartella</p>
        <p className="mt-1 text-sm">Il browser chiede il permesso di salvare di nuovo i backup nella cartella «{cartella.name}».</p>
        <Pulsante
          className="mt-3"
          onClick={async () => {
            try {
              if ((await permessoCartella(cartella, true)) === 'granted') await salvaInCartella(cartella);
              else setErrore('Permesso non concesso.');
            } catch (e) {
              setErrore(e instanceof Error ? e.message : 'Salvataggio non riuscito');
            }
          }}
        >
          Consenti e salva ora
        </Pulsante>
        {errore && <p className="mt-2 text-sm text-red-800">{errore}</p>}
      </div>
    );
  }

  if (!serveBackup(ultimoBackup, promemoriaBackupGiorni, oggi, dati.persone.length > 0)) return null;
  const giorni = giorniDallUltimoBackup(ultimoBackup, oggi);
  return (
    <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950" role="alert">
      <p className="text-base font-semibold">
        {giorni === null ? 'Salva una copia fuori dal telefono' : `Ultima copia fuori dal telefono: ${giorni} giorni fa`}
      </p>
      <p className="mt-1 text-sm">
        Ogni giorno l'app fa da sola una copia interna, ma se cancelli l'app si perde anche quella. Salva un backup su iCloud, Google
        Drive o email.
      </p>
      <Pulsante className="mt-3" onClick={() => vai('/impostazioni')}>
        Fai il backup ora
      </Pulsante>
    </div>
  );
}
