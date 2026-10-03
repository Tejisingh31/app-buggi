import { useMemo, useState } from 'react';
import BarraRicerca from '../components/BarraRicerca';
import CartaPersona from '../components/CartaPersona';
import { usePagamenti } from '../components/GestorePagamenti';
import Scorrevole from '../components/Scorrevole';
import Pagina, { Caricamento, StatoVuoto } from '../components/Pagina';
import Pulsante from '../components/Pulsante';
import { useDati } from '../hooks/useDati';
import { statiPersone } from '../logic/statistiche';
import { percorso, vai } from '../navigazione';
import { oggiIso } from '../utils/date';
import { corrisponde } from '../utils/testo';

type Filtro = 'tutti' | 'ritardo' | 'regola' | 'archiviati';

const FILTRI: { id: Filtro; testo: string }[] = [
  { id: 'tutti', testo: 'Tutti' },
  { id: 'ritardo', testo: 'In ritardo' },
  { id: 'regola', testo: 'In regola' },
  { id: 'archiviati', testo: 'Archiviati' },
];

/** Ricerca e filtro restano uguali tornando indietro dalla scheda di una persona. */
const ricordo: { cerca: string; filtro: Filtro } = { cerca: '', filtro: 'tutti' };

export default function Persone() {
  const dati = useDati();
  const { apriPagamento } = usePagamenti();
  const [cerca, setCerca] = useState(ricordo.cerca);
  const [filtro, setFiltro] = useState<Filtro>(ricordo.filtro);
  ricordo.cerca = cerca;
  ricordo.filtro = filtro;

  const oggi = oggiIso();
  const stati = useMemo(
    () => (dati ? statiPersone(dati, oggi, dati.impostazioni.giorniTolleranza) : new Map()),
    [dati, oggi],
  );

  const pulsanteNuova = (
    <Pulsante onClick={() => vai(percorso.nuovaPersona())} aria-label="Nuova persona">
      <span aria-hidden="true" className="text-2xl leading-none">
        +
      </span>
      Nuova
    </Pulsante>
  );

  if (!dati) return <Caricamento />;

  const conteggio = (f: Filtro) => dati.persone.filter((p) => passaFiltro(f, p.attivo, stati.get(p.id)?.colore)).length;
  const visibili = dati.persone.filter(
    (p) =>
      passaFiltro(filtro, p.attivo, stati.get(p.id)?.colore) &&
      corrisponde(cerca, [p.nome, p.categoria, p.telefono, p.email, p.note]),
  );

  return (
    <Pagina titolo="Persone" azione={pulsanteNuova}>
      <div className="sticky top-[env(safe-area-inset-top)] z-10 -mx-4 space-y-2 bg-slate-50 px-4 pt-1 pb-3">
        <BarraRicerca valore={cerca} onCambia={setCerca} segnaposto="Cerca nome, categoria, telefono…" />
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtra">
          {FILTRI.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filtro === f.id}
              onClick={() => setFiltro(f.id)}
              className={`min-h-11 shrink-0 rounded-full border px-4 text-base font-medium ${
                filtro === f.id ? 'border-(--accento) bg-(--accento) text-[#fff]' : 'border-slate-300 bg-white text-slate-700'
              }`}
            >
              {f.testo} <span className="opacity-75">{conteggio(f.id)}</span>
            </button>
          ))}
        </div>
      </div>

      {dati.persone.length === 0 ? (
        <StatoVuoto titolo="Ancora nessuna persona" testo="Aggiungi la prima persona per iniziare a registrare quote e pagamenti.">
          <Pulsante onClick={() => vai(percorso.nuovaPersona())}>Aggiungi una persona</Pulsante>
        </StatoVuoto>
      ) : visibili.length === 0 ? (
        <StatoVuoto
          titolo="Nessun risultato"
          testo={cerca ? `Nessuna persona corrisponde a «${cerca}» con questo filtro.` : messaggioFiltroVuoto(filtro)}
        />
      ) : (
        <ul className="space-y-2">
          {visibili.map((p) => (
            <li key={p.id}>
              {p.attivo ? (
                <Scorrevole etichetta="Pagato" onAzione={() => apriPagamento({ personaId: p.id })}>
                  <CartaPersona persona={p} stato={stati.get(p.id)!} valuta={dati.impostazioni.valuta} mostraFuturo={!!dati.impostazioni.mostraFuturo} />
                </Scorrevole>
              ) : (
                <CartaPersona persona={p} stato={stati.get(p.id)!} valuta={dati.impostazioni.valuta} mostraFuturo={!!dati.impostazioni.mostraFuturo} />
              )}
            </li>
          ))}
        </ul>
      )}
      {filtro !== 'archiviati' && visibili.length > 0 && (
        <p className="mt-4 text-center text-sm text-slate-500">
          Suggerimento: scorri una persona verso sinistra per segnare «Pagato».
        </p>
      )}
    </Pagina>
  );
}

function passaFiltro(filtro: Filtro, attivo: boolean, colore?: string): boolean {
  switch (filtro) {
    case 'tutti':
      return attivo;
    case 'ritardo':
      return attivo && colore === 'rosso';
    case 'regola':
      return attivo && colore !== 'rosso';
    case 'archiviati':
      return !attivo;
  }
}

function messaggioFiltroVuoto(filtro: Filtro): string {
  switch (filtro) {
    case 'ritardo':
      return 'Ottimo: nessuno è in ritardo.';
    case 'regola':
      return 'Nessuna persona è in regola al momento.';
    case 'archiviati':
      return 'Non hai archiviato nessuna persona.';
    default:
      return 'Tutte le persone sono archiviate.';
  }
}
