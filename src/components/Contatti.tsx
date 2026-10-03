import { linkChiamata, linkWhatsApp } from '../utils/telefono';

const stile =
  'flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-xl active:bg-slate-100';

/** Pulsantini rotondi per chiamare o scrivere su WhatsApp. */
export default function Contatti({ telefono, nome }: { telefono?: string; nome: string }) {
  if (!telefono) return null;
  return (
    <>
      <a href={linkChiamata(telefono)} className={stile} aria-label={`Chiama ${nome}`}>
        <span aria-hidden="true">📞</span>
      </a>
      <a href={linkWhatsApp(telefono)} target="_blank" rel="noopener noreferrer" className={stile} aria-label={`WhatsApp a ${nome}`}>
        <span aria-hidden="true">💬</span>
      </a>
    </>
  );
}
