import type { ReactNode } from 'react';
import { vai } from '../navigazione';

type Props = {
  titolo: string;
  /** indirizzo della pagina a cui torna la freccia "indietro" */
  indietro?: string;
  /** pulsante a destra del titolo */
  azione?: ReactNode;
  /** mostra il logo di Buggi prima del titolo */
  logo?: boolean;
  children: ReactNode;
};

export default function Pagina({ titolo, indietro, azione, logo, children }: Props) {
  return (
    <section className="mx-auto w-full max-w-xl px-4 pb-6">
      <header className="flex min-h-16 items-center gap-2 pt-2">
        {indietro && (
          <button
            type="button"
            onClick={() => vai(indietro)}
            aria-label="Indietro"
            className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-700 active:bg-slate-200"
          >
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor" aria-hidden="true">
              <path d="M15.4 7.4 14 6l-6 6 6 6 1.4-1.4-4.6-4.6Z" />
            </svg>
          </button>
        )}
        {logo && <img src={`${import.meta.env.BASE_URL}icons/logo-piccolo.png`} alt="" className="h-11 w-11 shrink-0 rounded-xl" />}
        <h1 className="min-w-0 flex-1 truncate text-2xl font-bold text-slate-900">{titolo}</h1>
        {azione}
      </header>
      {children}
    </section>
  );
}

export function AvvisoInArrivo({ testo }: { testo: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-base text-slate-600">
      {testo}
    </div>
  );
}

/** Messaggio mostrato al posto di un elenco vuoto. */
export function StatoVuoto({ titolo, testo, children }: { titolo: string; testo?: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center">
      <p className="text-lg font-semibold text-slate-800">{titolo}</p>
      {testo && <p className="mt-1 text-base text-slate-600">{testo}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

export function Caricamento() {
  return <p className="p-6 text-center text-slate-500">Caricamento…</p>;
}
