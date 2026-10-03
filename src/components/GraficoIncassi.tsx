import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { IncassoMese } from '../logic/statistiche';
import { formattaEuro } from '../utils/formattazione';

/** Grafico a barre degli incassi degli ultimi 12 mesi. */
export default function GraficoIncassi({ mesi, valuta }: { mesi: IncassoMese[]; valuta: string }) {
  const righe = mesi.map((m) => ({ ...m, euro: m.totale / 100 }));
  return (
    <div className="h-56 w-full" role="img" aria-label={descrizione(mesi, valuta)}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={righe} margin={{ top: 8, right: 4, bottom: 0, left: -8 }}>
          <CartesianGrid vertical={false} stroke="var(--color-slate-200)" />
          <XAxis
            dataKey="etichetta"
            tickFormatter={(e: string) => e.slice(0, 3)}
            interval={0}
            tick={{ fontSize: 11, fill: 'var(--color-slate-500)' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            width={48}
            tick={{ fontSize: 11, fill: 'var(--color-slate-500)' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : String(v))}
          />
          <Tooltip
            cursor={{ fill: 'var(--color-slate-100)' }}
            formatter={(v) => [formattaEuro(Math.round(Number(v) * 100), valuta), 'Incassato']}
            labelFormatter={(e) => String(e)}
            contentStyle={{ borderRadius: 12, border: '1px solid var(--color-slate-200)', background: 'var(--color-white)', color: 'var(--color-slate-900)' }}
          />
          <Bar dataKey="euro" fill="var(--color-teal-600)" radius={[6, 6, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Testo per chi usa un lettore di schermo. */
function descrizione(mesi: IncassoMese[], valuta: string): string {
  return 'Incassi ultimi 12 mesi: ' + mesi.map((m) => `${m.etichetta} ${formattaEuro(m.totale, valuta)}`).join(', ');
}
