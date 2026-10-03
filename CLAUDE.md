# Buggi – regole di progetto

Nome dell'app: **Buggi** (titolo, manifest, icona, schermata PIN). Cartella del progetto: APP_BUGGI.

Leggi sempre PROGETTO.md: contiene requisiti, modello dati, schermate e il piano a fasi.
L'utente non è un programmatore: spiega in italiano semplice cosa hai fatto e come provarlo.

## Regole fisse
- PWA offline: React + TypeScript + Vite + Tailwind + Dexie (IndexedDB).
- Nessun server, nessuna chiamata di rete esterna, nessuna libreria da CDN, nessuna statistica.
- Interfaccia e testi in italiano. Importi in centesimi (interi), mostrati come 1.234,50 €.
- Lo stato dei pagamenti si calcola sempre in src/logic/stato.ts, mai salvato nel database.
- Mobile first: pulsanti min 44px, navigazione a schede in basso.
- Ogni modifica allo schema del database = nuova versione Dexie con migrazione, senza perdere dati.
- Il backup JSON ha un campo "versione": mantenerlo compatibile con i backup vecchi.
- Il PIN si salva solo come hash (PBKDF2, Web Crypto), mai in chiaro.
- Dopo ogni modifica: `npm run build` e `npm test` devono passare.
- Pubblicazione: GitHub Pages via GitHub Actions, base '/app-buggi/'. Mai committare backup o dati reali.
- Lavora una fase alla volta (vedi PROGETTO.md) e alla fine spunta la fase completata.
