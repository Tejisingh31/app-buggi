import { useState } from 'react';
import { eseguiBackupAutomatico, salvaInCartella, scegliCartella } from '../backup/automatico';
import Pulsante from './Pulsante';

/** Pulsante "Scegli cartella": apre la scelta (su Documenti), crea "Buggi backup" e salva subito un backup. */
export default function SceltaCartella({ etichetta = '📁 Scegli cartella (es. Documenti)', onFatto }: { etichetta?: string; onFatto?: (nome: string) => void }) {
  const [errore, setErrore] = useState('');
  const [lavoro, setLavoro] = useState(false);

  async function scegli() {
    setErrore('');
    setLavoro(true);
    try {
      const cartella = await scegliCartella();
      await salvaInCartella(cartella);
      await eseguiBackupAutomatico(); // anche la copia interna di oggi, se manca
      onFatto?.(cartella.name);
    } catch (e) {
      // "AbortError" = l'utente ha chiuso la finestra senza scegliere
      if (!(e instanceof DOMException && e.name === 'AbortError')) setErrore(e instanceof Error ? e.message : 'Cartella non disponibile');
    } finally {
      setLavoro(false);
    }
  }

  return (
    <div>
      <Pulsante largo disabled={lavoro} onClick={scegli}>
        {lavoro ? 'Salvo…' : etichetta}
      </Pulsante>
      {errore && (
        <p className="mt-2 text-sm text-red-800" role="alert">
          {errore}
        </p>
      )}
    </div>
  );
}
