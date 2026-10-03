import type { ColoreStato } from '../logic/stato';

const ASPETTO: Record<ColoreStato, { testo: string; classi: string }> = {
  verde: { testo: 'In regola', classi: 'bg-green-100 text-green-800' },
  giallo: { testo: 'Da pagare', classi: 'bg-amber-100 text-amber-900' },
  rosso: { testo: 'In ritardo', classi: 'bg-red-100 text-red-800' },
};

/** Etichetta colorata dello stato (oltre al colore c'è sempre il testo). */
export default function BadgeStato({ colore, archiviata }: { colore: ColoreStato; archiviata?: boolean }) {
  if (archiviata) {
    return <span className="rounded-full bg-slate-200 px-2.5 py-1 text-sm font-semibold text-slate-700">Archiviata</span>;
  }
  const { testo, classi } = ASPETTO[colore];
  return <span className={`rounded-full px-2.5 py-1 text-sm font-semibold ${classi}`}>{testo}</span>;
}
