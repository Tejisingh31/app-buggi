/** Link per chiamare: "333 123 4567" → "tel:3331234567". */
export function linkChiamata(telefono: string): string {
  return 'tel:' + telefono.replace(/[^\d+]/g, '');
}

/**
 * Link per aprire una chat WhatsApp. Se manca il prefisso internazionale
 * e sembra un numero italiano (10 cifre), aggiunge il 39.
 */
export function linkWhatsApp(telefono: string): string {
  let n = telefono.trim();
  const internazionale = n.startsWith('+') || n.startsWith('00');
  n = n.replace(/\D/g, '');
  if (n.startsWith('00')) n = n.slice(2);
  else if (!internazionale && n.length <= 10) n = '39' + n;
  return `https://wa.me/${n}`;
}
