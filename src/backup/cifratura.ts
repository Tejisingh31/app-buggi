import { daBase64, inBase64 } from '../utils/base64';

/**
 * Cifratura del backup con password (facoltativa).
 * AES-GCM a 256 bit; la chiave si ricava dalla password con PBKDF2-SHA256.
 * Tutto con Web Crypto del browser: nessuna libreria esterna.
 */

export const ITERAZIONI_BACKUP = 310_000;

export interface DatiCifrati {
  algoritmo: 'AES-GCM';
  kdf: 'PBKDF2-SHA256';
  iterazioni: number;
  /** base64 */
  sale: string;
  /** base64 */
  iv: string;
  /** base64 */
  dati: string;
}

export class PasswordSbagliata extends Error {
  constructor() {
    super('Password sbagliata, oppure il file è danneggiato');
    this.name = 'PasswordSbagliata';
  }
}

async function derivaChiave(password: string, sale: Uint8Array<ArrayBuffer>, iterazioni: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: sale, iterations: iterazioni },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function cifra(testo: string, password: string, iterazioni = ITERAZIONI_BACKUP): Promise<DatiCifrati> {
  const sale = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const chiave = await derivaChiave(password, sale, iterazioni);
  const dati = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, chiave, new TextEncoder().encode(testo));
  return {
    algoritmo: 'AES-GCM',
    kdf: 'PBKDF2-SHA256',
    iterazioni,
    sale: inBase64(sale),
    iv: inBase64(iv),
    dati: inBase64(new Uint8Array(dati)),
  };
}

export async function decifra(c: DatiCifrati, password: string): Promise<string> {
  if (c.algoritmo !== 'AES-GCM' || c.kdf !== 'PBKDF2-SHA256') throw new Error('Tipo di cifratura non riconosciuto');
  try {
    const chiave = await derivaChiave(password, daBase64(c.sale), c.iterazioni);
    const chiaro = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: daBase64(c.iv) }, chiave, daBase64(c.dati));
    return new TextDecoder().decode(chiaro);
  } catch {
    throw new PasswordSbagliata();
  }
}
