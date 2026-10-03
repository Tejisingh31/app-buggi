/** Byte → testo base64 (a blocchi, per non bloccare con file grandi). */
export function inBase64(byte: Uint8Array): string {
  let s = '';
  for (let i = 0; i < byte.length; i += 0x8000) s += String.fromCharCode(...byte.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Testo base64 → byte. */
export function daBase64(testo: string): Uint8Array<ArrayBuffer> {
  const s = atob(testo);
  const byte = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) byte[i] = s.charCodeAt(i);
  return byte;
}
