import { useCallback, useEffect, useRef, useState } from 'react';
import type { Impostazioni } from '../db/tipi';

/** Evento per bloccare subito l'app (pulsante "Blocca ora" in Impostazioni). */
export const EVENTO_BLOCCA = 'buggi:blocca';
export const bloccaOra = () => window.dispatchEvent(new Event(EVENTO_BLOCCA));

/**
 * Stato del blocco con PIN.
 * - All'apertura dell'app: bloccata se c'è un PIN.
 * - Blocco automatico dopo N minuti con l'app in background.
 */
export function useBlocco(imp: Impostazioni | undefined) {
  const [bloccata, setBloccata] = useState<boolean | null>(null);
  const nascostaDa = useRef<number | null>(null);
  const conPin = !!imp?.pinHash;
  const minuti = imp?.bloccoAutomaticoMinuti ?? 5;

  // la prima volta che arrivano le impostazioni
  useEffect(() => {
    if (imp && bloccata === null) setBloccata(conPin);
  }, [imp, conPin, bloccata]);

  useEffect(() => {
    if (!conPin) return;
    const cambio = () => {
      if (document.visibilityState === 'hidden') {
        nascostaDa.current = Date.now();
      } else if (nascostaDa.current !== null) {
        if (Date.now() - nascostaDa.current >= minuti * 60_000) setBloccata(true);
        nascostaDa.current = null;
      }
    };
    const blocca = () => setBloccata(true);
    document.addEventListener('visibilitychange', cambio);
    window.addEventListener(EVENTO_BLOCCA, blocca);
    return () => {
      document.removeEventListener('visibilitychange', cambio);
      window.removeEventListener(EVENTO_BLOCCA, blocca);
    };
  }, [conPin, minuti]);

  const sblocca = useCallback(() => setBloccata(false), []);
  return { pronto: bloccata !== null, bloccata: conPin && bloccata === true, sblocca };
}
