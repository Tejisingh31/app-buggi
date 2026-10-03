# Buggi – App gestione pagamenti (PWA)

Documento di progetto. Claude: leggilo prima di ogni fase e seguilo. Le regole fisse sono in CLAUDE.md.

## Obiettivo e requisiti

L'app si chiama **Buggi**. È una PWA (funziona su iPhone e Android dalla schermata Home) che registra quanto deve pagare ogni persona, quando, e quando ha pagato davvero. Tutti i dati restano sul telefono: nessun server, nessun account.

| # | Requisito | Dettaglio |
| --- | --- | --- |
| 1 | Persone | Aggiungi, modifica, archivia; nome, telefono, note |
| 2 | Quote | Per ogni persona: importo e scadenza. Scadenza = una data precisa (es. 20/11/2026) oppure ricorrente (ogni 1° del mese, ogni 15 del mese, ogni lunedì, ogni anno il 10/01, ogni 3 mesi) |
| 3 | Pagamenti | Segna pagato con data effettiva, importo (anche parziale), metodo, nota |
| 4 | Ritardi | In evidenza chi è scaduto e non ha pagato, con giorni di ritardo e importo |
| 5 | Storico | Elenco completo dei pagamenti per persona e generale |
| 6 | Dashboard | Generale, per singola persona, e lista pagamenti mancanti |
| 7 | Ricerca | Barra di ricerca sempre visibile, filtra mentre scrivi |
| 8 | Backup | Backup completo ripristinabile + file leggibile (Excel) e report stampabile |
| 9 | Usabilità | Grande, semplice, max 2 tocchi per segnare un pagamento; funziona offline |
| 10 | Personalizzazione | Valuta, categorie, giorni di tolleranza, tema chiaro/scuro modificabili dall'utente |
| 11 | Sicurezza | PIN all'apertura, backup con password facoltativa |

## Nota: PWA, iPhone e "solo locale"

Una PWA deve essere aperta **una volta** da un indirizzo https per essere aggiunta alla Home; dopo funziona con o senza internet e i dati non lasciano mai il telefono. Aprire un file HTML direttamente dal telefono non basta.

- **Pubblicazione:** solo i file dell'app (nessun dato) su GitHub Pages, gratuito.
- **Dati locali:** salvati nel database del browser del telefono (IndexedDB). Nessuno li vede.
- **Rischio:** se si elimina l'app dalla Home o si cancellano i dati del browser, i dati si perdono. Per questo il backup è centrale, con promemoria automatico.
- **Ogni telefono ha i suoi dati:** nessuna sincronizzazione. Per spostarli: esporta backup e importalo sull'altro telefono.

## Tecnologie

| Componente | Scelta | Perché |
| --- | --- | --- |
| Build | Vite + TypeScript | Avvio rapido, errori trovati subito |
| Interfaccia | React | Diffuso, ben conosciuto |
| Stile | Tailwind CSS | Grafica pulita e responsive |
| PWA | vite-plugin-pwa | Manifest e service worker per l'offline |
| Database locale | Dexie.js (IndexedDB) | Salvataggio affidabile sul telefono |
| Ricerca | Filtro in memoria (o Fuse.js) | Ricerca istantanea, tollera errori di battitura |
| Grafici | Recharts | Grafici dashboard |
| Date | date-fns (locale it) | Calcolo scadenze e ritardi |
| Excel | SheetJS (xlsx) | Export .xlsx apribile ovunque |
| Test | Vitest | Verifica calcoli di scadenze e ritardi |

## Modello dati

Lo stato (pagato, parziale, in ritardo) non si salva: si calcola sempre da scadenze e pagamenti.

**Persona**

| Campo | Tipo | Note |
| --- | --- | --- |
| id | stringa (uuid) | |
| nome | stringa | obbligatorio, usato nella ricerca |
| telefono, email | stringa | facoltativi, tocco per chiamare/WhatsApp |
| categoria | stringa | es. squadra, affitto, corso |
| note | testo | |
| attivo | sì/no | archiviare senza cancellare lo storico |
| creatoIl, modificatoIl | data | |

**Piano (quota assegnata)**

| Campo | Tipo | Note |
| --- | --- | --- |
| id, personaId | stringa | |
| descrizione | stringa | es. "Quota mensile" |
| importo | numero (centesimi) | interi, niente errori di arrotondamento |
| frequenza | data singola / mensile / ogni N mesi / settimanale / annuale | |
| dataInizio, dataFine | data | fine facoltativa |
| giornoScadenza | numero | mensile: giorno del mese (1, 15…; se il mese è più corto si usa l'ultimo giorno); settimanale: giorno della settimana; annuale: giorno e mese; data singola: solo dataInizio |

**Scadenza** (generata dal piano, una per periodo)

| Campo | Tipo | Note |
| --- | --- | --- |
| id, pianoId, personaId | stringa | |
| dataScadenza | data | |
| importoDovuto | numero (centesimi) | modificabile per singolo periodo |

**Pagamento**

| Campo | Tipo | Note |
| --- | --- | --- |
| id, personaId, scadenzaId | stringa | scadenza facoltativa (acconto libero) |
| dataPagamento | data | default oggi, modificabile |
| importo | numero (centesimi) | anche parziale |
| metodo | contanti / bonifico / carta / altro | |
| nota | testo | |

**Regole di stato per ogni scadenza:** pagata se la somma dei pagamenti ≥ dovuto; parziale se > 0; in ritardo se non pagata e oggi > scadenza + giorni di tolleranza; altrimenti in attesa.

**Impostazioni:** valuta (€), giorni di tolleranza (default 0), tema, nome dell'app, data ultimo backup, frequenza promemoria backup, PIN (hash), tempo di blocco automatico.

## Schermate e flusso utente

Navigazione con 4 schede in basso e un pulsante "+" sempre visibile per registrare un pagamento.

| Schermata | Contenuto | Azioni rapide |
| --- | --- | --- |
| **Dashboard** | In cima riquadro rosso "Non hanno pagato: N persone · € X"; poi totale incassato nel mese, da incassare, in ritardo, persone in ritardo; grafico incassi 12 mesi | 1 tocco sul riquadro rosso → elenco di chi deve pagare e quanto, con "Pagato" e chiama/WhatsApp |
| **Persone** | Barra di ricerca fissa; lista con nome, stato colorato (verde/giallo/rosso), importo dovuto; filtri: tutti, in ritardo, in regola, archiviati | Scorri → "Pagato"; tocca → scheda persona |
| **Scheda persona** | Mini-dashboard: totale pagato, dovuto, ritardo; prossima scadenza; piani attivi; storico pagamenti | Segna pagato, aggiungi piano, chiama/WhatsApp, modifica |
| **Mancanti** | Scadenze non pagate raggruppate: in ritardo, questa settimana, prossime; totali per gruppo | Segna pagato, filtra per categoria/mese |
| **Impostazioni** | Backup/ripristino, export Excel/PDF, valuta, tolleranza, categorie, tema, PIN, stato ultimo backup | Esporta ora, importa backup |

**Impostare la scadenza:** due scelte grandi, "Una data" o "Si ripete". Con "Si ripete": *ogni [1] del mese*, *ogni [15] del mese*, *ogni [lunedì]*, *ogni anno il [10/01]*, *ogni [3] mesi*. Sotto, anteprima delle prossime 3 scadenze.

**Segnare un pagamento (max 2 tocchi):** "Pagato" → foglio con importo e data di oggi precompilati (modificabili, con metodo e nota) → "Conferma". Annulla per 5 secondi.

**Usabilità:** pulsanti min 44 px, colori di stato coerenti, conferma prima di eliminare, nessuna schermata vuota senza spiegazione, tutto in italiano, importi 1.234,50 €.

## Backup ed export

| File | Formato | A cosa serve |
| --- | --- | --- |
| `pagamenti-backup-AAAA-MM-GG.json` | JSON con campo versione (cifrato se c'è password) | Ripristino completo nell'app, anche su altro telefono |
| `pagamenti-AAAA-MM-GG.xlsx` | Excel: Persone, Piani, Scadenze, Pagamenti, Riepilogo | Leggere i dati anche senza l'app |
| Report stampabile | Pagina → "Stampa / Salva PDF" | Riepilogo per persona e ritardi |

- **Salvataggio:** "Esporta" apre il menu Condividi del sistema (navigator.share) → File/iCloud, Google Drive, email; altrimenti download.
- **Ripristino:** "Importa backup" → file .json → anteprima (persone, pagamenti) → "Sostituisci tutto" o "Unisci". Prima di sostituire, backup automatico di sicurezza.
- **Promemoria:** banner in Dashboard se l'ultimo backup ha più di 7 giorni.
- **Protezione:** richiesta di spazio persistente con navigator.storage.persist().

**Cambio telefono:** vecchio telefono → Esporta backup → nuovo telefono: installa l'app → al primo avvio "Inizia da zero" o **"Ripristina da backup"** → scegli il file (e la password) → imposta il PIN.

## Sicurezza e PIN

- PIN di 4–6 cifre al primo avvio (saltabile), salvato come hash PBKDF2 (Web Crypto), mai in chiaro.
- Blocco automatico dopo 1, 5 o 15 minuti in background.
- Dopo 5 errori attesa di 30 secondi, poi crescente.
- PIN dimenticato: non recuperabile. "Reimposta app" cancella i dati, poi si ripristina dal backup. Va spiegato all'utente.
- Backup JSON con password facoltativa (AES-GCM).
- Nessuna connessione esterna: niente statistiche, pubblicità o librerie da CDN.

## Struttura cartelle

```
APP_BUGGI/
├─ CLAUDE.md
├─ PROGETTO.md
├─ index.html
├─ vite.config.ts
├─ public/icons/
└─ src/
   ├─ main.tsx
   ├─ App.tsx
   ├─ db/ (database.ts, repository.ts)
   ├─ logic/ (scadenze.ts, stato.ts, statistiche.ts)
   ├─ backup/ (exportJson.ts, importJson.ts, exportExcel.ts, report.ts, cifratura.ts)
   ├─ sicurezza/ (pin.ts, BloccoPin.tsx)
   ├─ pages/ (Dashboard, Persone, SchedaPersona, Mancanti, Impostazioni)
   ├─ components/ (BarraRicerca, CartaPersona, FoglioPagamento, BadgeStato…)
   └─ utils/ (formattazione euro e date)
```

## Piano di sviluppo (una fase per sessione)

Alla fine di ogni fase: `npm run dev`, prova nel browser, poi passa alla successiva.

- [x] **Fase 1 – Base.** Progetto Vite + React + TypeScript con Tailwind e vite-plugin-pwa. Manifest in italiano (nome e short_name "Buggi", display standalone, icone placeholder). Navigazione a 4 schede in basso: Dashboard, Persone, Mancanti, Impostazioni.
- [x] **Fase 2 – Database.** src/db con Dexie: Persona, Piano, Scadenza, Pagamento, Impostazioni. Importi in centesimi. repository.ts con CRUD. navigator.storage.persist() all'avvio.
- [x] **Fase 3 – Logica e test.** logic/scadenze.ts (data singola, giorno X del mese con mesi corti, ogni N mesi, settimanale, annuale; fino a oggi + 3 mesi), logic/stato.ts, logic/statistiche.ts. Test Vitest: parziali, fine mese, anni bisestili.
- [x] **Fase 4 – Persone e ricerca.** Pagina Persone con ricerca fissa (ignora maiuscole e accenti), filtri, badge colorati. Crea/modifica persona e piano (con scelta "Una data"/"Si ripete" e anteprima 3 scadenze). Scheda persona.
- [x] **Fase 5 – Pagamenti.** FoglioPagamento precompilato, conferma con 1 tocco, annulla 5 secondi, swipe "Pagato", pulsante + globale.
- [x] **Fase 6 – Dashboard e Mancanti.** Riquadro rosso "Non hanno pagato" che apre l'elenco con importi; schede numeriche; grafico 12 mesi. Pagina Mancanti raggruppata.
- [x] **Fase 7 – Backup ed export.** JSON con versione, import con anteprima e Sostituisci/Unisci, Excel con SheetJS, report stampabile, navigator.share, promemoria 7 giorni, primo avvio "Inizia da zero / Ripristina da backup".
- [x] **Fase 8 – Rifinitura.** Offline, icone reali, tema scuro, stati vuoti, conferme, accessibilità. Build e test senza errori.
- [x] **Fase 9 – PIN e sicurezza.** Blocco con PIN, hash PBKDF2, blocco automatico, attese dopo errori, "Reimposta app", backup cifrato AES-GCM, verifica nessuna richiesta di rete esterna.
- [ ] **Fase 10 – Pubblicazione.** Repository pubblico app-buggi, base '/app-buggi/', workflow GitHub Actions che pubblica dist su GitHub Pages a ogni push su main, .gitignore per file di backup.

## Installazione sui telefoni (dopo la Fase 10)

- **iPhone:** link in Safari → Condividi → "Aggiungi alla schermata Home". Usare sempre l'icona sulla Home.
- **Android:** link in Chrome → menu ⋮ → "Installa app".
- Prova una volta in modalità aereo, poi primo backup.
