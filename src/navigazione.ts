import { useEffect, useState } from 'react';

export type Scheda = 'dashboard' | 'persone' | 'mancanti' | 'impostazioni';

/** Tutte le pagine dell'app; l'indirizzo è nella parte dopo "#", così il tasto "indietro" funziona. */
export type Rotta =
  | { pagina: 'dashboard' }
  | { pagina: 'persone' }
  | { pagina: 'mancanti' }
  | { pagina: 'impostazioni' }
  | { pagina: 'report' }
  | { pagina: 'nuovaPersona' }
  | { pagina: 'persona'; id: string }
  | { pagina: 'modificaPersona'; id: string }
  | { pagina: 'nuovoPiano'; personaId: string }
  | { pagina: 'modificaPiano'; personaId: string; pianoId: string };

/** Indirizzi delle pagine. */
export const percorso = {
  persone: () => '/persone',
  nuovaPersona: () => '/persone/nuova',
  persona: (id: string) => `/persone/${encodeURIComponent(id)}`,
  modificaPersona: (id: string) => `/persone/${encodeURIComponent(id)}/modifica`,
  nuovoPiano: (personaId: string) => `/persone/${encodeURIComponent(personaId)}/quota/nuova`,
  modificaPiano: (personaId: string, pianoId: string) =>
    `/persone/${encodeURIComponent(personaId)}/quota/${encodeURIComponent(pianoId)}`,
};

export function leggiRotta(hash: string): Rotta {
  const [a, b, c, d] = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  switch (a) {
    case 'persone':
      if (!b) return { pagina: 'persone' };
      if (b === 'nuova' && !c) return { pagina: 'nuovaPersona' };
      if (!c) return { pagina: 'persona', id: b };
      if (c === 'modifica') return { pagina: 'modificaPersona', id: b };
      if (c === 'quota' && d === 'nuova') return { pagina: 'nuovoPiano', personaId: b };
      if (c === 'quota' && d) return { pagina: 'modificaPiano', personaId: b, pianoId: d };
      return { pagina: 'persona', id: b };
    case 'mancanti':
    case 'impostazioni':
    case 'dashboard':
    case 'report':
      return { pagina: a };
    default:
      return { pagina: 'dashboard' };
  }
}

/** A quale scheda in basso appartiene la pagina. */
export function schedaDi(rotta: Rotta): Scheda {
  switch (rotta.pagina) {
    case 'dashboard':
    case 'mancanti':
    case 'impostazioni':
      return rotta.pagina;
    case 'report':
      return 'impostazioni';
    default:
      return 'persone';
  }
}

/**
 * Va a una pagina. Con `sostituisci` la pagina attuale non resta nella cronologia
 * (es. dopo aver salvato un modulo, "indietro" non riapre il modulo).
 */
export function vai(destinazione: string, sostituisci = false): void {
  if (sostituisci) window.location.replace('#' + destinazione);
  else window.location.hash = destinazione;
  window.scrollTo(0, 0);
}

export function useRotta(): Rotta {
  const [rotta, setRotta] = useState(() => leggiRotta(window.location.hash));
  useEffect(() => {
    const aggiorna = () => setRotta(leggiRotta(window.location.hash));
    window.addEventListener('hashchange', aggiorna);
    return () => window.removeEventListener('hashchange', aggiorna);
  }, []);
  return rotta;
}
