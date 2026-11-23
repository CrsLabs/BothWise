// Scatta le schermate di BothWise per la guida (guida/img/*.png), con dati d'esempio e PairWood simulato.
// Uso (dalla cartella BothWise):
//   python3 costruisci.py ; (python3 -m http.server 8767 --bind 127.0.0.1 -d www &) ; node guida/schermate.js
// Poi: node guida/genera-guida.js   → guida/BothWise-Guida.pdf
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const URL = process.argv[2] || 'http://localhost:8767/index.html';
const OUT = path.join(__dirname, 'img'); fs.mkdirSync(OUT, { recursive: true });

const MOCK = `(() => { window.__ascolto = [];
  window.Capacitor = { isNativePlatform: () => true,
    addListener: (pl, ev, cb) => { if (pl === 'PairWood' && ev === 'evento') __ascolto.push(cb); return Promise.resolve({ remove() {} }); },
    nativePromise: (pl, m, o) => window.__nat(pl, m, o || {}).then(r => r && r.errore ? Promise.reject(new Error(r.errore)) : r.v) };
  window.__evento = e => __ascolto.forEach(f => { try { f(e); } catch (_) {} });
})();`;

const ora = Date.now();
const stato = {
  popolato: true, offerte: [], cestino: [], versioni: [], daDecidere: [], extra: {}, rimandate: 0,
  ultime: [
    { cartella: 'foto', quando: ora - 120000, percorso: 'cantiere-rossi/IMG_2031.jpg', tipo: 'arrivato', dispositivo: 'Tablet di bottega' },
    { cartella: 'doc', quando: ora - 900000, percorso: 'preventivi/Rossi-cucina.pdf', tipo: 'cambiato', dispositivo: 'Tablet di bottega' },
    { cartella: 'doc', quando: ora - 3600000, percorso: 'vecchi/bozza.docx', tipo: 'tolto', dispositivo: 'Tablet di bottega' },
  ],
};
const cartelle = [
  { id: 'foto', uri: 'content://a/Foto', nome: 'Foto cantiere', modo: 'soloInvio' },
  { id: 'doc', uri: 'content://a/Doc', nome: 'Documenti ufficio', modo: 'entrambi' },
];

async function nat(pl, m, o) {
  if (pl === 'BothWise') {
    if (m === 'controllaAggiornamento') return { v: stato.agg ? { installata: 35, nuova: true, versione: '0.9.1', novita: 'Correzioni e piccoli miglioramenti.', dimensione: 9437184 } : { installata: 35, nuova: false } };
    return { v: m === 'puoSbloccare' ? { ok: true, impronta: true } : {} };
  }
  const dispositivi = stato.popolato ? [
    { id: 'T1', idLeggibile: 'T1', nome: 'Tablet di bottega', ultimoContatto: ora - 60000, pausaFino: 0 },
    { id: 'T2', idLeggibile: 'T2', nome: 'Telefono di Anna', ultimoContatto: ora - 5 * 3600000, pausaFino: 0 },
  ] : [];
  switch (m) {
    case 'avvia': case 'stato': return { v: { avviato: true, nome: 'Telefono di Marco', id: 'M1', permessoRete: 'ok', ascolto: { attivo: true, descrizione: 'Lun–Ven 08:00–18:00' }, dispositivi } };
    case 'offerte': return { v: { offerte: stato.offerte } };
    case 'statoCartelle': return { v: { cartelle: stato.popolato ? [
      { id: 'foto', nome: 'Foto cantiere', dellUtente: true, file: 148, byte: 412e6, conflitti: [], pausaFino: 0, ...(stato.extra.foto || {}) },
      { id: 'doc', nome: 'Documenti ufficio', dellUtente: true, file: 36, byte: 58e6, conflitti: [], pausaFino: 0, ...(stato.extra.doc || {}) },
    ] : [] } };
    case 'condizioni': return { v: { inCarica: true, nonMisurata: true, rete: 'Officina', reteFidata: true, spazioLibero: 24e9, rimandate: stato.rimandate } };
    case 'ultimeModifiche': return { v: { modifiche: stato.ultime } };
    case 'cestino': return { v: { file: stato.cestino } };
    case 'versioni': return { v: { file: stato.versioni } };
    case 'cancellazioniInAttesa': return { v: { cancellazioni: stato.daDecidere } };
    case 'sfoglia': { const pre = o.sub ? o.sub + '/' : '';
      const tutti = [{ percorso: 'Sopralluoghi/Rossi-cucina.jpg', dimensione: 3100000, modificato: ora - 3600e3 }, { percorso: 'Sopralluoghi/Rossi-bagno.jpg', dimensione: 2800000, modificato: ora - 7200e3 }, { percorso: 'Preventivi/Rossi-cucina.pdf', dimensione: 232000, modificato: ora - 86400e3 }, { percorso: 'misure-cucina.jpg', dimensione: 1900000, modificato: ora - 1800e3 }, { percorso: 'elenco-materiali.txt', dimensione: 1200, modificato: ora - 5400e3 }];
      const cart = {}, file = [];
      for (const f of tutti) { if (!f.percorso.startsWith(pre)) continue; const r = f.percorso.slice(pre.length), i = r.indexOf('/'); if (i < 0) file.push({ nome: r, percorso: f.percorso, cartella: false, dimensione: f.dimensione, modificato: f.modificato, figli: 0 }); else { const n = r.slice(0, i); cart[n] = cart[n] || { nome: n, percorso: pre + n, cartella: true, dimensione: 0, modificato: 0, figli: 0 }; cart[n].figli++; cart[n].dimensione += f.dimensione; } }
      return { v: { voci: [...Object.values(cart), ...file] } }; }
    case 'statoRicezioneFile': return { v: stato.ricezione ? { attiva: true, fino: Date.now() + 480e3 } : { attiva: false, fino: 0 } };
    case 'conflitti': return { v: { conflitti: stato.conflitti || [] } };
    case 'fileRicevuti': return { v: { file: stato.ricevuti || [] } };
    case 'qr': return { v: { righe: Array.from({ length: 25 }, (_, y) => Array.from({ length: 25 }, (_, x) => ((x * 7 + y * 13 + (x ^ y)) % 3 ? '1' : '0')).join('')) } };
    case 'nuovoCodice': return { v: { codice: 'K7QM2XWD9HTRA4NPE5VB' } };
    case 'statoCasella': return { v: { disponibile: true, collegato: false, chiave: false, ultimoGiro: 0, errore: null, servizi: ['google', 'dropbox'], servizio: null } };
    case 'statoBatteria': return { v: { risparmioAttivo: false } };
    case 'diagnosi': return { v: { testo: 'Giro 10:00: raggiunti 2 di 2' } };
    case 'scegliCartellaUtente': return { v: { annullato: true } };
    default: return { v: {} };
  }
}

(async () => {
  const b = await chromium.launch();
  async function pagina(conCartelle) {
    stato.popolato = conCartelle;
    const ctx = await b.newContext({ viewport: { width: 412, height: 860 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'it-IT' });
    await ctx.addInitScript(MOCK);
    await ctx.addInitScript(c => { try { localStorage.setItem('bothwise_animazioni', 'no'); localStorage.setItem('bothwise_blocco', 'no'); localStorage.setItem('bothwise_aggiornamenti', JSON.stringify({ ultimo: Date.now() })); if (c) localStorage.setItem('bothwise_conf', JSON.stringify(c)); } catch (_) {} },
      conCartelle ? { nome: 'Telefono di Marco', cartelle, confermaCancellazioni: false, versioni: true, esclusioniDiSerie: true, esclusioni: ['*.tmp'], casellaDatiMobili: true, notifiche: true, grandiMB: 50, retiFidate: [] } : null);
    await ctx.exposeFunction('__nat', nat);
    const p = await ctx.newPage(); await p.goto(URL); await p.waitForTimeout(900); return p;
  }
  const foto = async (p, nome, pieno = false) => { await p.waitForTimeout(450); await p.screenshot({ path: path.join(OUT, nome + '.png'), fullPage: pieno }); console.log('  ' + nome); };
  const tocca = async (p, sel, t = 400) => { await p.locator(sel).filter({ visible: true }).first().click(); await p.waitForTimeout(t); };
  const prova = async (nome, fn) => { try { await fn(); } catch (e) { console.log('  ✗ ' + nome + ': ' + e.message.split('\n')[0]); } };

  // ----- primo avvio (nessuna cartella, nessun dispositivo)
  let p = await pagina(false);
  await prova('primo-avvio', async () => { await foto(p, '01-primo-avvio'); });
  await prova('abbina-scelte', async () => { await tocca(p, '[data-az="abbina"]'); await foto(p, '02-abbina-scelte'); await tocca(p, '[data-az="chiudiLista"]'); });
  await prova('codice', async () => { await tocca(p, '#primiPassi [data-az="abbinaMostra"]', 900); await foto(p, '03-mostra-codice'); });
  await p.context().close();

  // ----- uso normale
  p = await pagina(true);
  await prova('home', async () => { await foto(p, '04-home'); await foto(p, '04b-home-intera', true); });
  await prova('avanzamento', async () => {
    await p.evaluate(() => window.__evento({ tipo: 'avanzamento', dispositivo: 'Tablet di bottega', cartella: 'foto', percorso: 'cantiere-rossi/VID_0412.mp4', fileFatti: 2, fileTotali: 5, byteFatti: 90e6, byteTotali: 210e6, secondi: 12, finito: false }));
    await p.waitForTimeout(500); await p.screenshot({ path: path.join(OUT, '05-avanzamento.png'), clip: { x: 0, y: 0, width: 412, height: 330 } });
    await p.evaluate(() => window.__evento({ tipo: 'avanzamento', dispositivo: 'Tablet di bottega', cartella: 'foto', percorso: null, fileFatti: 5, fileTotali: 5, byteFatti: 210e6, byteTotali: 210e6, secondi: 40, finito: true }));
  });
  await prova('cartella', async () => { await tocca(p, '[data-az="apriCartella"][data-arg="foto"]', 600); await foto(p, '06-cartella-dettaglio'); await tocca(p, '[data-az="chiudiLista"]'); });
  await prova('dispositivo', async () => { await tocca(p, '[data-az="apriDispositivo"]', 600); await foto(p, '07-dispositivo'); await tocca(p, '#finNo'); });
  await prova('ultime', async () => { await tocca(p, '[data-az="apriUltime"]', 600); await foto(p, '08-ultime-modifiche'); await tocca(p, '[data-az="chiudiLista"]'); });
  stato.cestino = [
    { cartella: 'doc', posizione: '.sincronia/cestino/a/vecchi/bozza.docx', percorso: 'vecchi/bozza.docx', dimensione: 48000, tolto: ora - 3600000 },
    { cartella: 'foto', posizione: '.sincronia/cestino/b/IMG_1990.jpg', percorso: 'cantiere-verdi/IMG_1990.jpg', dimensione: 3100000, tolto: ora - 2 * 86400000 },
  ];
  stato.versioni = [{ cartella: 'doc', posizione: '.sincronia/versioni/c/Rossi-cucina.pdf', percorso: 'preventivi/Rossi-cucina.pdf', dimensione: 210000, tolto: ora - 7200000 }];
  await prova('cestino', async () => { await tocca(p, '#cestinoRiga', 700); await foto(p, '09-cestino'); await tocca(p, '[data-az="chiudiLista"]'); });
  await prova('versioni', async () => { await tocca(p, '[data-az="apriCartella"][data-arg="doc"]', 600); await tocca(p, '[data-az="apriVersioni"]', 700); await foto(p, '10-versioni'); });
  await p.reload(); await p.waitForTimeout(900);

  // due versioni dello stesso file e file ricevuti da un solo dispositivo
  stato.extra.doc = { conflitti: ['preventivi/Rossi-cucina.conflitto-T1000000-20261114-101500.pdf'] };
  stato.conflitti = [{ cartella: 'doc', copia: 'preventivi/Rossi-cucina.conflitto-T1000000-20261114-101500.pdf', originale: 'preventivi/Rossi-cucina.pdf', dimensioneCopia: 232000, modificatoCopia: ora - 1800000, dimensioneOriginale: 210000, modificatoOriginale: ora - 5400000, dispositivo: 'Tablet di bottega' }];
  stato.ricevuti = [{ nome: 'relazione-cantiere.pdf', dimensione: 1450000, quando: ora - 300000 }, { nome: 'misure-cucina.jpg', dimensione: 2900000, quando: ora - 900000 }];
  await p.reload(); await p.waitForTimeout(900);
  await prova('conflitti', async () => { await tocca(p, '[data-az="apriCartella"][data-arg="doc"]', 700); await foto(p, '18-conflitti'); await tocca(p, '[data-az="chiudiLista"]'); });
  await prova('ricevuti', async () => { await tocca(p, '[data-az="apriRicevuti"]', 700); await foto(p, '19-file-ricevuti'); await tocca(p, '[data-az="chiudiLista"]'); });
  stato.extra = {}; stato.conflitti = []; stato.ricevuti = [];
  await p.reload(); await p.waitForTimeout(900);

  // sfogliare i file della cartella e «Ricevi file»
  await prova('sfoglia', async () => {
    await tocca(p, '[data-az="apriCartella"][data-arg="doc"]', 600); await tocca(p, '[data-az="apriSfoglia"]', 800);
    await tocca(p, '[data-az="sfogliaScegli"][data-arg="2"]', 500); await foto(p, '20-sfoglia'); await tocca(p, '[data-az="chiudiLista"]');
  });
  stato.ricezione = true; await p.reload(); await p.waitForTimeout(900);
  await prova('ricevi', async () => { await p.evaluate(() => document.querySelector('#invioFile').scrollIntoView({ block: 'center' })); await p.waitForTimeout(500); await p.screenshot({ path: path.join(OUT, '21-ricevi-file.png') }); console.log('  21-ricevi-file'); });
  stato.ricezione = false; await p.reload(); await p.waitForTimeout(900);

  // protezioni e conferme
  stato.extra.foto = { blocco: { motivo: 'cancellazioni', quanti: 55, totali: 60 } };
  stato.daDecidere = [{ cartella: 'doc', percorso: 'vecchi/bozza.docx' }, { cartella: 'doc', percorso: 'vecchi/bozza2.docx' }];
  stato.rimandate = 2;
  await prova('avvisi-home', async () => { await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await p.waitForTimeout(900); await foto(p, '11-avvisi-home'); });
  stato.extra = {}; stato.daDecidere = []; stato.rimandate = 0;
  await p.reload(); await p.waitForTimeout(900);

  // impostazioni
  await prova('impostazioni', async () => { await tocca(p, '#impBtn', 700); await foto(p, '12-impostazioni'); });
  for (const [k, nome] of [['aspetto', '13-aspetto'], ['vibrazione', '14-vibrazione'], ['dispositivo', '14b-questo-dispositivo'], ['condizioni', '14c-sincronizzazione'], ['sinc', '15-file-da-non-sincronizzare'], ['cloud', '16-fuori-dalla-wifi'], ['dati', '17-sicurezza-e-dati']]) {
    await prova(nome, async () => {
      if ((await p.locator(`[data-arg="${k}"]`).count()) === 0) return;
      await tocca(p, `[data-arg="${k}"]`, 700);
      await p.evaluate(k => { const e = document.querySelector(`[data-arg="${k}"]`); if (e) e.scrollIntoView({ block: 'start' }); }, k);
      await foto(p, nome); await tocca(p, `[data-arg="${k}"]`, 400);
    });
  }
  // fuori dalla Wi‑Fi: la scelta del servizio
  await prova('scegli-servizio', async () => { await tocca(p, '[data-arg="cloud"]', 600); await tocca(p, '#impDrive', 700); await foto(p, '24-scegli-servizio'); await tocca(p, '#finNo', 500); await tocca(p, '[data-arg="cloud"]', 400); });
  // aggiornamenti e fondo delle Impostazioni
  stato.agg = true;
  await prova('aggiornamenti', async () => {
    await tocca(p, '[data-arg="aggiornamenti"]', 600); await tocca(p, '#aggControlla', 700);
    await p.evaluate(() => document.getElementById('catAggiornamenti').scrollIntoView({ block: 'start' })); await foto(p, '22-aggiornamenti'); await tocca(p, '[data-arg="aggiornamenti"]', 400);
  });
  await prova('segnala-sostieni', async () => {
    await p.evaluate(() => { const e = document.querySelector('[data-az="sostieni"]'); e.scrollIntoView({ block: 'center' }); }); await foto(p, '23-segnala-sostieni');
  });
  await b.close();
  console.log('Schermate in ' + OUT);
})();
