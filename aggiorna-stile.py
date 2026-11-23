#!/usr/bin/env python3
"""Copia lo stile di DoctorWood (classi, icone, componenti, tema chiaro) in stile-doctorwood.css.

BothWise usa la stessa grafica di DoctorWood: quando lo stile di DoctorWood cambia, si rilancia questo script.
Uso: python3 aggiorna-stile.py [../doctorwood-android/sorgente-DoctorWood.html]
"""
import pathlib
import re
import sys

QUI = pathlib.Path(__file__).resolve().parent
sorgente = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else QUI.parent / 'doctorwood-android' / 'sorgente-DoctorWood.html'
html = sorgente.read_text(encoding='utf-8')
testa = html[:html.index('</head>')]
blocchi = re.findall(r'<style[^>]*>(.*?)</style>', testa, re.S)
if len(blocchi) < 2:
    sys.exit('Stili di DoctorWood non trovati')
css = '/* Stile di DoctorWood, copiato da aggiorna-stile.py: non modificare qui (le aggiunte di BothWise sono in stile-bothwise.css) */\n'
css += '\n'.join(b.strip() for b in blocchi) + '\n'
(QUI / 'stile-doctorwood.css').write_text(css, encoding='utf-8')
print(f'stile-doctorwood.css: {len(blocchi)} blocchi, {len(css) // 1024} KB')
