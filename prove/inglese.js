// BothWise in inglese: si sceglie «English» dalle Impostazioni, si visitano le schermate e si controlla che i testi mostrati siano
// inglesi (nessuna parola italiana rimasta); poi «Italiano» riporta tutto com'era. Uso: node prove/inglese.js  (server su 8767)
const { chromium } = require('playwright');
const URL = process.argv[2] || 'http://localhost:8767/index.html';
const MOCK = `(() => { window.__ascolto = [];
  window.Capacitor = { isNativePlatform: () => true, addListener: (pl, ev, cb) => { if (pl === 'PairWood' && ev === 'evento') __ascolto.push(cb); return Promise.resolve({ remove() {} }); },
    nativePromise: (pl, m, o) => window.__nat(pl, m, o || {}).then(r => r && r.errore ? Promise.reject(new Error(r.errore)) : r.v) };
  window.__evento = e => __ascolto.forEach(f => { try { f(e); } catch (_) {} });
  window.__nonTradotti = new Set();
})();`;
const ora = Date.now();
const cartelle = [{ id: 'foto', uri: 'content://a/Foto', nome: 'Foto cantiere', modo: 'soloInvio' }, { id: 'doc', uri: 'content://a/Doc', nome: 'Documenti ufficio', modo: 'entrambi' }];
async function nat(pl, m, o) {
  if (pl === 'BothWise') return { v: m === 'puoSbloccare' ? { ok: true, impronta: true } : {} };
  const dispositivi = [{ id: 'T1', idLeggibile: 'T1', nome: 'Tablet di bottega', ultimoContatto: ora - 60000, pausaFino: 0 }];
  switch (m) {
    case 'avvia': case 'stato': return { v: { avviato: true, nome: 'Telefono di Marco', id: 'M1', permessoRete: 'ok', ascolto: { attivo: true, descrizione: 'Lun–Ven 08:00–18:00' }, dispositivi } };
    case 'offerte': return { v: { offerte: [{ id: 'x1', nome: 'Preventivi', dispositivo: 'Tablet di bottega' }] } };
    case 'statoCartelle': return { v: { cartelle: [
      { id: 'foto', nome: 'Foto cantiere', dellUtente: true, file: 148, byte: 412e6, conflitti: [], pausaFino: 0 },
      { id: 'doc', nome: 'Documenti ufficio', dellUtente: true, file: 36, byte: 58e6, conflitti: ['a/b.conflitto-T1000000-20261114-101500.pdf'], pausaFino: 0, blocco: { motivo: 'cancellazioni', quanti: 30, totali: 36 } },
    ] } };
    case 'conflitti': return { v: { conflitti: [{ cartella: 'doc', copia: 'a/b.conflitto-T1000000-20261114-101500.pdf', originale: 'a/b.pdf', dimensioneCopia: 232000, modificatoCopia: ora - 1800000, dimensioneOriginale: 210000, modificatoOriginale: ora - 86400000 * 3, dispositivo: 'Tablet di bottega' }] } };
    case 'fileRicevuti': return { v: { file: [{ nome: 'relazione.pdf', dimensione: 1450000, quando: ora - 300000 }] } };
    case 'condizioni': return { v: { inCarica: true, nonMisurata: true, rete: 'Officina', reteFidata: true, spazioLibero: 24e9, rimandate: 2 } };
    case 'ultimeModifiche': return { v: { modifiche: [{ cartella: 'foto', quando: ora - 120000, percorso: 'a/IMG_1.jpg', tipo: 'arrivato', dispositivo: 'Tablet di bottega' }, { cartella: 'doc', quando: ora - 86400000 * 4, percorso: 'v/b.docx', tipo: 'tolto', dispositivo: 'Tablet di bottega' }] } };
    case 'cestino': return { v: { file: [{ cartella: 'doc', posizione: 'x/b.docx', percorso: 'vecchi/b.docx', dimensione: 48000, tolto: ora - 3600000 }] } };
    case 'versioni': return { v: { file: [{ cartella: 'doc', posizione: 'y/p.pdf', percorso: 'p.pdf', dimensione: 210000, tolto: ora - 7200000 }] } };
    case 'cancellazioniInAttesa': return { v: { cancellazioni: [{ cartella: 'doc', percorso: 'vecchi/b.docx' }] } };
    case 'qr': return { v: { righe: Array.from({ length: 21 }, (_, y) => Array.from({ length: 21 }, (_, x) => ((x + y) % 3 ? '1' : '0')).join('')) } };
    case 'nuovoCodice': return { v: { codice: 'K7QM2XWD9HTRA4NPE5VB' } };
    case 'statoCasella': return { v: { disponibile: false, collegato: false, chiave: false, ultimoGiro: 0, errore: null, servizi: [], servizio: null } };
    case 'statoBatteria': return { v: { risparmioAttivo: false } };
    case 'diagnosi': return { v: { testo: 'Giro 10:00: raggiunti 1 di 1' } };
    case 'scegliCartellaUtente': return { v: { annullato: true } };
    default: return { v: {} };
  }
}
// parole italiane che in un testo inglese non devono comparire
const ITALIANO = /[àèéìòù]|\b(il|lo|gli|di|del|della|delle|dei|degli|che|non|più|sono|nel|nella|anche|come|quando|solo|tutti|tutte|senza|dal|dalla|alla|uno|una|cartella|cartelle|dispositivo|dispositivi|file tolti|aperta|apri|scegli|abbina|impostazioni|sincronizza)\b/i;
(async () => {
  const b = await chromium.launch();
  let ok = 0, ko = 0; const esito = (n, c, info = '') => { if (c) ok++; else ko++; console.log((c ? '  ✓ ' : '  ✗ ') + n + (info ? ' — ' + info : '')); };
  const ctx = await b.newContext({ viewport: { width: 412, height: 860 }, locale: 'it-IT' });
  await ctx.addInitScript(MOCK);
  await ctx.addInitScript(() => { try { localStorage.setItem('bothwise_animazioni', 'no'); localStorage.setItem('bothwise_blocco', 'no'); localStorage.setItem('bothwise_conf', JSON.stringify({ nome: 'Telefono di Marco', cartelle: [{ id: 'foto', uri: 'content://a/Foto', nome: 'Foto cantiere', modo: 'soloInvio' }, { id: 'doc', uri: 'content://a/Doc', nome: 'Documenti ufficio', modo: 'entrambi' }], confermaCancellazioni: true, versioni: true, esclusioniDiSerie: true, esclusioni: ['*.tmp'], casellaDatiMobili: true, notifiche: true, grandiMB: 50, retiFidate: ['Officina'], limiteKBs: 2048, quando: 'fasce', fasce: '1,2,3,4,5;1080;1380' })); } catch (_) {} });
  await ctx.exposeFunction('__nat', nat);
  const p = await ctx.newPage(); const errori = []; p.on('pageerror', e => errori.push(e.message));
  await p.goto(URL); await p.waitForTimeout(1200);
  const tocca = async (sel, t = 350) => { await p.locator(sel).filter({ visible: true }).first().click(); await p.waitForTimeout(t); };
  const passo = async (n, f) => { console.log('▶ ' + n); try { await f(); } catch (e) { ko++; console.log('  ✗ ERRORE: ' + e.message.split('\n')[0].slice(0, 200)); } };
  // tutto il testo che si vede adesso (finestre aperte comprese), senza i nomi propri dei dati d'esempio
  const visibili = () => p.evaluate(() => {
    const out = new Set(), w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const el = n.parentElement; if (!el || ['SCRIPT', 'STYLE'].includes(el.tagName)) continue;
      const r = el.getBoundingClientRect(), st = getComputedStyle(el);
      if (st.display === 'none' || st.visibility === 'hidden' || (!r.width && !r.height)) continue;
      const t = n.data.trim(); if (t) out.add(t);
    }
    document.querySelectorAll('[aria-label],[title],[placeholder]').forEach(e => { const r = e.getBoundingClientRect(); if (r.width || r.height) ['aria-label', 'title', 'placeholder'].forEach(a => e.getAttribute(a) && out.add(e.getAttribute(a))); });
    return [...out];
  });
  const controlla = async nome => {
    const resti = (await visibili()).filter(t => ITALIANO.test(t.replace(/«[^»]*»/g, '').replace(/Foto cantiere|Documenti ufficio|Tablet di bottega|Telefono di Marco|Officina|Preventivi/g, '')));
    esito(nome + ': nessuna parola italiana', resti.length === 0, resti.slice(0, 4).map(x => x.slice(0, 160)).join(' | '));
  };

  await passo('Scelta della lingua', async () => {
    await tocca('#impBtn', 600); await tocca('[data-arg="aspetto"]', 500);
    esito('«Automatica», «Italiano» e «English»', await p.locator('#sceltaLingua [data-az="scegliLingua"]').count() === 3 && (await p.locator('[data-lingua="auto"]').getAttribute('aria-checked')) === 'true');
    esito('il telefono è in italiano: l\'app è in italiano', /Impostazioni/.test(await p.locator('#impTitolo').textContent()));
    await tocca('[data-lingua="en"]', 600);
    esito('«English»: segnato e salvato', (await p.locator('[data-lingua="en"]').getAttribute('aria-checked')) === 'true' && await p.evaluate(() => localStorage.getItem('bothwise_lingua')) === '"en"');
    esito('Impostazioni diventa Settings', /Settings/.test(await p.locator('#impTitolo').textContent()) && (await p.title()) === 'BothWise - Your folders, the same everywhere' && await p.evaluate(() => document.documentElement.lang) === 'en');
    await controlla('Impostazioni · Aspetto');
    for (const k of ['dispositivo', 'condizioni', 'sinc', 'cloud', 'dati']) { await p.evaluate(k => { const e = document.querySelector(`[data-arg="${k}"]`); if (e && e.getAttribute('aria-expanded') !== 'true') e.click(); }, k); await p.waitForTimeout(450); }
    await controlla('Impostazioni · tutte le sezioni');
    esito('«Quando sincronizzare» con i giorni in inglese', /Mon–Fri 18:00–23:00/.test(await p.locator('#impFasceSotto').textContent()));
    await tocca('[data-az="chiudiImpostazioni"]', 500);
  });

  await passo('Home e finestre in inglese', async () => {
    await controlla('Home');
    const home = (await visibili()).join(' | ');
    esito('i riquadri sono in inglese', /Paired devices/.test(home) && /Send a file to a device/.test(home) && /1 file received/.test(home) && /Latest changes/.test(home), home.slice(0, 120));
    esito('date e dimensioni all\'inglese («today at», «392.9 MB» col punto)', /today at/.test(home) && /392\.9 MB/.test(home), home.slice(0, 0));
    await tocca('[data-az="apriCartella"][data-arg="doc"]', 600); await controlla('Dettaglio cartella e conflitti');
    esito('«Keep the original» / «Keep the other» / «Keep both»', /Keep the original/.test(await p.locator('#listaCorpo').textContent()) && /Keep both/.test(await p.locator('#listaCorpo').textContent()));
    await tocca('[data-az="apriVersioni"]', 600); await controlla('Versioni precedenti'); await tocca('[data-az="chiudiLista"]', 400);
    await tocca('#cestinoRiga', 600); await controlla('Cestino'); await tocca('[data-az="chiudiLista"]', 400);
    await tocca('[data-az="apriUltime"]', 600); await controlla('Ultime modifiche'); await tocca('[data-az="chiudiLista"]', 400);
    await tocca('[data-az="apriAttesa"]', 600); await controlla('File da confermare'); await tocca('[data-az="chiudiLista"]', 400);
    await tocca('[data-az="apriRicevuti"]', 600); await controlla('File ricevuti'); await tocca('[data-az="chiudiLista"]', 400);
    await tocca('[data-az="apriDispositivo"]', 600); await controlla('Dispositivo'); await tocca('#finNo', 400);
    await tocca('[data-az="aggiungiCartella"]', 600); await controlla('Aggiungi cartella'); await tocca('[data-az="chiudiLista"]', 400);
    await tocca('[data-az="abbina"]', 600); await controlla('Abbina'); await tocca('[data-az="chiudiLista"]', 400);
    await tocca('[data-az="apriRegole"]', 100).catch(() => {});
  });

  await passo('Avvisi e avanzamento', async () => {
    await p.evaluate(() => window.__evento({ tipo: 'avanzamento', dispositivo: 'Tablet di bottega', cartella: 'foto', percorso: 'a/VID.mp4', fileFatti: 2, fileTotali: 5, byteFatti: 90e6, byteTotali: 210e6, secondi: 12, finito: false, invio: false }));
    await p.waitForTimeout(500); await controlla('Avanzamento');
    esito('«is arriving from»', /is arriving from/.test((await visibili()).join(' ')));
    await p.evaluate(() => window.__evento({ tipo: 'fileRicevuto', nome: 'relazione.pdf', dimensione: 1, da: 'Tablet di bottega' })); await p.waitForTimeout(600);
    esito('avviso «received from»', /received from/.test(await p.locator('#avvisoTesto').textContent()));
  });

  await passo('Ritorno all\'italiano', async () => {
    await tocca('#impBtn', 600); await p.evaluate(() => { const e = document.querySelector('[data-arg="aspetto"]'); if (e.getAttribute('aria-expanded') !== 'true') e.click(); }); await p.waitForTimeout(500); await tocca('[data-lingua="it"]', 600);
    esito('di nuovo in italiano', /Impostazioni/.test(await p.locator('#impTitolo').textContent()) && /Dispositivi abbinati|Cestino/.test(await p.locator('body').textContent()));
    esito('nessuna parola inglese di prima: «Settings» sparito', !/Settings/.test(await p.locator('#impTitolo').textContent()));
    await tocca('[data-az="chiudiImpostazioni"]', 400);
    const t = (await visibili()).join(' | ');
    esito('la Home è tutta in italiano', /Dispositivi abbinati/.test(t) && !/Paired devices/.test(t));
  });

  await passo('Lingua automatica del telefono', async () => {
    const c2 = await b.newContext({ viewport: { width: 412, height: 860 }, locale: 'en-US' });
    await c2.addInitScript(MOCK); await c2.exposeFunction('__nat', nat);
    const q = await c2.newPage(); await q.goto(URL); await q.waitForTimeout(1200);
    esito('telefono in inglese + «Automatica» = app in inglese', await q.evaluate(() => document.documentElement.lang) === 'en' && /Paired devices|Pair/.test(await q.locator('body').textContent()));
    await c2.close();
  });

  esito('nessun errore in pagina', errori.length === 0, errori.slice(0, 2).join(' | '));
  await b.close();
  console.log(`\nBothWise in inglese: ${ok} riusciti, ${ko} falliti`);
  process.exit(ko ? 1 : 0);
})();
