# Buggi

App per il telefono che registra **chi deve pagare, quanto e quando**, e chi ha pagato davvero.
Funziona senza internet e **tutti i dati restano sul telefono**: nessun server, nessun account, nessuna statistica.

## Cosa fa

- **Persone** con telefono, categoria e note; ricerca istantanea (ignora maiuscole e accenti); archivio.
- **Quote**: una data precisa oppure ricorrenti (ogni mese il giorno X, ogni settimana, ogni anno, ogni N mesi), con anteprima delle prossime scadenze.
- **Pagamenti in 2 tocchi**: «Pagato» → «Conferma» (importo e data già compilati), anche parziali, con «Annulla» per 5 secondi.
- **Dashboard**: chi non ha pagato e quanto, incassi del mese, grafico degli ultimi 12 mesi.
- **Mancanti**: scadenze da pagare divise in «in ritardo», «questa settimana», «prossime».
- **Solo «In regola» / «In ritardo»** per ogni persona; importi e scadenze future si possono mostrare da Impostazioni → Cosa mostrare.
- **Backup automatico ogni giorno**: copia dentro l'app (ultimi 7 giorni) e, su computer con Chrome/Edge, file nella cartella scelta (es. Documenti → «Buggi backup»).
- **Backup** completo (anche con password), **Excel** e **report stampabile/PDF**.
- Importi mostrati come semplice cifra (1.234,50), senza simbolo; un simbolo si può aggiungere da Impostazioni.
- **PIN** all'apertura, blocco automatico, tema chiaro/scuro e **colore a scelta** (di base viola come il logo; anche verde acqua, blu, indaco, rosa, arancione, grafite).

## Comandi (sul computer)

| Comando | A cosa serve |
| --- | --- |
| `npm install` | Scarica le librerie (solo la prima volta) |
| `npm run dev` | Avvia l'app in prova: apri l'indirizzo che compare (finisce con `/app-buggi/`) |
| `npm test` | Esegue i controlli automatici |
| `npm run build` | Prepara la versione da pubblicare nella cartella `dist` |
| `npm run preview` | Prova la versione pubblicabile (anche offline) |

## Pubblicazione su GitHub Pages

La pubblicazione è automatica: a ogni invio (push) sul ramo `main`, GitHub esegue i test, prepara l'app e la mette online
(file `.github/workflows/pubblica.yml`). Vengono pubblicati **solo i file dell'app, mai dati**.

Prima volta:

1. Su github.com crea un repository **pubblico** chiamato `app-buggi` (vuoto, senza README).
2. Nel terminale, nella cartella del progetto:
   ```
   git remote add origin https://github.com/TUO-UTENTE/app-buggi.git
   git push -u origin main
   ```
3. Su GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. Dopo un paio di minuti l'app è su `https://TUO-UTENTE.github.io/app-buggi/` (Buggi: https://tejisingh31.github.io/app-buggi/).

## Installazione sui telefoni

- **iPhone:** apri il link in **Safari** → Condividi → «Aggiungi alla schermata Home». Usa sempre l'icona sulla Home.
- **Android:** apri il link in **Chrome** → menu ⋮ → «Installa app».
- Prova una volta in **modalità aereo**, poi fai subito il **primo backup**.

## Importante sui dati

- Ogni telefono ha i suoi dati: non c'è sincronizzazione.
- Il backup automatico giornaliero sul telefono resta **dentro l'app**: protegge dagli errori, non dalla cancellazione dell'app.
- Se cancelli l'app dalla Home o i dati del browser, **i dati si perdono**: fai il backup (Impostazioni → Esporta backup) e salvalo su iCloud, Drive o email. L'app te lo ricorda ogni 7 giorni.
- **Cambio telefono:** vecchio telefono → Esporta backup → nuovo telefono: apri l'app → «Ripristina da backup».
- **PIN dimenticato:** non si può recuperare. «PIN dimenticato?» → «Reimposta app» cancella i dati; poi si ripristina l'ultimo backup.
- Non mettere mai file di backup o export nel repository (il file `.gitignore` li esclude).

## Per chi sviluppa

Regole del progetto in `CLAUDE.md`, requisiti e fasi in `PROGETTO.md`.
React + TypeScript + Vite + Tailwind + Dexie (IndexedDB). Importi sempre in centesimi; lo stato dei pagamenti si calcola in
`src/logic/stato.ts` e non si salva mai. Ogni modifica allo schema del database = nuova versione Dexie con migrazione
(`src/db/database.ts`); il backup JSON ha un campo `versione` da mantenere compatibile (`src/backup/formato.ts`).
Logo originale in `design/buggi_logo_bhindi.png`: le icone in `public/icons` si rigenerano con `design/genera-icone.mjs` (serve Chrome e playwright-core). Non mettere file in `dist`: viene ricreata a ogni build.
