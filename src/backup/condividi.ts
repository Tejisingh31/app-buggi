export type EsitoSalvataggio = 'condiviso' | 'scaricato' | 'annullato';

/**
 * Salva un file. Sul telefono apre il menu Condividi del sistema
 * (File/iCloud, Google Drive, email…); altrimenti lo scarica.
 */
export async function salvaFile(contenuto: BlobPart, nome: string, tipo: string): Promise<EsitoSalvataggio> {
  const blob = new Blob([contenuto], { type: tipo });
  const file = new File([blob], nome, { type: tipo });
  const telefono = window.matchMedia?.('(pointer: coarse)').matches;

  if (telefono && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: nome });
      return 'condiviso';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'annullato';
      // altrimenti si prova a scaricarlo
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'scaricato';
}

/** Legge un file scelto dall'utente come testo. */
export const leggiFileTesto = (file: File) => file.text();
