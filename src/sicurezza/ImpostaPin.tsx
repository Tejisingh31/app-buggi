import { useState } from 'react';
import { impostaPin } from './pin';
import TastierinoPin from './TastierinoPin';

/** Scegli il PIN e ripetilo. Chiama onFatto quando è salvato. */
export default function ImpostaPin({ onFatto }: { onFatto: () => void }) {
  const [primo, setPrimo] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [errore, setErrore] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function invio() {
    if (primo === null) {
      setPrimo(pin);
      setPin('');
      setErrore('');
      return;
    }
    if (pin !== primo) {
      setErrore('I due PIN non sono uguali. Riprova da capo.');
      setPrimo(null);
      setPin('');
      return;
    }
    setSalvando(true);
    await impostaPin(pin);
    onFatto();
  }

  return (
    <div>
      <p className="mb-1 text-center text-lg font-semibold text-slate-900">
        {primo === null ? 'Scegli un PIN di 4–6 cifre' : 'Ripeti il PIN'}
      </p>
      <p className="mb-5 min-h-6 text-center text-base text-red-700" role="alert">
        {errore}
      </p>
      <TastierinoPin
        valore={pin}
        onCambia={(v) => {
          setPin(v);
          setErrore('');
        }}
        onInvio={invio}
        disabilitato={salvando}
        etichetta={primo === null ? 'Nuovo PIN' : 'Ripeti il PIN'}
      />
    </div>
  );
}
