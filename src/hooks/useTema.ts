import { useEffect, useRef } from 'react';
import type { Accento, Tema } from '../db/tipi';

/** Copia di tema e colore nel browser: servono ad applicarli subito all'apertura, prima che il database risponda. */
const CHIAVE = 'buggi.tema';
const CHIAVE_ACCENTO = 'buggi.accento';

/** I colori principali tra cui scegliere (il valore è il colore pieno dei pulsanti). */
export const ACCENTI: { valore: Accento; nome: string; colore: string }[] = [
  { valore: 'verdeAcqua', nome: 'Verde acqua', colore: '#0f766e' },
  { valore: 'blu', nome: 'Blu', colore: '#1d4ed8' },
  { valore: 'indaco', nome: 'Indaco', colore: '#4338ca' },
  { valore: 'viola', nome: 'Viola', colore: '#6d28d9' },
  { valore: 'rosa', nome: 'Rosa', colore: '#be185d' },
  { valore: 'arancione', nome: 'Arancione', colore: '#c2410c' },
  { valore: 'grafite', nome: 'Grafite', colore: '#374151' },
];

/** Colore dell'app se l'utente non ne ha scelto un altro: viola, come il logo. */
export const ACCENTO_PREDEFINITO: Accento = 'viola';

const scuroDiSistema = () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;

function salva(chiave: string, valore: string) {
  try {
    localStorage.setItem(chiave, valore);
  } catch {
    /* memoria del browser non disponibile */
  }
}

/** Mette o toglie il tema scuro e imposta il colore principale. */
export function applicaTema(tema: Tema, accento: Accento = ACCENTO_PREDEFINITO): void {
  const scuro = tema === 'scuro' || (tema === 'sistema' && scuroDiSistema());
  const radice = document.documentElement;
  radice.classList.toggle('dark', scuro);
  if (accento === 'verdeAcqua') delete radice.dataset.accento;
  else radice.dataset.accento = accento;
  const colore = ACCENTI.find((a) => a.valore === accento)?.colore ?? '#6d28d9';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', scuro ? '#0b1120' : colore);
  salva(CHIAVE, tema);
  salva(CHIAVE_ACCENTO, accento);
}

export function temaSalvato(): { tema: Tema; accento: Accento } {
  let tema: Tema = 'sistema';
  let accento: Accento = ACCENTO_PREDEFINITO;
  try {
    const t = localStorage.getItem(CHIAVE);
    if (t === 'chiaro' || t === 'scuro' || t === 'sistema') tema = t;
    const a = localStorage.getItem(CHIAVE_ACCENTO);
    if (ACCENTI.some((x) => x.valore === a)) accento = a as Accento;
  } catch {
    /* niente */
  }
  return { tema, accento };
}

/** Applica tema e colore scelti nelle impostazioni; segue il tema del telefono se "Automatico". In stampa sempre chiaro. */
export function useTema(tema: Tema | undefined, accento: Accento | undefined): void {
  const attuale = useRef(temaSalvato());

  useEffect(() => {
    if (!tema) return;
    const a = accento ?? ACCENTO_PREDEFINITO;
    attuale.current = { tema, accento: a };
    applicaTema(tema, a);
    if (tema !== 'sistema') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const cambia = () => applicaTema('sistema', a);
    mq.addEventListener('change', cambia);
    return () => mq.removeEventListener('change', cambia);
  }, [tema, accento]);

  useEffect(() => {
    const prima = () => document.documentElement.classList.remove('dark');
    const dopo = () => applicaTema(attuale.current.tema, attuale.current.accento);
    window.addEventListener('beforeprint', prima);
    window.addEventListener('afterprint', dopo);
    return () => {
      window.removeEventListener('beforeprint', prima);
      window.removeEventListener('afterprint', dopo);
    };
  }, []);
}
