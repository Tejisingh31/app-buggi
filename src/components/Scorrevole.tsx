import { useRef, useState, type ReactNode, type PointerEvent } from 'react';

const LARGHEZZA_AZIONE = 112;

type Props = {
  /** testo del pulsante che compare scorrendo verso sinistra */
  etichetta: string;
  onAzione: () => void;
  children: ReactNode;
};

/**
 * Riga che si può scorrere verso sinistra col dito per mostrare un pulsante
 * (es. "Pagato"). Lo scorrimento in su/giù della pagina continua a funzionare.
 */
export default function Scorrevole({ etichetta, onAzione, children }: Props) {
  const [spostamento, setSpostamento] = useState(0);
  const [trascina, setTrascina] = useState(false);
  const inizio = useRef<{ x: number; base: number } | null>(null);
  const mosso = useRef(false);

  function giu(e: PointerEvent) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    inizio.current = { x: e.clientX, base: spostamento };
    mosso.current = false;
  }

  function muovi(e: PointerEvent) {
    if (!inizio.current) return;
    const dx = e.clientX - inizio.current.x;
    if (!mosso.current && Math.abs(dx) < 8) return;
    if (!mosso.current) {
      mosso.current = true;
      setTrascina(true);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    setSpostamento(Math.max(-LARGHEZZA_AZIONE - 24, Math.min(0, inizio.current.base + dx)));
  }

  function su() {
    if (!inizio.current) return;
    inizio.current = null;
    setTrascina(false);
    if (mosso.current) setSpostamento((s) => (s < -LARGHEZZA_AZIONE / 2 ? -LARGHEZZA_AZIONE : 0));
  }

  return (
    <div className="relative overflow-hidden rounded-2xl">
      <button
        type="button"
        tabIndex={spostamento === 0 ? -1 : 0}
        aria-hidden={spostamento === 0}
        onClick={() => {
          setSpostamento(0);
          onAzione();
        }}
        className="absolute inset-y-0 right-0 flex items-center justify-center rounded-2xl bg-[#15803d] text-lg font-bold text-[#fff] active:brightness-90"
        style={{ width: LARGHEZZA_AZIONE }}
      >
        ✓ {etichetta}
      </button>
      <div
        className={`relative touch-pan-y ${trascina ? '' : 'transition-transform duration-200'}`}
        style={{ transform: `translateX(${spostamento}px)` }}
        onPointerDown={giu}
        onPointerMove={muovi}
        onPointerUp={su}
        onPointerCancel={su}
        onClickCapture={(e) => {
          // dopo uno scorrimento, o se la riga è aperta, il tocco non apre la scheda
          if (mosso.current || spostamento !== 0) {
            e.stopPropagation();
            e.preventDefault();
            mosso.current = false;
            if (spostamento !== 0) setSpostamento(0);
          }
        }}
      >
        {children}
      </div>
    </div>
  );
}
