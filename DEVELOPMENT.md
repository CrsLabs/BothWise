# BothWise: developer notes

## How it is built
- `sorgente-BothWise.html`: the whole interface (HTML, scripts) in one file; the style is in `stile-doctorwood.css` (the look shared with DoctorWood, copied with `aggiorna-stile.py`) and `stile-bothwise.css`.
- `costruisci.py`: puts the styles in place, recomputes the security rule's hashes (CSP: only scripts with a sha256 hash, no network from the page) and writes `www/index.html` for Capacitor. It also copies `versionName` into the page (`VERSIONE_APP`). **After every change: `python3 costruisci.py`.**
- Button commands go through the `AZ` table (`data-az`, `data-arg`): no code written in the HTML.
- `android/`: Android project (Capacitor 8); native code in `android/app/src/main/java/it/bothwise/app/` (`BothWisePlugin`, `Aggiornamento`, the quick-settings tile). The **PairWood** sync engine (by CrsLabs) is included precompiled in `android/pairwood-sdk`.
- `lingua/inglese.txt`: the English translations (one line per sentence: Italian, arrow, English; `#` number, `«@»` name, `§` date, `¤` days). After every change: `python3 lingua/applica.py` and `python3 costruisci.py`.
- The source code, its comments and the folder names are in Italian (`guida` = guide, `prove` = tests, `lingua` = language, `rilasci` = releases).

## Build
```
npm install
python3 costruisci.py
npx cap sync android
cd android && ./gradlew assembleRelease
```
Minimum **Android 10 (API 29)** (PairWood uses TLS 1.3 only). applicationId **`it.bothwise.app`**: don't change it, or Android treats it as a different app. Sync port: 47812.
For each version change `versionCode` and `versionName` in `android/app/build.gradle`.

**Signing**: the key is not in the repository (`firma/` folder, excluded by `.gitignore`). Updates install only with the same key: whoever keeps it must never lose it. SHA-256 fingerprint of the official certificate: `0fa42252a3f55b29d483efbdef913be1abf4ab121ffaf6fd802f83cc7085197c` (SHA-1 `A8:D8:94:B3:7E:95:11:B5:0B:E4:E0:6C:06:95:B0:7B:4E:0D:50:5C`, the one registered with Google).

**Away from Wi‑Fi**: `GOOGLE_CLIENT_ID` (Google Android OAuth client, `drive.file` scope, scheme `it.bothwise.app:/oauth2redirect`) and `DROPBOX_APP_KEY` (Dropbox «app folder» app, PKCE, redirect `it.bothwise.app:/dropbox-ritorno`) are in `sorgente-BothWise.html`. They are public identifiers, not secrets: access uses PKCE and no client secret. Anyone building their own version must register their own.

## Tests
Playwright with Chromium. Server: `python3 -m http.server 8767 --bind 127.0.0.1 -d www`.
- `node prove/bothwise.js`: two simulated devices, every screen and the main cases.
- `node prove/inglese.js`: the app in English, no Italian words left.
- `node prove/aggiornamenti.js`: updates from GitHub and screen smoothness (simulated app).
The native parts (network, folders, Drive and Dropbox, fingerprint) are tested on devices.

## Publishing a version
1. Build and sign the APK (signing happens outside GitHub: keys never go into the repository).
2. Update `rilasci/aggiornamento.json` (`versionCode`, `versione`, `apk`, the APK's `sha256`, `novita` = what's new, shown in the app).
   Also add the English release notes of the new version to `rilasci/release-notes.json` on the `rilasci` branch: GitHub Releases are published in English only.
3. On the **`rilasci`** branch (it only holds the automation, the APK and `aggiornamento.json`) remove the old APK, add the new one and the new `aggiornamento.json`, and push.
4. The `.github/workflows/rilascio.yml` automation on that branch checks the APK fingerprint and creates the `vX.Y.Z` Release with both files by itself.
Installed apps find it by themselves within a week (`Aggiornamento.java`: https from GitHub only, SHA-256 fingerprint, same package, newer version, same signature).

## User guide and tutorials
Four PDFs: guide and tutorials in Italian and English (`guida/guida.html`, `guida/tutorial.html`, `guida/guide-en.html`, `guida/tutorial-en.html`, shared style in `guida/stile-guida.css`), all in the same six parts.
1. Screenshots: `node guida/schermate.js` (Italian, into `guida/img`) and `node guida/schermate.js en` (English, into `guida/img-en`), server 8767.
2. PDFs: `node guida/genera-guida.js` (all four; or `guida it`, `tutorial en`…). The contents page gets the page numbers by itself: each chapter has an invisible `§§id§§` marker that a first PDF uses to find where it falls (needs `pdftotext`).
