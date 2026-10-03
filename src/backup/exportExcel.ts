import type { WorkSheet } from 'xlsx';
import type { DatiBackup } from './formato';
import { statiPersone, riepilogoGenerale } from '../logic/statistiche';
import type { StatoScadenza } from '../logic/stato';
import { daIso } from '../utils/date';
import { descriviRegola } from '../utils/descrizioni';

const STATO_SCADENZA: Record<StatoScadenza, string> = {
  pagata: 'Pagata',
  inRitardo: 'In ritardo',
  parziale: 'Parziale',
  inAttesa: 'In attesa',
};
const COLORE = { verde: 'In regola', giallo: 'Da pagare', rosso: 'In ritardo' };
const METODO = { contanti: 'Contanti', bonifico: 'Bonifico', carta: 'Carta', altro: 'Altro' };

/** "pagamenti-2026-10-03.xlsx" */
export const nomeFileExcel = (oggi: string) => `pagamenti-${oggi}.xlsx`;

/**
 * Crea il file Excel con i fogli Persone, Quote, Scadenze, Pagamenti, Riepilogo.
 * La libreria SheetJS si carica solo quando serve.
 */
export async function creaExcel(dati: DatiBackup, oggi: string, giorniTolleranza: number, valuta = '€'): Promise<Uint8Array> {
  const XLSX = await import('xlsx');
  const euro = (c: number) => c / 100;
  const formatoEuro = `#,##0.00 "${valuta.replace(/"/g, '')}"`;
  const nome = new Map(dati.persone.map((p) => [p.id, p.nome]));
  const quota = new Map(dati.piani.map((p) => [p.id, p.descrizione]));
  const stati = statiPersone(dati, oggi, giorniTolleranza);

  /** Foglio da righe; le colonne indicate diventano importi o date. */
  function foglio(intestazione: string[], righe: unknown[][], colonneEuro: number[], colonneData: number[]): WorkSheet {
    const ws = XLSX.utils.aoa_to_sheet([intestazione, ...righe], { cellDates: true });
    for (let r = 1; r <= righe.length; r++) {
      for (const c of colonneEuro) {
        const cella = ws[XLSX.utils.encode_cell({ r, c })];
        if (cella && cella.t === 'n') cella.z = formatoEuro;
      }
      for (const c of colonneData) {
        const cella = ws[XLSX.utils.encode_cell({ r, c })];
        if (cella && cella.t === 'd') cella.z = 'dd/mm/yyyy';
      }
    }
    ws['!cols'] = intestazione.map((h) => ({ wch: Math.max(12, h.length + 2) }));
    return ws;
  }
  const data = (iso?: string) => (iso ? daIso(iso) : '');

  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    wb,
    foglio(
      ['Nome', 'Telefono', 'Email', 'Categoria', 'Note', 'Stato', 'Pagato totale', 'Da pagare ora', 'In ritardo'],
      dati.persone.map((p) => {
        const s = stati.get(p.id)!;
        return [
          p.nome,
          p.telefono ?? '',
          p.email ?? '',
          p.categoria ?? '',
          p.note ?? '',
          p.attivo ? COLORE[s.colore] : 'Archiviata',
          euro(s.totalePagato),
          euro(s.daPagareOra),
          euro(s.importoInRitardo),
        ];
      }),
      [6, 7, 8],
      [],
    ),
    'Persone',
  );

  XLSX.utils.book_append_sheet(
    wb,
    foglio(
      ['Persona', 'Descrizione', 'Importo', 'Quando', 'Inizio', 'Fine'],
      dati.piani.map((p) => [nome.get(p.personaId) ?? '', p.descrizione, euro(p.importo), descriviRegola(p), data(p.dataInizio), data(p.dataFine)]),
      [2],
      [4, 5],
    ),
    'Quote',
  );

  const righeScadenze = [...stati.entries()].flatMap(([personaId, s]) =>
    s.scadenze.map((c) => [
      nome.get(personaId) ?? '',
      quota.get(c.scadenza.pianoId) ?? '',
      data(c.scadenza.dataScadenza),
      euro(c.scadenza.importoDovuto),
      euro(c.pagato),
      euro(c.residuo),
      STATO_SCADENZA[c.stato],
      c.giorniRitardo || '',
    ]),
  );
  righeScadenze.sort((a, b) => (a[2] as Date).getTime() - (b[2] as Date).getTime());
  XLSX.utils.book_append_sheet(
    wb,
    foglio(['Persona', 'Quota', 'Scadenza', 'Dovuto', 'Pagato', 'Da pagare', 'Stato', 'Giorni di ritardo'], righeScadenze, [3, 4, 5], [2]),
    'Scadenze',
  );

  const dataScadenza = new Map(dati.scadenze.map((s) => [s.id, s.dataScadenza]));
  XLSX.utils.book_append_sheet(
    wb,
    foglio(
      ['Data', 'Persona', 'Importo', 'Metodo', 'Per la scadenza del', 'Nota'],
      [...dati.pagamenti]
        .sort((a, b) => b.dataPagamento.localeCompare(a.dataPagamento))
        .map((p) => [
          data(p.dataPagamento),
          nome.get(p.personaId) ?? '',
          euro(p.importo),
          METODO[p.metodo] ?? p.metodo,
          p.scadenzaId ? data(dataScadenza.get(p.scadenzaId)) : 'Acconto',
          p.nota ?? '',
        ]),
      [2],
      [0, 4],
    ),
    'Pagamenti',
  );

  const r = riepilogoGenerale(dati, oggi, giorniTolleranza);
  const totale = dati.pagamenti.reduce((t, p) => t + p.importo, 0);
  const wsRiepilogo = foglio(
    ['Voce', 'Valore'],
    [
      ['Data del file', daIso(oggi)],
      ['Persone attive', dati.persone.filter((p) => p.attivo).length],
      ['Persone in ritardo', r.personeInRitardo],
      ['Importo in ritardo', euro(r.importoInRitardo)],
      ['Incassato questo mese', euro(r.incassatoMese)],
      ['Da incassare questo mese', euro(r.daIncassareMese)],
      ['Totale incassato (sempre)', euro(totale)],
      ['Numero pagamenti', dati.pagamenti.length],
    ],
    [],
    [],
  );
  for (const riga of [4, 5, 6, 7]) wsRiepilogo[XLSX.utils.encode_cell({ r: riga, c: 1 })].z = formatoEuro;
  wsRiepilogo[XLSX.utils.encode_cell({ r: 1, c: 1 })].z = 'dd/mm/yyyy';
  wsRiepilogo['!cols'] = [{ wch: 28 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, wsRiepilogo, 'Riepilogo');

  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as Uint8Array;
}
