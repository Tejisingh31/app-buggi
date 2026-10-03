/** Formatta un importo in centesimi come "1.234,50 €". */
export function formattaEuro(centesimi: number, simbolo = '€'): string {
  const negativo = centesimi < 0;
  const assoluto = Math.abs(Math.round(centesimi));
  const interi = Math.floor(assoluto / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const decimali = (assoluto % 100).toString().padStart(2, '0');
  return `${negativo ? '-' : ''}${interi},${decimali} ${simbolo}`;
}

/** Formatta una data come "20/11/2026". */
export function formattaData(data: Date): string {
  const gg = String(data.getDate()).padStart(2, '0');
  const mm = String(data.getMonth() + 1).padStart(2, '0');
  return `${gg}/${mm}/${data.getFullYear()}`;
}
