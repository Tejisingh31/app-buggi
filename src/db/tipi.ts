/**
 * Tipi dei dati salvati sul telefono.
 * - Importi: sempre in centesimi (numeri interi). 12,50 € = 1250.
 * - Date "di calendario" (scadenze, pagamenti): testo "AAAA-MM-GG".
 * - Momenti (creatoIl, modificatoIl): testo ISO completo.
 * Lo stato dei pagamenti NON si salva: si calcola in src/logic/stato.ts.
 */

export type DataIso = string; // "2026-11-20"
export type MomentoIso = string; // "2026-11-20T09:30:00.000Z"

export interface Persona {
  id: string;
  nome: string;
  telefono?: string;
  email?: string;
  categoria?: string;
  note?: string;
  /** false = archiviata (nascosta ma con lo storico intatto) */
  attivo: boolean;
  creatoIl: MomentoIso;
  modificatoIl: MomentoIso;
}

export type Frequenza = 'singola' | 'mensile' | 'ogniNMesi' | 'settimanale' | 'annuale';

export interface Piano {
  id: string;
  personaId: string;
  descrizione: string;
  /** centesimi */
  importo: number;
  frequenza: Frequenza;
  /** Solo per 'ogniNMesi': ogni quanti mesi (es. 3). */
  intervalloMesi?: number;
  dataInizio: DataIso;
  dataFine?: DataIso;
  /**
   * mensile / ogniNMesi / annuale: giorno del mese (1–31; se il mese è più corto vale l'ultimo giorno).
   * settimanale: giorno della settimana (0 = domenica … 6 = sabato).
   * singola: non usato (vale dataInizio).
   */
  giornoScadenza?: number;
  /** Solo per 'annuale': mese (1–12). */
  meseScadenza?: number;
  /**
   * Fino a questa data le scadenze sono già state create (versione 2 del database).
   * Serve a non ricreare scadenze eliminate e a non aggiungere periodi passati quando si modifica il piano.
   */
  generatoFino?: DataIso;
  creatoIl: MomentoIso;
  modificatoIl: MomentoIso;
}

export interface Scadenza {
  id: string;
  pianoId: string;
  personaId: string;
  dataScadenza: DataIso;
  /** centesimi, modificabile per singolo periodo */
  importoDovuto: number;
}

export type MetodoPagamento = 'contanti' | 'bonifico' | 'carta' | 'altro';

export interface Pagamento {
  id: string;
  personaId: string;
  /** facoltativo: senza scadenza è un acconto libero */
  scadenzaId?: string;
  dataPagamento: DataIso;
  /** centesimi, anche parziale */
  importo: number;
  metodo: MetodoPagamento;
  nota?: string;
  creatoIl: MomentoIso;
}

export type Tema = 'sistema' | 'chiaro' | 'scuro';

export interface Impostazioni {
  /** c'è un solo record, con id fisso */
  id: 'principale';
  valuta: string;
  giorniTolleranza: number;
  tema: Tema;
  nomeApp: string;
  categorie: string[];
  ultimoBackup?: MomentoIso;
  promemoriaBackupGiorni: number;
  /** PIN: solo hash PBKDF2 + sale, mai in chiaro (Fase 9) */
  pinHash?: string;
  pinSale?: string;
  /** minuti in background prima del blocco: 1, 5 o 15 */
  bloccoAutomaticoMinuti: number;
  /** PIN: errori consecutivi e attesa in corso (Fase 9) */
  pinErrori?: number;
  pinBloccatoFino?: MomentoIso;
  /** true dopo la schermata di primo avvio ("Inizia da zero" / "Ripristina da backup") */
  benvenutoVisto?: boolean;
  /** true dopo che è stato proposto di impostare il PIN (anche se l'utente ha saltato) */
  pinProposto?: boolean;
  /** iterazioni PBKDF2 usate per l'hash del PIN */
  pinIterazioni?: number;
}

/** Copia di sicurezza automatica salvata nell'app prima di un ripristino (versione 3 del database). */
export interface CopiaSicurezza {
  id: string;
  creatoIl: MomentoIso;
  motivo: string;
  /** il backup completo, come nel file .json */
  contenuto: unknown;
}

export const IMPOSTAZIONI_PREDEFINITE: Impostazioni = {
  id: 'principale',
  valuta: '€',
  giorniTolleranza: 0,
  tema: 'sistema',
  nomeApp: 'Buggi',
  categorie: [],
  promemoriaBackupGiorni: 7,
  bloccoAutomaticoMinuti: 5,
};
