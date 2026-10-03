import { useEffect, useRef } from 'react';
import type { Tema } from '../db/tipi';

/** Copia del tema nel browser: serve ad applicarlo subito all'apertura, prima che il database risponda. */
const CHIAVE = 'buggi.tema';

const scuroDiSistema = () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;

/** Mette o toglie il tema scuro sulla pagina. */
export function applicaTema(tema: Tema): void {
  const scuro = tema === 'scuro' || (tema === 'sistema' && scuroDiSistema());
  document.documentElement.classList.toggle('dark', scuro);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', scuro ? '#0b1120' : '#0d9488');
  try {
    localStorage.setItem(CHIAVE, tema);
  } catch {
    /* memoria del browser non disponibile */
  }
}

export function temaSalvato(): Tema {
  try {
    const t = localStorage.getItem(CHIAVE);
    if (t === 'chiaro' || t === 'scuro' || t === 'sistema') return t;
  } catch {
    /* niente */
  }
  return 'sistema';
}

/** Applica il tema scelto nelle impostazioni e lo aggiorna se cambia quello del telefono. In stampa sempre chiaro. */
export function useTema(tema: Tema | undefined): void {
  const attuale = useRef<Tema>(tema ?? temaSalvato());

  useEffect(() => {
    if (!tema) return;
    attuale.current = tema;
    applicaTema(tema);
    if (tema !== 'sistema') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const cambia = () => applicaTema('sistema');
    mq.addEventListener('change', cambia);
    return () => mq.removeEventListener('change', cambia);
  }, [tema]);

  useEffect(() => {
    const prima = () => document.documentElement.classList.remove('dark');
    const dopo = () => applicaTema(attuale.current);
    window.addEventListener('beforeprint', prima);
    window.addEventListener('afterprint', dopo);
    return () => {
      window.removeEventListener('beforeprint', prima);
      window.removeEventListener('afterprint', dopo);
    };
  }, []);
}
