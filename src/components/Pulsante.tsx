import type { ButtonHTMLAttributes, Ref } from 'react';

type Variante = 'primario' | 'secondario' | 'pericolo' | 'leggero';

const STILI: Record<Variante, string> = {
  primario: 'bg-(--accento) text-[#fff] active:brightness-90 disabled:bg-slate-300 disabled:text-slate-700',
  secondario: 'border border-slate-300 bg-white text-slate-800 active:bg-slate-100',
  pericolo: 'bg-[#b91c1c] text-[#fff] active:brightness-90',
  leggero: 'text-teal-700 active:bg-teal-50',
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: Variante;
  largo?: boolean;
  ref?: Ref<HTMLButtonElement>;
};

/** Pulsante grande (almeno 44px di altezza). */
export default function Pulsante({ variante = 'primario', largo, className = '', type = 'button', ...resto }: Props) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-base font-semibold ${STILI[variante]} ${largo ? 'w-full' : ''} ${className}`}
      {...resto}
    />
  );
}

/** Stile per un link <a> che sembra un pulsante. */
export const stileLinkPulsante =
  'inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-base font-semibold text-slate-800 active:bg-slate-100';
