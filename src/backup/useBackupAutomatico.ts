import { useEffect } from 'react';
import { eseguiBackupAutomatico } from './automatico';

const OGNI = 30 * 60_000;
let inCorso = false;

async function prova() {
  if (inCorso) return;
  inCorso = true;
  try {
    await eseguiBackupAutomatico();
  } catch (e) {
    console.warn('Backup automatico non riuscito', e);
  } finally {
    inCorso = false;
  }
}

/** Avvia il backup automatico: all'apertura, quando l'app torna in primo piano e ogni 30 minuti. */
export function useBackupAutomatico(attivo: boolean): void {
  useEffect(() => {
    if (!attivo) return;
    void prova();
    const quandoVisibile = () => {
      if (document.visibilityState === 'visible') void prova();
    };
    document.addEventListener('visibilitychange', quandoVisibile);
    const timer = window.setInterval(prova, OGNI);
    return () => {
      document.removeEventListener('visibilitychange', quandoVisibile);
      window.clearInterval(timer);
    };
  }, [attivo]);
}
