import { useState, type FormEvent } from 'react';
import Campo, { stileInput } from '../components/Campo';
import Conferma from '../components/Conferma';
import Pagina, { Caricamento, StatoVuoto } from '../components/Pagina';
import Pulsante from '../components/Pulsante';
import {
  aggiornaImpostazioni,
  aggiornaPersona,
  creaPersona,
  eliminaPersona,
  impostaPersonaAttiva,
  sincronizzaScadenze,
} from '../db/repository';
import type { Persona } from '../db/tipi';
import { useDati, type Dati } from '../hooks/useDati';
import { percorso, vai } from '../navigazione';

/** Crea una nuova persona (senza id) o modifica quella con l'id indicato. */
export default function ModuloPersona({ id }: { id?: string }) {
  const dati = useDati();
  if (!dati) return <Caricamento />;
  const persona = id ? dati.persone.find((p) => p.id === id) : undefined;
  if (id && !persona) {
    return (
      <Pagina titolo="Persona" indietro={percorso.persone()}>
        <StatoVuoto titolo="Persona non trovata" testo="Forse è stata eliminata." />
      </Pagina>
    );
  }
  return <Modulo key={id ?? 'nuova'} persona={persona} dati={dati} />;
}

function Modulo({ persona, dati }: { persona?: Persona; dati: Dati }) {
  const [nome, setNome] = useState(persona?.nome ?? '');
  const [telefono, setTelefono] = useState(persona?.telefono ?? '');
  const [email, setEmail] = useState(persona?.email ?? '');
  const [categoria, setCategoria] = useState(persona?.categoria ?? '');
  const [note, setNote] = useState(persona?.note ?? '');
  const [errore, setErrore] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [chiedi, setChiedi] = useState<'elimina' | 'archivia' | null>(null);

  const categorieNote = [
    ...new Set([...dati.impostazioni.categorie, ...dati.persone.map((p) => p.categoria).filter((c): c is string => !!c)]),
  ].sort((a, b) => a.localeCompare(b, 'it'));

  async function salva(e: FormEvent) {
    e.preventDefault();
    if (!nome.trim()) {
      setErrore('Scrivi il nome');
      return;
    }
    setSalvando(true);
    try {
      const campi = {
        nome,
        telefono: telefono.trim() || undefined,
        email: email.trim() || undefined,
        categoria: categoria.trim() || undefined,
        note: note.trim() || undefined,
      };
      const cat = campi.categoria;
      if (cat && !dati.impostazioni.categorie.includes(cat)) {
        await aggiornaImpostazioni({ categorie: [...dati.impostazioni.categorie, cat] });
      }
      if (persona) {
        await aggiornaPersona(persona.id, campi);
        vai(percorso.persona(persona.id), true);
      } else {
        const nuova = await creaPersona(campi);
        vai(percorso.persona(nuova.id), true);
      }
    } catch (err) {
      setErrore(err instanceof Error ? err.message : 'Salvataggio non riuscito');
      setSalvando(false);
    }
  }

  async function cambiaArchivio() {
    if (!persona) return;
    await impostaPersonaAttiva(persona.id, !persona.attivo);
    if (!persona.attivo) await sincronizzaScadenze();
    setChiedi(null);
    vai(percorso.persona(persona.id), true);
  }

  async function elimina() {
    if (!persona) return;
    await eliminaPersona(persona.id);
    setChiedi(null);
    vai(percorso.persone(), true);
  }

  const numPiani = persona ? dati.piani.filter((p) => p.personaId === persona.id).length : 0;
  const numPagamenti = persona ? dati.pagamenti.filter((p) => p.personaId === persona.id).length : 0;

  return (
    <Pagina
      titolo={persona ? 'Modifica persona' : 'Nuova persona'}
      indietro={persona ? percorso.persona(persona.id) : percorso.persone()}
    >
      <form onSubmit={salva} className="space-y-4" noValidate>
        <Campo etichetta="Nome *" per="nome" errore={errore}>
          <input
            id="nome"
            className={stileInput}
            value={nome}
            onChange={(e) => {
              setNome(e.target.value);
              setErrore('');
            }}
            autoComplete="off"
            autoCapitalize="words"
            autoFocus={!persona}
            required
          />
        </Campo>
        <Campo etichetta="Telefono" per="telefono" aiuto="Serve per chiamare o scrivere su WhatsApp con un tocco.">
          <input
            id="telefono"
            type="tel"
            inputMode="tel"
            className={stileInput}
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            autoComplete="off"
          />
        </Campo>
        <Campo etichetta="Email" per="email">
          <input
            id="email"
            type="email"
            inputMode="email"
            className={stileInput}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="off"
          />
        </Campo>
        <Campo etichetta="Categoria" per="categoria" aiuto="Es. squadra, affitto, corso. Puoi sceglierne una già usata o scriverne una nuova.">
          <input
            id="categoria"
            list="elenco-categorie"
            className={stileInput}
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            autoComplete="off"
          />
          <datalist id="elenco-categorie">
            {categorieNote.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Campo>
        <Campo etichetta="Note" per="note">
          <textarea id="note" rows={3} className={`${stileInput} py-2`} value={note} onChange={(e) => setNote(e.target.value)} />
        </Campo>

        <Pulsante type="submit" largo disabled={salvando}>
          {persona ? 'Salva modifiche' : 'Aggiungi persona'}
        </Pulsante>
      </form>

      {persona && (
        <div className="mt-10 space-y-3 border-t border-slate-200 pt-6">
          <Pulsante variante="secondario" largo onClick={() => (persona.attivo ? setChiedi('archivia') : cambiaArchivio())}>
            {persona.attivo ? 'Archivia persona' : 'Riattiva persona'}
          </Pulsante>
          <p className="text-sm text-slate-500">
            {persona.attivo
              ? 'Archiviando, la persona sparisce dagli elenchi ma lo storico dei pagamenti resta.'
              : 'Riattivando, torneranno a essere create le sue scadenze.'}
          </p>
          <Pulsante variante="leggero" largo className="text-red-700 active:bg-red-50" onClick={() => setChiedi('elimina')}>
            Elimina definitivamente
          </Pulsante>
        </div>
      )}

      <Conferma
        aperta={chiedi === 'archivia'}
        titolo={`Archiviare ${persona?.nome}?`}
        testo="Non comparirà più negli elenchi e non verranno create nuove scadenze. Lo storico resta e puoi riattivarla quando vuoi dal filtro «Archiviati»."
        etichettaConferma="Archivia"
        onConferma={cambiaArchivio}
        onAnnulla={() => setChiedi(null)}
      />
      <Conferma
        aperta={chiedi === 'elimina'}
        titolo={`Eliminare ${persona?.nome}?`}
        testo={`Verranno cancellati anche ${numPiani} ${numPiani === 1 ? 'quota' : 'quote'} e ${numPagamenti} ${
          numPagamenti === 1 ? 'pagamento' : 'pagamenti'
        }. Non si può annullare. Se vuoi solo nasconderla, usa «Archivia».`}
        etichettaConferma="Elimina per sempre"
        pericolo
        onConferma={elimina}
        onAnnulla={() => setChiedi(null)}
      />
    </Pagina>
  );
}
