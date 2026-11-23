#!/usr/bin/env python3
"""Costruisce www/index.html (la pagina dell'app) da sorgente-BothWise.html.

- mette al loro posto lo stile di DoctorWood (stile-doctorwood.css) e le aggiunte di BothWise (stile-bothwise.css)
- calcola le impronte sha256 di tutti gli script e le scrive nella regola di sicurezza (CSP): il telefono esegue
  solo questi script, nessun altro
Uso: python3 costruisci.py   (poi: npx cap sync android)
"""
import base64
import hashlib
import pathlib
import re
import sys

QUI = pathlib.Path(__file__).resolve().parent
html = (QUI / 'sorgente-BothWise.html').read_text(encoding='utf-8')
# il numero di versione mostrato nell'app è sempre quello dell'APK (versionName in android/app/build.gradle)
_vn = re.search(r'versionName "([^"]+)"', (QUI / 'android' / 'app' / 'build.gradle').read_text(encoding='utf-8'))
if _vn:
    _nuovo = re.sub(r"const VERSIONE_APP = '[^']*';", f"const VERSIONE_APP = '{_vn.group(1)}';", html, count=1)
    if _nuovo != html:
        (QUI / 'sorgente-BothWise.html').write_text(_nuovo, encoding='utf-8'); html = _nuovo
        print(f'sorgente-BothWise.html: versione {_vn.group(1)}')
for segnaposto, file in (('/*STILE-DOCTORWOOD*/', 'stile-doctorwood.css'), ('/*STILE-BOTHWISE*/', 'stile-bothwise.css')):
    if html.count(segnaposto) != 1:
        sys.exit(f'segnaposto {segnaposto} mancante')
    css = (QUI / file).read_text(encoding='utf-8')
    if '</style' in css.lower():
        sys.exit(f'{file} non può contenere </style>')
    html = html.replace(segnaposto, css)
if re.search(r'<script\s+[^>]*>', html):
    sys.exit('Trovato uno <script> con attributi: non previsto')
if re.search(r'\son[a-z]+\s*=', re.sub(r'<script>.*?</script>', '', html, flags=re.S)):
    sys.exit('Gestore di evento nell\'HTML (onclick=…): vietato, usa data-az')
impronte = ["'sha256-" + base64.b64encode(hashlib.sha256(m.group(1).encode('utf-8')).digest()).decode() + "'"
            for m in re.finditer(r'<script>(.*?)</script>', html, re.S)]
html, n = re.subn(r"script-src [^;]*;", 'script-src ' + ' '.join(impronte) + ';', html, count=1)
if n != 1:
    sys.exit('Regola di sicurezza (CSP) non trovata')
(QUI / 'www').mkdir(exist_ok=True)
(QUI / 'www' / 'index.html').write_text(html, encoding='utf-8')
print(f'www/index.html: {len(impronte)} script, {len(html) // 1024} KB')
