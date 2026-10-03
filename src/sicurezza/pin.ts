import { db } from '../db/database';
import { aggiornaImpostazioni, leggiImpostazioni } from '../db/repository';
import { daBase64, inBase64 } from '../utils/base64';

/**
 * PIN di accesso: si salva SOLO l'hash (PBKDF2-SHA256 con sale casuale), mai il PIN in chiaro.
 * Dopo 5 errori si aspetta 30 secondi, poi il tempo raddoppia a ogni errore.
 */

export const ITERAZIONI_PIN = 210_000;
export const ERRORI_PRIMA_ATTESA = 5;

/** Il PIN deve avere da 4 a 6 cifre. */
export const pinValido = (pin: string) => /^\d{4,6}$/.test(pin);

async function calcolaHash(pin: string, sale: Uint8Array<ArrayBuffer>, iterazioni: number): Promise<string> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bit = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: sale, iterations: iterazioni }, base, 256);
  return inBase64(new Uint8Array(bit));
}

export async function creaHashPin(pin: string, iterazioni = ITERAZIONI_PIN): Promise<{ hash: string; sale: string; iterazioni: number }> {
  if (!pinValido(pin)) throw new Error('Il PIN deve avere da 4 a 6 cifre');
  const sale = crypto.getRandomValues(new Uint8Array(16));
  return { hash: await calcolaHash(pin, sale, iterazioni), sale: inBase64(sale), iterazioni };
}

/** Confronto a tempo costante, per non far capire quante cifre sono giuste. */
function uguali(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function pinCorretto(pin: string, hash: string, sale: string, iterazioni = ITERAZIONI_PIN): Promise<boolean> {
  if (!pinValido(pin)) return false;
  return uguali(await calcolaHash(pin, daBase64(sale), iterazioni), hash);
}

/** Secondi di attesa dopo `errori` tentativi sbagliati consecutivi: 0 fino a 4, poi 30, 60, 120… (massimo 1 ora). */
export function secondiDiAttesa(errori: number): number {
  if (errori < ERRORI_PRIMA_ATTESA) return 0;
  return Math.min(3600, 30 * 2 ** (errori - ERRORI_PRIMA_ATTESA));
}

/* ---------- operazioni sul database ---------- */

export async function impostaPin(pin: string): Promise<void> {
  const { hash, sale, iterazioni } = await creaHashPin(pin);
  await aggiornaImpostazioni({ pinHash: hash, pinSale: sale, pinIterazioni: iterazioni, pinErrori: 0, pinBloccatoFino: undefined, pinProposto: true });
}

export async function rimuoviPin(): Promise<void> {
  await aggiornaImpostazioni({ pinHash: undefined, pinSale: undefined, pinIterazioni: undefined, pinErrori: 0, pinBloccatoFino: undefined });
}

export type EsitoTentativo = { ok: true } | { ok: false; attesaFino?: string; errori: number };

/**
 * Controlla il PIN inserito e registra il tentativo.
 * Se c'è un'attesa in corso il PIN non viene nemmeno controllato.
 */
export async function provaPin(pin: string, adesso = new Date()): Promise<EsitoTentativo> {
  const imp = await leggiImpostazioni();
  if (!imp.pinHash || !imp.pinSale) return { ok: true };
  if (imp.pinBloccatoFino && new Date(imp.pinBloccatoFino) > adesso) {
    return { ok: false, attesaFino: imp.pinBloccatoFino, errori: imp.pinErrori ?? 0 };
  }
  if (await pinCorretto(pin, imp.pinHash, imp.pinSale, imp.pinIterazioni ?? ITERAZIONI_PIN)) {
    await aggiornaImpostazioni({ pinErrori: 0, pinBloccatoFino: undefined });
    return { ok: true };
  }
  const errori = (imp.pinErrori ?? 0) + 1;
  const attesa = secondiDiAttesa(errori);
  const attesaFino = attesa ? new Date(adesso.getTime() + attesa * 1000).toISOString() : undefined;
  await aggiornaImpostazioni({ pinErrori: errori, pinBloccatoFino: attesaFino });
  return { ok: false, attesaFino, errori };
}

/**
 * "Reimposta app": cancella TUTTI i dati di Buggi su questo telefono.
 * Dopo si può ripristinare un backup dalla schermata di benvenuto.
 */
export async function reimpostaApp(): Promise<void> {
  db.close();
  await db.delete();
  try {
    localStorage.clear();
  } catch {
    /* niente */
  }
}
