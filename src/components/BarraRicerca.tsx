type Props = {
  valore: string;
  onCambia: (testo: string) => void;
  segnaposto?: string;
};

/** Campo di ricerca grande con pulsante per cancellare. */
export default function BarraRicerca({ valore, onCambia, segnaposto = 'Cerca…' }: Props) {
  return (
    <div className="relative">
      <svg
        viewBox="0 0 24 24"
        className="pointer-events-none absolute top-1/2 left-3 h-6 w-6 -translate-y-1/2 text-slate-400"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M15.5 14h-.8l-.3-.3A6.5 6.5 0 1 0 14 15.5l.3.3v.8l5 5 1.5-1.5Zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14Z" />
      </svg>
      <input
        type="search"
        value={valore}
        onChange={(e) => onCambia(e.target.value)}
        placeholder={segnaposto}
        aria-label="Cerca"
        autoComplete="off"
        className="block min-h-12 w-full rounded-xl border border-slate-300 bg-white pr-12 pl-11 text-lg text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-600/30 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {valore && (
        <button
          type="button"
          onClick={() => onCambia('')}
          aria-label="Cancella ricerca"
          className="absolute top-1/2 right-1 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-slate-500 active:bg-slate-100"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true">
            <path d="M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12Z" />
          </svg>
        </button>
      )}
    </div>
  );
}
