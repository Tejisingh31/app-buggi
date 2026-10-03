import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { leggiCartella, permessoCartella, salvaInCartella } from '../backup/automatico';
import Pulsante from './Pulsante';

/**
 * Sul computer, dopo un riavvio, il browser può chiedere di nuovo il permesso
 * di scrivere nella cartella dei backup: qui si riattiva con un tocco.
 */
export default function RiattivaCartella({ aggiorna }: { aggiorna?: unknown }) {
  const [errore, setErrore] = useState('');
  const [fatto, setFatto] = useState(false);
  const cartella = useLiveQuery(async () => {
    const c = await leggiCartella();
    return c && (await permessoCartella(c)) === 'prompt' ? c : null;
  }, [aggiorna, fatto]);

  if (!cartella) return null;
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-amber-950" role="alert">
      <p className="text-base font-semibold">Il browser chiede di nuovo il permesso</p>
      <p className="mt-1 text-sm">Per continuare a salvare i backup nella cartella «{cartella.name}» tocca qui sotto.</p>
      <Pulsante
        className="mt-2"
        onClick={async () => {
          try {
            if ((await permessoCartella(cartella, true)) === 'granted') {
              await salvaInCartella(cartella);
              setFatto(true);
            } else setErrore('Permesso non concesso.');
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
