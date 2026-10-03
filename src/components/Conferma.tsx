import { useEffect, useRef } from 'react';
import Pulsante from './Pulsante';

type Props = {
  aperta: boolean;
  titolo: string;
  testo: string;
  etichettaConferma: string;
  pericolo?: boolean;
  onConferma: () => void;
  onAnnulla: () => void;
};

/** Finestra "Sei sicuro?" prima delle azioni importanti. */
export default function Conferma({ aperta, titolo, testo, etichettaConferma, pericolo, onConferma, onAnnulla }: Props) {
  const annulla = useRef<HTMLButtonElement>(null);
  const chiudi = useRef(onAnnulla);
  chiudi.current = onAnnulla;

  useEffect(() => {
    if (!aperta) return;
    annulla.current?.focus();
    const tasto = (e: KeyboardEvent) => {
      if (e.key === 'Escape') chiudi.current();
    };
    window.addEventListener('keydown', tasto);
    return () => window.removeEventListener('keydown', tasto);
  }, [aperta]);

  if (!aperta) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={onAnnulla}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="conferma-titolo"
        aria-describedby="conferma-testo"
        className="w-full max-w-md rounded-2xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="conferma-titolo" className="text-xl font-bold text-slate-900">
          {titolo}
        </h2>
        <p id="conferma-testo" className="mt-2 text-base text-slate-600">
          {testo}
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Pulsante ref={annulla} variante="secondario" onClick={onAnnulla}>
            Annulla
          </Pulsante>
          <Pulsante variante={pericolo ? 'pericolo' : 'primario'} onClick={onConferma}>
            {etichettaConferma}
          </Pulsante>
        </div>
      </div>
    </div>
  );
}
