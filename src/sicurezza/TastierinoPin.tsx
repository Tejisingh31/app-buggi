import { useEffect, useRef } from 'react';

type Props = {
  valore: string;
  onCambia: (pin: string) => void;
  /** chiamato con "OK" o Invio (il PIN può avere da 4 a 6 cifre) */
  onInvio: () => void;
  disabilitato?: boolean;
  /** testo letto dai lettori di schermo, es. "Inserisci il PIN" */
  etichetta: string;
};

const TASTI = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
const MAX = 6;

/** Tastierino numerico grande per il PIN; funziona anche con la tastiera del computer. */
export default function TastierinoPin({ valore, onCambia, onInvio, disabilitato, etichetta }: Props) {
  const stato = useRef({ valore, onCambia, onInvio, disabilitato });
  stato.current = { valore, onCambia, onInvio, disabilitato };

  useEffect(() => {
    const tasto = (e: KeyboardEvent) => {
      const s = stato.current;
      if (s.disabilitato || e.target instanceof HTMLInputElement) return;
      if (/^\d$/.test(e.key) && s.valore.length < MAX) s.onCambia(s.valore + e.key);
      else if (e.key === 'Backspace') s.onCambia(s.valore.slice(0, -1));
      else if (e.key === 'Enter' && s.valore.length >= 4) s.onInvio();
    };
    window.addEventListener('keydown', tasto);
    return () => window.removeEventListener('keydown', tasto);
  }, []);

  const premi = (cifra: string) => {
    if (!disabilitato && valore.length < MAX) onCambia(valore + cifra);
  };
  const base = 'flex h-16 items-center justify-center rounded-2xl text-3xl font-semibold shadow-sm disabled:opacity-40';
  const stileTasto = `${base} bg-white text-slate-900 active:bg-slate-200`;

  return (
    <div className="mx-auto w-full max-w-xs">
      <div className="mb-6 flex justify-center gap-3" role="status" aria-label={`${etichetta}: ${valore.length} cifre inserite`}>
        {Array.from({ length: Math.max(4, valore.length) }, (_, i) => (
          <span
            key={i}
            className={`h-4 w-4 rounded-full border-2 ${i < valore.length ? 'border-teal-700 bg-teal-700' : 'border-slate-400'}`}
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {TASTI.map((t) => (
          <button key={t} type="button" className={stileTasto} onClick={() => premi(t)} disabled={disabilitato}>
            {t}
          </button>
        ))}
        <button
          type="button"
          className={`${stileTasto} text-xl`}
          onClick={() => onCambia(valore.slice(0, -1))}
          disabled={disabilitato || !valore}
          aria-label="Cancella l'ultima cifra"
        >
          ⌫
        </button>
        <button type="button" className={stileTasto} onClick={() => premi('0')} disabled={disabilitato}>
          0
        </button>
        <button
          type="button"
          className={`${base} bg-(--accento) text-xl text-[#fff] active:brightness-90`}
          onClick={onInvio}
          disabled={disabilitato || valore.length < 4}
        >
          OK
        </button>
      </div>
    </div>
  );
}
