# BothWise: istruzioni per chi sviluppa

## Come è fatta
- `sorgente-BothWise.html`: tutta l'interfaccia (HTML, script) in un file; lo stile è in `stile-doctorwood.css` (la grafica comune con DoctorWood, copiata con `aggiorna-stile.py`) e `stile-bothwise.css`.
- `costruisci.py`: mette gli stili al loro posto, ricalcola le impronte della regola di sicurezza (CSP: solo script con impronta sha256, nessuna rete dalla pagina) e scrive `www/index.html` per Capacitor. Copia anche `versionName` nella pagina (`VERSIONE_APP`). **Dopo ogni modifica: `python3 costruisci.py`.**
- I comandi dei tasti passano dalla tabella `AZ` (`data-az`, `data-arg`): niente codice scritto nell'HTML.
- `android/`: progetto Android (Capacitor 8); codice nativo in `android/app/src/main/java/it/bothwise/app/` (`BothWisePlugin`, `Aggiornamento`, il tasto della barra rapida). Il motore di sincronizzazione **PairWood** (di CrsLabs) è incluso già compilato in `android/pairwood-sdk`.
- `lingua/inglese.txt`: le traduzioni inglesi (una riga per frase: italiano, freccia, inglese; `#` numero, `«@»` nome, `§` data, `¤` giorni). Dopo ogni modifica: `python3 lingua/applica.py` e `python3 costruisci.py`.

## Compilare
```
npm install
python3 costruisci.py
npx cap sync android
cd android && ./gradlew assembleRelease
```
Minimo **Android 10 (API 29)** (PairWood usa solo TLS 1.3). applicationId **`it.bothwise.app`**: non cambiarlo, o per Android è un'altra app. Porta della sincronizzazione: 47812.
A ogni versione si cambiano `versionCode` e `versionName` in `android/app/build.gradle`.

**Firma**: la chiave non è nel repository (cartella `firma/`, esclusa da `.gitignore`). Gli aggiornamenti si installano solo con la stessa chiave: chi la custodisce non deve perderla mai. Impronta SHA-256 del certificato ufficiale: `0fa42252a3f55b29d483efbdef913be1abf4ab121ffaf6fd802f83cc7085197c` (SHA-1 `A8:D8:94:B3:7E:95:11:B5:0B:E4:E0:6C:06:95:B0:7B:4E:0D:50:5C`, quello registrato presso Google).

**Fuori dalla Wi‑Fi**: `GOOGLE_CLIENT_ID` (client OAuth Android di Google, permesso `drive.file`, schema `it.bothwise.app:/oauth2redirect`) e `DROPBOX_APP_KEY` (app Dropbox «cartella dell'app», PKCE, ritorno `it.bothwise.app:/dropbox-ritorno`) sono in `sorgente-BothWise.html`. Sono identificativi pubblici, non segreti: l'accesso usa PKCE e nessun «client secret». Chi compila una versione propria deve registrare i propri.

## Prove
Playwright con Chromium. Server: `python3 -m http.server 8767 --bind 127.0.0.1 -d www`.
- `node prove/bothwise.js`: due dispositivi simulati, tutte le schermate e i casi principali.
- `node prove/inglese.js`: l'app in inglese, nessuna parola italiana rimasta.
- `node prove/aggiornamenti.js`: aggiornamenti da GitHub (app simulata).
Le parti native (rete, cartelle, Drive e Dropbox, impronta) si provano sui dispositivi.

## Pubblicare una versione
1. Compila e firma l'APK (la firma si fa fuori da GitHub: le chiavi non vanno mai nel repository).
2. Aggiorna `rilasci/aggiornamento.json` (`versionCode`, `versione`, `apk`, `sha256` dell'APK, `novita`).
3. Sul ramo **`rilasci`** (contiene solo l'automazione, l'APK e `aggiornamento.json`) togli l'APK vecchio, metti quello nuovo e il nuovo `aggiornamento.json`, e carica.
4. L'automazione `.github/workflows/rilascio.yml` di quel ramo controlla l'impronta dell'APK e crea da sola la Release `vX.Y.Z` con i due file.
Le app installate la trovano da sole entro una settimana (`Aggiornamento.java`: solo https da GitHub, impronta SHA-256, stesso pacchetto, versione più nuova, stessa firma).

## Guida e tutorial
`guida/BothWise-Guida.pdf` e `guida/BothWise-Tutorial.pdf` (`guida/guida.html`, `guida/tutorial.html`, stile comune in `guida/stile-guida.css`), divisi nelle stesse sei parti.
1. Schermate: `node guida/schermate.js` (server 8767).
2. PDF: `node guida/genera-guida.js` (oppure `guida` o `tutorial`). L'indice prende da solo i numeri di pagina: ogni capitolo ha un segno invisibile `§§id§§` che un primo PDF usa per sapere dove cade (serve `pdftotext`).
