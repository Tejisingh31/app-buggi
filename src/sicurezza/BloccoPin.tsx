import { useEffect, useState } from 'react';
import { ERRORI_PRIMA_ATTESA, provaPin } from './pin';
import ReimpostaApp from './ReimpostaApp';
import TastierinoPin from './TastierinoPin';

/** Schermata di blocco: si entra solo con il PIN giusto. */
export default function BloccoPin({ attesaIniziale, onSbloccato }: { attesaIniziale?: string; onSbloccato: () => void }) {
  const [pin, setPin] = useState('');
  const [messaggio, setMessaggio] = useState('');
  const [attesaFino, setAttesaFino] = useState<number>(() => (attesaIniziale ? new Date(attesaIniziale).getTime() : 0));
  const [adesso, setAdesso] = useState(() => Date.now());
  const [controllo, setControllo] = useState(false);
  const [dimenticato, setDimenticato] = useState(false);

  const secondi = Math.max(0, Math.ceil((attesaFino - adesso) / 1000));
  useEffect(() => {
    if (secondi <= 0) return;
    const t = window.setInterval(() => setAdesso(Date.now()), 500);
    return () => window.clearInterval(t);
  }, [secondi]);

  async function invio() {
    if (secondi > 0 || controllo) return;
    setControllo(true);
    const esito = await provaPin(pin);
    setControllo(false);
    setPin('');
    if (esito.ok) {
      onSbloccato();
      return;
    }
    if (esito.attesaFino) {
      setAttesaFino(new Date(esito.attesaFino).getTime());
      setAdesso(Date.now());
      setMessaggio('Troppi tentativi sbagliati.');
    } else {
      const restano = ERRORI_PRIMA_ATTESA - esito.errori;
      setMessaggio(`PIN sbagliato. ${restano === 1 ? 'Ancora 1 tentativo' : `Ancora ${restano} tentativi`} prima di dover aspettare.`);
    }
  }

  return (
    <main className="flex min-h-full flex-col items-center justify-center bg-slate-50 px-6 py-10">
      <img src={`${import.meta.env.BASE_URL}icons/logo-piccolo.png`} alt="" className="h-20 w-20 rounded-2xl" />
      <h1 className="mt-3 text-2xl font-bold text-slate-900">Buggi</h1>
      <p className="mt-1 mb-2 text-lg text-slate-700">Inserisci il PIN</p>
      <p className="mb-4 min-h-12 max-w-xs text-center text-base text-red-700" role="alert">
        {secondi > 0 ? `${messaggio || 'Troppi tentativi sbagliati.'} Riprova tra ${secondi} secondi.` : messaggio}
      </p>
      <TastierinoPin valore={pin} onCambia={setPin} onInvio={invio} disabilitato={secondi > 0 || controllo} etichetta="PIN" />
      <button type="button" onClick={() => setDimenticato(true)} className="mt-8 min-h-11 px-4 text-base font-medium text-teal-700 underline">
        PIN dimenticato?
      </button>
      {dimenticato && <ReimpostaApp daPinDimenticato onChiudi={() => setDimenticato(false)} />}
    </main>
  );
}
