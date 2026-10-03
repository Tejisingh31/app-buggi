import { useMemo, useState } from 'react';
import { stileInput } from '../components/Campo';
import Contatti from '../components/Contatti';
import { usePagamenti } from '../components/GestorePagamenti';
import Pagina, { Caricamento, StatoVuoto } from '../components/Pagina';
import Pulsante from '../components/Pulsante';
import { useDati } from '../hooks/useDati';
import { filtraMancanti, mancanti, totaleResiduo, type VoceMancante } from '../logic/statistiche';
import { percorso, vai } from '../navigazione';
import { oggiIso, daIso } from '../utils/date';
import { dataLeggibile, MESI } from '../utils/descrizioni';
import { formattaEuro } from '../utils/formattazione';
import { differenceInCalendarDays } from 'date-fns';

const ricordo = { categoria: '', mese: '' };

export default function Mancanti() {
  const dati = useDati();
  const { apriPagamento } = usePagamenti();
  const [categoria, setCategoria] = useState(ricordo.categoria);
  const [mese, setMese] = useState(ricordo.mese);
  ricordo.categoria = categoria;
  ricordo.mese = mese;
  const oggi = oggiIso();

  const gruppi = useMemo(() => {
    if (!dati) return undefined;
    const g = mancanti(dati, oggi, dati.impostazioni.giorniTolleranza);
    // senza scadenze future si vedono solo i ritardi
    return dati.impostazioni.mostraFuturo ? g : { ...g, questaSettimana: [], prossime: [] };
  }, [dati, oggi]);
  if (!dati || !gruppi) return <Caricamento />;

  const tutte = [...gruppi.inRitardo, ...gruppi.questaSettimana, ...gruppi.prossime];
  const categorie = [...new Set(tutte.map((v) => v.persona.categoria).filter((c): c is string => !!c))].sort();
  const mesi = [...new Set(tutte.map((v) => v.scadenza.dataScadenza.slice(0, 7)))].sort();
  const filtrati = filtraMancanti(gruppi, { categoria, mese });
  const valuta = dati.impostazioni.valuta;
  const euro = (c: number) => formattaEuro(c, valuta);
  const nomePiano = new Map(dati.piani.map((p) => [p.id, p.descrizione]));
  const nessunaVoce = filtrati.inRitardo.length + filtrati.questaSettimana.length + filtrati.prossime.length === 0;

  const riga = (v: VoceMancante) => {
    const giorni = differenceInCalendarDays(daIso(v.scadenza.dataScadenza), daIso(oggi));
    const quando =
      v.stato === 'inRitardo'
        ? `in ritardo di ${v.giorniRitardo} ${v.giorniRitardo === 1 ? 'giorno' : 'giorni'}`
        : giorni === 0
          ? 'scade oggi'
          : giorni < 0
            ? 'scaduta, in tolleranza'
            : giorni === 1
              ? 'scade domani'
              : `tra ${giorni} giorni`;
    return (
      <li key={v.scadenza.id} className="flex flex-wrap items-center gap-2 p-3">
        <button type="button" onClick={() => vai(percorso.persona(v.persona.id))} className="min-w-[55%] flex-1 text-left">
          <p className="truncate text-lg font-semibold text-slate-900">{v.persona.nome}</p>
          <p className="truncate text-sm text-slate-600">
            {dataLeggibile(v.scadenza.dataScadenza)} · {nomePiano.get(v.scadenza.pianoId) ?? 'Quota'}
          </p>
          <p className="text-base">
            <strong className={v.stato === 'inRitardo' ? 'text-red-700' : 'text-slate-900'}>{euro(v.residuo)}</strong>{' '}
            <span className={`text-sm ${v.stato === 'inRitardo' ? 'text-red-700' : 'text-slate-500'}`}>{quando}</span>
            {v.parziale && <span className="text-sm text-amber-800"> · parziale</span>}
          </p>
        </button>
        <div className="ml-auto flex gap-2">
          {v.stato === 'inRitardo' && <Contatti telefono={v.persona.telefono} nome={v.persona.nome} />}
        <Pulsante
          variante="secondario"
          className="shrink-0 border-green-600 px-3 text-green-800"
          onClick={() => apriPagamento({ personaId: v.persona.id, scadenzaId: v.scadenza.id })}
        >
          ✓ Pagato
        </Pulsante>
        </div>
      </li>
    );
  };

  const gruppo = (titolo: string, voci: VoceMancante[], colore: string) =>
    voci.length > 0 && (
      <section className="mt-5">
        <div className={`mb-2 flex items-baseline justify-between rounded-xl px-3 py-2 ${colore}`}>
          <h2 className="text-lg font-bold">
            {titolo} <span className="font-normal">({voci.length})</span>
          </h2>
          <p className="text-lg font-bold">{euro(totaleResiduo(voci))}</p>
        </div>
        <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">{voci.map(riga)}</ul>
      </section>
    );

  return (
    <Pagina titolo="Mancanti">
      {tutte.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-sm text-slate-600">Categoria</span>
            <select className={`${stileInput} appearance-auto text-base`} value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              <option value="">Tutte</option>
              {categorie.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm text-slate-600">Mese</span>
            <select className={`${stileInput} appearance-auto text-base`} value={mese} onChange={(e) => setMese(e.target.value)}>
              <option value="">Tutti</option>
              {mesi.map((m) => (
                <option key={m} value={m}>
                  {MESI[Number(m.slice(5)) - 1]} {m.slice(0, 4)}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {tutte.length === 0 ? (
        <StatoVuoto
          titolo={dati.impostazioni.mostraFuturo ? 'Nessun pagamento mancante' : 'Nessuno è in ritardo'}
          testo={dati.persone.length ? 'Tutti sono in regola con i pagamenti. 🎉' : 'Quando aggiungerai persone e quote, qui vedrai chi è in ritardo.'}
        />
      ) : nessunaVoce ? (
        <div className="mt-4">
          <StatoVuoto titolo="Nessun risultato" testo="Nessuna scadenza da pagare con questi filtri.">
            <Pulsante
              variante="secondario"
              onClick={() => {
                setCategoria('');
                setMese('');
              }}
            >
              Togli i filtri
            </Pulsante>
          </StatoVuoto>
        </div>
      ) : (
        <>
          {gruppo('In ritardo', filtrati.inRitardo, 'bg-red-100 text-red-900')}
          {gruppo('Questa settimana', filtrati.questaSettimana, 'bg-amber-100 text-amber-950')}
          {gruppo('Prossime', filtrati.prossime, 'bg-slate-200 text-slate-900')}
        </>
      )}
    </Pagina>
  );
}
