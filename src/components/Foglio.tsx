import { useEffect, useRef, type ReactNode } from 'react';

type Props = {
  titolo: string;
  onChiudi: () => void;
  children: ReactNode;
};

/** Pannello che sale dal basso sopra la pagina (es. per registrare un pagamento). */
export default function Foglio({ titolo, onChiudi, children }: Props) {
  const chiudi = useRef(onChiudi);
  chiudi.current = onChiudi;

  useEffect(() => {
    const tasto = (e: KeyboardEvent) => {
      if (e.key === 'Escape') chiudi.current();
    };
    window.addEventListener('keydown', tasto);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', tasto);
      document.body.style.overflow = overflow;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50" onClick={onChiudi}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="foglio-titolo"
        className="flex max-h-[92vh] w-full max-w-xl flex-col rounded-t-3xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-2">
          <h2 id="foglio-titolo" className="min-w-0 flex-1 truncate text-xl font-bold text-slate-900">
            {titolo}
          </h2>
          <button
            type="button"
            onClick={onChiudi}
            aria-label="Chiudi"
            className="flex h-11 w-11 items-center justify-center rounded-full text-slate-500 active:bg-slate-100"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true">
              <path d="M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12Z" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>
  );
}
