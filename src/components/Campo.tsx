import type { ReactNode } from 'react';

export const stileInput =
  'block min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-lg text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-600/30 focus:outline-none';

type Props = {
  etichetta: string;
  /** id del campo, per collegare l'etichetta */
  per?: string;
  aiuto?: string;
  errore?: string;
  children: ReactNode;
};

export default function Campo({ etichetta, per, aiuto, errore, children }: Props) {
  return (
    <div className="space-y-1">
      <label htmlFor={per} className="block text-base font-medium text-slate-700">
        {etichetta}
      </label>
      {children}
      {aiuto && !errore && <p className="text-sm text-slate-500">{aiuto}</p>}
      {errore && (
        <p className="text-sm font-medium text-red-700" role="alert">
          {errore}
        </p>
      )}
    </div>
  );
}

/** Gruppo di scelte grandi una accanto all'altra (es. "Una data" / "Si ripete"). */
export function SceltaGrande<T extends string>({
  valore,
  opzioni,
  onCambia,
  etichetta,
  colonne,
}: {
  valore: T;
  opzioni: { valore: T; testo: string }[];
  onCambia: (v: T) => void;
  etichetta: string;
  /** con 2 le scelte vanno su due colonne (per 4 opzioni) */
  colonne?: 2;
}) {
  return (
    <div role="radiogroup" aria-label={etichetta} className={`grid gap-2 ${colonne === 2 ? 'grid-cols-2' : 'auto-cols-fr grid-flow-col'}`}>
      {opzioni.map((o) => {
        const scelta = o.valore === valore;
        return (
          <button
            key={o.valore}
            type="button"
            role="radio"
            aria-checked={scelta}
            onClick={() => onCambia(o.valore)}
            className={`min-h-14 rounded-xl border-2 px-2 text-base font-semibold ${
              scelta ? 'border-teal-600 bg-teal-50 text-teal-800' : 'border-slate-200 bg-white text-slate-600'
            }`}
          >
            {o.testo}
          </button>
        );
      })}
    </div>
  );
}
