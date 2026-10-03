import type { Scheda } from '../navigazione';

const SCHEDE: { id: Scheda; etichetta: string; icona: string }[] = [
  { id: 'dashboard', etichetta: 'Dashboard', icona: 'M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z' },
  { id: 'persone', etichetta: 'Persone', icona: 'M16 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm-8 0a3 3 0 1 0-3-3 3 3 0 0 0 3 3Zm0 2c-2.7 0-6 1.3-6 3.5V19h6v-2.5c0-1.2.6-2.3 1.7-3.1A9 9 0 0 0 8 13Zm8 0c-3 0-7 1.5-7 4v2h14v-2c0-2.5-4-4-7-4Z' },
  { id: 'mancanti', etichetta: 'Mancanti', icona: 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm1 15h-2v-2h2Zm0-4h-2V7h2Z' },
  { id: 'impostazioni', etichetta: 'Impostazioni', icona: 'M19.4 13a7.5 7.5 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.6 7.6 0 0 0-1.7-1L15 3h-4l-.4 2.9a7.6 7.6 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.5 7.5 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7.6 7.6 0 0 0 1.7 1L11 21h4l.4-2.9a7.6 7.6 0 0 0 1.7-1l2.5 1 2-3.5ZM13 15.5A3.5 3.5 0 1 1 16.5 12 3.5 3.5 0 0 1 13 15.5Z' },
];

type Props = {
  attiva: Scheda;
  onCambia: (scheda: Scheda) => void;
};

export default function BarraSchede({ attiva, onCambia }: Props) {
  return (
    <nav
      aria-label="Navigazione principale"
      className="fixed inset-x-0 bottom-0 z-10 print:hidden border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-xl">
        {SCHEDE.map((s) => {
          const selezionata = s.id === attiva;
          return (
            <li key={s.id} className="flex-1">
              <button
                type="button"
                onClick={() => onCambia(s.id)}
                aria-current={selezionata ? 'page' : undefined}
                className={`flex min-h-16 w-full flex-col items-center justify-center gap-1 text-xs font-medium ${
                  selezionata ? 'text-teal-700' : 'text-slate-500'
                }`}
              >
                <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor" aria-hidden="true">
                  <path d={s.icona} />
                </svg>
                {s.etichetta}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
