#!/usr/bin/env python3
"""Mette le traduzioni di lingua/inglese.txt dentro sorgente-BothWise.html (tra i segnaposto EN-INIZIO e EN-FINE).
Uso (dalla cartella BothWise):  python3 lingua/applica.py   poi   python3 costruisci.py
Formato di inglese.txt: una riga per frase, «italiano => english». Nei testi i numeri si scrivono # e i nomi tra «» si scrivono «@»
(si rimettono al loro posto nell'ordine). Una frase che finisce con * vale per tutto ciò che comincia così (il resto si traduce da solo).
Una riga «@ nome => name» traduce il nome di un tasto citato tra «» dentro una frase. Nelle frasi § = data/ora («oggi alle 10:15») e ¤ = elenco di giorni («lun–ven»).
Le righe senza « => » (e quelle vuote) sono commenti; \\n dentro una riga = a capo."""
import json, re, pathlib, sys
radice = pathlib.Path(__file__).resolve().parent.parent
voci = {}; ui = {}
for n, riga in enumerate((radice / 'lingua' / 'inglese.txt').read_text(encoding='utf-8').splitlines(), 1):
    if not riga.strip() or ' => ' not in riga: continue   # le righe senza « => » sono commenti
    it, en = riga.split(' => ', 1)
    it, en = it.strip().replace('\\n', '\n'), en.strip().replace('\\n', '\n')
    if it.startswith('@ '): ui[it[2:].strip()] = en
    else: voci[it] = en
js = '{\n' + ',\n'.join(f'  {json.dumps(k, ensure_ascii=False)}: {json.dumps(v, ensure_ascii=False)}' for k, v in sorted(voci.items())) + '\n}'
p = radice / 'sorgente-BothWise.html'
s = p.read_text(encoding='utf-8')
js_ui = '{\n' + ',\n'.join(f'  {json.dumps(k, ensure_ascii=False)}: {json.dumps(v, ensure_ascii=False)}' for k, v in sorted(ui.items())) + '\n}'
nuovo, n = re.subn(r'/\*EN-INIZIO\*/.*?/\*EN-FINE\*/', lambda m: '/*EN-INIZIO*/' + js + '/*EN-FINE*/', s, flags=re.S)
if n != 1: sys.exit('segnaposto EN-INIZIO/EN-FINE non trovati')
nuovo, n = re.subn(r'/\*EN-UI-INIZIO\*/.*?/\*EN-UI-FINE\*/', lambda m: '/*EN-UI-INIZIO*/' + js_ui + '/*EN-UI-FINE*/', nuovo, flags=re.S)
if n != 1: sys.exit('segnaposto EN-UI-INIZIO/EN-UI-FINE non trovati')
p.write_text(nuovo, encoding='utf-8')
print(f'{len(voci)} frasi e {len(ui)} nomi di tasti inseriti')
