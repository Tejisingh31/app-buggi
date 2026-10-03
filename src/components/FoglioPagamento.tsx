import { useMemo, useState, type FormEvent } from 'react';
import { creaPagamento } from '../db/repository';
import type { MetodoPagamento, Pagamento } from '../db/tipi';
import type { Dati } from '../hooks/useDati';
import { statoPersona } from '../logic/stato';
import { oggiIso } from '../utils/date';
import { dataLeggibile } from '../utils/descrizioni';
import { formattaEuro } from '../utils/formattazione';
import { importoPerInput, leggiImporto } from '../utils/importi';
import Campo, { SceltaGrande, stileInput } from './Campo';
import Foglio from './Foglio';
import Pulsante from './Pulsante';

export const METODI: { valore: MetodoPagamento; testo: string }[] = [
  { valore: 'contanti', testo: 'Contanti' },
  { valore: 'bonifico', testo: 'Bonifico' },
  { valore: 'carta', testo: 'Carta' },
  { valore: 'altro', testo: 'Altro' },
];

const ACCONTO = 'acconto';
const CHIAVE_METODO = 'buggi.ultimoMetodo';

function ultimoMetodo(): MetodoPagamento {
  try {
    const m = localStorage.getItem(CHIAVE_METODO);
    if (METODI.some((x) => x.valore === m)) return m as MetodoPagamento;
  } catch {
    /* memoria del browser non disponibile */
  }
  return 'contanti';
}

type Props = {
  dati: Dati;
  personaId: string;
  /** scadenza da pagare; se manca si propone la più vecchia ancora aperta */
  scadenzaId?: string;
  onChiudi: () => void;
  onRegistrato: (pagamento: Pagamento, nome: string) => void;
};

/**
 * Foglio per registrare un pagamento: importo e data di oggi già compilati,
 * basta toccare "Conferma".
 */
export default function FoglioPagamento({ dati, personaId, scadenzaId, onChiudi, onRegistrato }: Props) {
  const oggi = oggiIso();
  const persona = dati.persone.find((p) => p.id === personaId);

  // Scadenze ancora da pagare: quelle già arrivate più la prossima.
  const aperte = useMemo(() => {
    const stato = statoPersona(
      dati.scadenze.filter((s) => s.personaId === personaId),
      dati.pagamenti.filter((p) => p.personaId === personaId),
      oggi,
      dati.impostazioni.giorniTolleranza,
    );
    const daPagare = stato.scadenze.filter((c) => c.residuo > 0);
    const arrivate = daPagare.filter((c) => c.scadenza.dataScadenza <= oggi);
    const prossima = daPagare.find((c) => c.scadenza.dataScadenza > oggi);
    const elenco = prossima ? [...arrivate, prossima] : arrivate;
    // se è stata chiesta una scadenza precisa, deve esserci anche se è più avanti
    const richiesta = daPagare.find((c) => c.scadenza.id === scadenzaId);
    if (richiesta && !elenco.includes(richiesta)) elenco.push(richiesta);
    return elenco;
  }, [dati, personaId, scadenzaId, oggi]);

  const nomePiano = new Map(dati.piani.map((p) => [p.id, p.descrizione]));
  const iniziale = aperte.find((c) => c.scadenza.id === scadenzaId) ?? aperte[0];

  const [scelta, setScelta] = useState(iniziale?.scadenza.id ?? ACCONTO);
  const [importoTesto, setImportoTesto] = useState(iniziale ? importoPerInput(iniziale.residuo) : '');
  const [importoToccato, setImportoToccato] = useState(false);
  const [data, setData] = useState(oggi);
  const [metodo, setMetodo] = useState<MetodoPagamento>(ultimoMetodo);
  const [nota, setNota] = useState('');
  const [errore, setErrore] = useState('');
  const [salvando, setSalvando] = useState(false);

  const valuta = dati.impostazioni.valuta;
  const importo = leggiImporto(importoTesto);

  function cambiaScelta(id: string) {
    setScelta(id);
    const c = aperte.find((x) => x.scadenza.id === id);
    if (!importoToccato) setImportoTesto(c ? importoPerInput(c.residuo) : '');
  }

  async function conferma(e: FormEvent) {
    e.preventDefault();
    if (!importo) {
      setErrore('Scrivi un importo maggiore di zero, es. 50 oppure 12,50');
      return;
    }
    if (!data) {
      setErrore('Scegli la data del pagamento');
      return;
    }
    setSalvando(true);
    try {
      const pagamento = await creaPagamento({
        personaId,
        scadenzaId: scelta === ACCONTO ? undefined : scelta,
        dataPagamento: data,
        importo,
        metodo,
        nota: nota.trim() || undefined,
      });
      try {
        localStorage.setItem(CHIAVE_METODO, metodo);
      } catch {
        /* non importa */
      }
      onRegistrato(pagamento, persona?.nome ?? '');
    } catch (err) {
      setErrore(err instanceof Error ? err.message : 'Salvataggio non riuscito');
      setSalvando(false);
    }
  }

  if (!persona) return null;

  return (
    <Foglio titolo={`Pagamento di ${persona.nome}`} onChiudi={onChiudi}>
      <form onSubmit={conferma} className="space-y-4" noValidate>
        <Campo etichetta={valuta ? `Importo (${valuta})` : 'Importo'} per="pag-importo" errore={errore}>
          <input
            id="pag-importo"
            inputMode="decimal"
            className={`${stileInput} min-h-14 text-2xl font-bold`}
            value={importoTesto}
            onChange={(e) => {
              setImportoTesto(e.target.value);
              setImportoToccato(true);
              setErrore('');
            }}
            placeholder="0,00"
            autoComplete="off"
          />
        </Campo>

        <Campo etichetta="Per" per="pag-scadenza">
          <select id="pag-scadenza" className={`${stileInput} appearance-auto`} value={scelta} onChange={(e) => cambiaScelta(e.target.value)}>
            {aperte.map((c) => (
              <option key={c.scadenza.id} value={c.scadenza.id}>
                {dataLeggibile(c.scadenza.dataScadenza)} · {nomePiano.get(c.scadenza.pianoId) ?? 'Quota'} · {formattaEuro(c.residuo, valuta)}
                {c.stato === 'inRitardo' ? ' (in ritardo)' : ''}
              </option>
            ))}
            <option value={ACCONTO}>Acconto libero (senza scadenza)</option>
          </select>
        </Campo>

        <Campo etichetta="Data del pagamento" per="pag-data">
          <input id="pag-data" type="date" className={stileInput} value={data} onChange={(e) => setData(e.target.value)} />
        </Campo>

        <div className="space-y-1">
          <p className="text-base font-medium text-slate-700">Metodo</p>
          <SceltaGrande etichetta="Metodo" valore={metodo} onCambia={setMetodo} opzioni={METODI} colonne={2} />
        </div>

        <Campo etichetta="Nota (facoltativa)" per="pag-nota">
          <input id="pag-nota" className={stileInput} value={nota} onChange={(e) => setNota(e.target.value)} autoComplete="off" />
        </Campo>

        <Pulsante type="submit" largo disabled={salvando} className="min-h-14 text-lg">
          Conferma{importo ? ` ${formattaEuro(importo, valuta)}` : ''}
        </Pulsante>
      </form>
    </Foglio>
  );
}
