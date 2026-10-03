import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Regola del progetto: nessuna chiamata di rete esterna, nessuna libreria da CDN, nessuna statistica.
 * Questo test legge tutto il codice dell'app e fallisce se trova qualcosa che si collega a internet.
 */

const RADICE = join(__dirname, '..', '..');

function fileDi(cartella: string): string[] {
  return readdirSync(cartella).flatMap((nome: string) => {
    const p = join(cartella, nome);
    return statSync(p).isDirectory() ? fileDi(p) : [p];
  });
}

const codice = fileDi(join(RADICE, 'src'))
  .filter((f) => /\.(ts|tsx|css)$/.test(f) && !/\.test\.tsx?$/.test(f))
  .map((f) => ({ f, testo: readFileSync(f, 'utf8') }));
const html = readFileSync(join(RADICE, 'index.html'), 'utf8');

/** Unici indirizzi esterni ammessi: link che l'utente tocca per aprire WhatsApp (nessuna richiesta automatica). */
const INDIRIZZI_AMMESSI = ['https://wa.me/'];

describe('nessuna connessione esterna', () => {
  it('il codice non usa funzioni di rete', () => {
    const vietati = [/\bfetch\s*\(/, /XMLHttpRequest/, /new\s+WebSocket/, /sendBeacon/, /EventSource/, /importScripts/];
    const trovati = codice.flatMap(({ f, testo }) => vietati.filter((r) => r.test(testo)).map((r) => `${f}: ${r}`));
    expect(trovati).toEqual([]);
  });

  it('nessun indirizzo esterno, a parte i link WhatsApp', () => {
    const trovati = [...codice, { f: 'index.html', testo: html }].flatMap(({ f, testo }) =>
      [...testo.matchAll(/(https?:)?\/\/[a-z0-9.-]+\.[a-z]{2,}[^\s'"`)]*/gi)]
        .map((m) => m[0])
        .filter((u) => !INDIRIZZI_AMMESSI.some((a) => u.startsWith(a)))
        .map((u) => `${f}: ${u}`),
    );
    expect(trovati).toEqual([]);
  });

  it('index.html non carica script o fogli di stile da altri siti', () => {
    expect(html).not.toMatch(/<script[^>]+src=["']https?:/i);
    expect(html).not.toMatch(/<link[^>]+href=["']https?:/i);
  });
});
