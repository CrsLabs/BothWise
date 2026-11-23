// BothWise dall'interfaccia, con due dispositivi simulati (PairWood simulato in Node, come in DoctorWood/prove/diretta.js).
// Uso: (python3 -m http.server 8767 --bind 127.0.0.1 -d www &) ; node prove/bothwise.js
const { chromium, devices } = require('playwright');
const URL = process.argv[2] || 'http://localhost:8767/index.html';

const MOCK = `(() => { window.__ascolto = []; window.__nativo = [];
  window.Capacitor = { isNativePlatform: () => true,
    addListener: (pl, ev, cb) => { if (pl === 'PairWood' && ev === 'evento') __ascolto.push(cb); if (pl === 'BothWise' && ev === 'inviaRicevi') (window.__inviaRicevi = window.__inviaRicevi || []).push(cb); if (pl === 'BothWise' && ev === 'condivisi') (window.__condivisi = window.__condivisi || []).push(cb); return { remove() {} }; },
    nativePromise: (pl, m, o) => { __nativo.push(pl + '.' + m); return window.__nat(pl, m, o || {}).then(r => r && r.errore ? Promise.reject(new Error(r.errore)) : r.v); } };
  window.__evento = e => __ascolto.forEach(f => { try { f(e); } catch (_) {} });
  // per estrarre tutti i testi mostrati (solo con HARVEST=1): serve a controllare che l'inglese li copra
  window.__testi = new Set(); window.__nonTradotti = new Set();
  if ('${process.env.LINGUA || ''}' === 'en') { try { localStorage.setItem('bothwise_lingua', JSON.stringify('en')); } catch (_) {} }
  const att = n => n.nodeType === 1 && ['aria-label', 'title', 'placeholder', 'alt'].forEach(a => { const v = n.getAttribute(a); if (v && v.trim()) __testi.add(v.trim()); });
  const scan = n => { if (n.nodeType === 3) { const t = n.data.trim(); if (t) __testi.add(t); } else if (n.nodeType === 1 && n.tagName !== 'SCRIPT' && n.tagName !== 'STYLE') { att(n); n.childNodes.forEach(scan); n.querySelectorAll && n.querySelectorAll('[aria-label],[title],[placeholder],[alt]').forEach(att); } };
  document.addEventListener('DOMContentLoaded', () => { scan(document.body); new MutationObserver(rr => rr.forEach(r => { if (r.type === 'characterData') scan(r.target); else if (r.type === 'attributes') att(r.target); else r.addedNodes.forEach(scan); })).observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['aria-label', 'title', 'placeholder', 'alt'] }); });
})();`;

const disp = {};
const nuovo = nome => ({ nome, avviato: false, conf: null, fidati: new Set(), accetta: null, pagina: null, file: {}, ascolto: null, chiamate: [], scelte: [] });
const evento = (d, e) => d.pagina && d.pagina.evaluate(e => window.__evento(e), e).catch(() => {});
function cartelleDi(d) { return (d.conf && d.conf.cartelle || []).filter(c => typeof c === 'object'); }
function giro(da) {
  let rag = 0;
  for (const x of Object.values(disp)) {
    if (x === da || !da.fidati.has(x.nome) || !x.fidati.has(da.nome) || !x.avviato) continue;
    rag++;
    // offerte: cartelle con nome che l'altro non ha
    for (const [a, b] of [[da, x], [x, da]]) {
      const nuove = cartelleDi(a).filter(c => !cartelleDi(b).some(y => y.id === c.id) && !b.rifiutate?.has(c.id));
      if (nuove.length) { b.offerte = nuove.map(c => ({ id: c.id, nome: c.nome, dispositivo: a.conf.nome || a.nome })); evento(b, { tipo: 'cartelleOfferte', dispositivo: a.nome, cartelle: b.offerte }); }
    }
    // file delle cartelle comuni: si copiano
    for (const c of cartelleDi(da)) if (cartelleDi(x).some(y => y.id === c.id)) {
      const fa = da.file[c.id] || {}, fx = x.file[c.id] || {};
      const unione = { ...fx, ...fa }; da.file[c.id] = { ...unione }; x.file[c.id] = { ...unione };
    }
  }
  evento(da, { tipo: 'sincronizzato', raggiunti: rag, abbinati: da.fidati.size, ricevuti: 0 });
}
async function nat(d, pl, m, o) {
  d.chiamate.push(pl + '.' + m);
  if (pl === 'BothWise') {
    if (m === 'aggiungiTile') { d.tile = (d.tile || 0) + 1; return { v: { esito: 'aggiunto' } }; }
    if (m === 'vibra') { (d.vibrazioni = d.vibrazioni || []).push(o); return { v: {} }; }
    if (m === 'puoSbloccare') return { v: { ok: !!d.blocco, impronta: !!d.blocco } };
    if (m === 'verificaIdentita') { d.sblocchi = (d.sblocchi || 0) + 1; return d.rifiutaSblocco ? { errore: 'Impronta non riconosciuta.' } : { v: {} }; }
    if (m === 'inviaRicevi') { const s = !!d.daTile; d.daTile = false; return { v: { si: s } }; }
    if (m === 'condivisi') { const u = d.condivisi || []; d.condivisi = []; return { v: { uris: u } }; }
    return { v: {} };
  }
  const st = () => ({ avviato: true, nome: d.conf && d.conf.nome || 'Pixel 7', id: d.nome.toUpperCase(), permessoRete: 'ok',
    ascolto: d.ascolto ? { attivo: true, descrizione: d.ascolto } : { attivo: false },
    dispositivi: [...d.fidati].map(n => ({ id: n, idLeggibile: n.toUpperCase(), nome: disp[n].conf && disp[n].conf.nome || n, ultimoContatto: Date.now(), pausaFino: (d.pauseDisp || {})[n] || 0 })) });
  switch (m) {
    case 'avvia': d.avviato = true; d.conf = o; return { v: st() };
    case 'stato': return { v: st() };
    case 'offerte': return { v: { offerte: (d.offerte || []).filter(x => !cartelleDi(d).some(c => c.id === x.id) && !d.rifiutate?.has(x.id)) } };
    case 'rifiutaOfferta': (d.rifiutate = d.rifiutate || new Set()).add(o.id); return { v: {} };
    case 'statoCartelle': return { v: { cartelle: cartelleDi(d).map(c => ({ id: c.id, nome: c.nome, dellUtente: true, file: Object.keys(d.file[c.id] || {}).length, byte: 1000 * Object.keys(d.file[c.id] || {}).length, conflitti: [], ...((d.extra || {})[c.id] || {}), pausaFino: (d.pauseCart || {})[c.id] || 0 })) } };
    case 'scegliCartellaUtente': { d.iniziale = o.iniziale; const s = d.scelte.shift(); return { v: s || { annullato: true } }; }
    case 'qr': return { v: { righe: Array.from({ length: 21 }, (_, y) => Array.from({ length: 21 }, (_, x) => (x + y) % 3 ? '1' : '0').join('')) } };
    case 'scansionaQr': return { v: d.qrLetto ? { codice: d.qrLetto } : { annullato: true } };
    case 'pausa': (d.pausaChiamate = d.pausaChiamate || []).push(o);
      if (o.cartella) (d.pauseCart = d.pauseCart || {})[o.cartella] = o.finoA === 0 ? 0 : o.finoA < 0 ? 9e15 : o.finoA;
      else (d.pauseDisp = d.pauseDisp || {})[o.dispositivo] = o.finoA === 0 ? 0 : o.finoA < 0 ? 9e15 : o.finoA;
      return { v: {} };
    case 'sblocca': (d.sbloccate = d.sbloccate || []).push(o.cartella); if (d.extra && d.extra[o.cartella]) delete d.extra[o.cartella].blocco; return { v: {} };
    case 'condizioni': return { v: { inCarica: false, nonMisurata: true, rete: d.rete || null, reteFidata: true, spazioLibero: 12e9, rimandate: d.rimandate || 0 } };
    case 'diagnosi': return { v: { testo: 'Giro 10:00: raggiunti 1 di 1' } };
    case 'chiediPosizione': d.rete = 'Casa'; return { v: { concesso: true } };
    case 'controllaImporta': return { v: { presenti: d.presentiImporta || [] } };
    case 'importa': (d.importati = d.importati || []).push(o); return { v: { percorsi: o.uris.map((u, i) => o.sottocartella + '/file' + i), rinominati: d.rinominatiImporta || [] } };
    case 'rilasciaCartellaUtente': return { v: {} };
    case 'nuovoCodice': return { v: { codice: 'ABCDEFGHJKMNPQRSTVWX' } };
    case 'accettaAbbinamento': d.accetta = o.codice; return { v: {} };
    case 'abbina': {
      const x = Object.values(disp).find(y => y !== d && y.accetta);
      if (!x) return { errore: 'Nessun dispositivo trovato: apri l\'app sull\'altro dispositivo, nella stessa Wi‑Fi, e attiva lì l\'abbinamento.' };
      if (x.accetta !== o.codice) return { errore: 'Codice di abbinamento sbagliato.' };
      x.accetta = null; d.fidati.add(x.nome); x.fidati.add(d.nome); evento(x, { tipo: 'abbinato', dispositivo: d.conf.nome || d.nome }); giro(d);
      return { v: { nome: x.conf && x.conf.nome || x.nome } };
    }
    case 'sincronizza': giro(d); return { v: { ricevuti: 0 } };
    case 'dimentica': d.fidati.delete(o.id); return { v: {} };
    case 'ascoltoContinuo': d.ascolto = o.attivo === false ? null : `${o.giorni.join(',')} ${o.inizio}-${o.fine}`; return { v: {} };
    case 'statoBatteria': return { v: { risparmioAttivo: false } };
    case 'cestino': return { v: { file: d.cestino || [] } };
    case 'statoCasella': return { v: { disponibile: !!(d.googleDisponibile || d.dropboxDisponibile), collegato: !!d.drive, chiave: !!d.drive, ultimoGiro: d.drive ? Date.now() : 0, errore: null, servizi: [d.googleDisponibile && 'google', d.dropboxDisponibile && 'dropbox'].filter(Boolean), servizio: d.drive ? d.servizio : null } };
    case 'collegaDrive': { const sv = o.servizio || 'google'; if (!(sv === 'dropbox' ? d.dropboxDisponibile : d.googleDisponibile)) return { errore: 'Servizio non ancora disponibile in questa versione dell\'app.' }; d.drive = true; d.servizio = sv; d.chiamateServizio = (d.chiamateServizio || []).concat(sv); return { v: { collegato: true } }; }
    case 'scollegaDrive': d.drive = false; d.svuotata = !!o.svuota; return { v: {} };
    case 'versioni': return { v: { file: d.versioni || [] } };
    case 'ultimeModifiche': return { v: { modifiche: (d.ultime || []).slice(0, o.limite || 100) } };
    case 'ripristina': {
      const v = (d.versioni || []).find(x => x.posizione === o.posizione && x.cartella === o.cartella);
      if (v) { (d.ripristinati = d.ripristinati || []).push('versione:' + v.percorso); return { v: { percorso: v.percorso } }; }
      const f = (d.cestino || []).find(x => x.posizione === o.posizione && x.cartella === o.cartella);
      if (!f) return { v: { percorso: null } };
      d.cestino = d.cestino.filter(x => x !== f); (d.ripristinati = d.ripristinati || []).push(f.percorso);
      return { v: { percorso: f.occupato ? f.percorso.replace(/(\.[^.]+)$/, ' (ripristinato)$1') : f.percorso } };
    }
    case 'eliminaDalCestino': d.cestino = (d.cestino || []).filter(x => !(x.posizione === o.posizione && x.cartella === o.cartella)); return { v: { eliminato: true } };
    case 'svuotaCestino': d.cestino = (d.cestino || []).filter(x => x.cartella !== o.cartella); return { v: { eliminati: 1 } };
    case 'cancellazioniInAttesa': return { v: { cancellazioni: d.daDecidere || [] } };
    case 'decidiCancellazioni':
      (d.decisioni = d.decisioni || []).push(JSON.parse(JSON.stringify(o)));
      d.daDecidere = (d.daDecidere || []).filter(x => !(x.cartella === o.cartella && o.percorsi.includes(x.percorso)));
      return { v: { decise: o.percorsi.length - (o.conferma && o.percorsi.includes(d.cambiato) ? 1 : 0) } };
    case 'sfoglia': {
      const alb = ((d.albero = d.albero || {})[o.cartella] = d.albero[o.cartella] || [{ percorso: 'foto/a.jpg', dimensione: 2048, modificato: Date.now() - 3600e3 }, { percorso: 'foto/lavori/b.pdf', dimensione: 4096, modificato: Date.now() - 7200e3 }, { percorso: 'note.txt', dimensione: 12, modificato: Date.now() - 600e3 }]);
      const pre = o.sub ? o.sub + '/' : '', cart = {}, file = [];
      for (const f of alb) { if (!f.percorso.startsWith(pre)) continue; const r = f.percorso.slice(pre.length), i = r.indexOf('/'); if (i < 0) file.push({ nome: r, percorso: f.percorso, cartella: false, dimensione: f.dimensione, modificato: f.modificato, figli: 0 }); else { const n = r.slice(0, i); (cart[n] = cart[n] || { nome: n, percorso: pre + n, cartella: true, dimensione: 0, modificato: 0, figli: 0 }); cart[n].figli++; cart[n].dimensione += f.dimensione; } }
      return { v: { voci: [...Object.values(cart), ...file] } };
    }
    case 'rinominaFile': { const alb = d.albero[o.cartella]; const nuovo = (o.percorso.includes('/') ? o.percorso.slice(0, o.percorso.lastIndexOf('/') + 1) : '') + o.nome; d.gestione = (d.gestione || []).concat({ op: 'rinomina', ...o }); for (const f of alb) if (f.percorso === o.percorso || f.percorso.startsWith(o.percorso + '/')) f.percorso = nuovo + f.percorso.slice(o.percorso.length); return { v: { percorso: nuovo } }; }
    case 'spostaFile': { const alb = d.albero[o.cartella]; const nome = o.percorso.split('/').pop(), nuovo = o.destinazione ? o.destinazione + '/' + nome : nome; d.gestione = (d.gestione || []).concat({ op: 'sposta', ...o }); for (const f of alb) if (f.percorso === o.percorso || f.percorso.startsWith(o.percorso + '/')) f.percorso = nuovo + f.percorso.slice(o.percorso.length); return { v: { percorso: nuovo } }; }
    case 'eliminaFile': { const alb = d.albero[o.cartella]; const resta = alb.filter(f => !(f.percorso === o.percorso || f.percorso.startsWith(o.percorso + '/'))); d.gestione = (d.gestione || []).concat({ op: 'elimina', ...o }); const n = alb.length - resta.length; d.albero[o.cartella] = resta; return { v: { file: n } }; }
    case 'apriFile': case 'condividiFile': (d.aperti = d.aperti || []).push({ m, ...o }); return { v: {} };
    case 'ricezioneFile': d.ricezione = o.attiva ? { attiva: true, fino: Date.now() + 600e3 } : { attiva: false, fino: 0 }; return { v: d.ricezione };
    case 'statoRicezioneFile': return { v: d.ricezione || { attiva: false, fino: 0 } };
    case 'conflitti': return { v: { conflitti: d.conflittiLista || [] } };
    case 'risolviConflitto': (d.risolti = d.risolti || []).push(o); d.conflittiLista = (d.conflittiLista || []).filter(k => k.copia !== o.copia); for (const e of Object.values(d.extra || {})) e.conflitti = (e.conflitti || []).filter(f => f !== o.copia); return { v: { fatto: true } };
    case 'scegliFile': return { v: d.fileScelti ? { uris: d.fileScelti } : { annullato: true } };
    case 'inviaFile': (d.inviati = d.inviati || []).push(o); return { v: { ricevuti: o.uris.length } };
    case 'fileRicevuti': return { v: { file: d.ricevutiLista || [] } };
    case 'salvaRicevuto': (d.salvati = d.salvati || []).push(o.nome); d.ricevutiLista = (d.ricevutiLista || []).filter(f => f.nome !== o.nome); return { v: { salvato: true } };
    case 'salvaRicevutoInDownload': (d.salvatiDownload = d.salvatiDownload || []).push(o.nome); d.ricevutiLista = (d.ricevutiLista || []).filter(f => f.nome !== o.nome); return { v: { salvato: true, come: o.nome } };
    case 'eliminaRicevuto': (d.eliminati = d.eliminati || []).push(o.nome); d.ricevutiLista = (d.ricevutiLista || []).filter(f => f.nome !== o.nome); return { v: { fatto: true } };
    case 'cancellaTutto': Object.assign(d, { avviato: false, fidati: new Set(), file: {}, ascolto: null }); return { v: {} };
    default: return { v: {} };
  }
}

(async () => {
  const b = await chromium.launch();
  let ok = 0, ko = 0;
  const esito = (n, c, info = '') => { if (c) ok++; else ko++; console.log((c ? '  ✓ ' : '  ✗ ') + n + (info ? ' — ' + info : '')); };
  const errori = [];
  async function apri(chiave, dev) {
    const d = disp[chiave] = nuovo(chiave);
    const ctx = await b.newContext({ locale: 'it-IT', ...dev });
    await ctx.addInitScript(MOCK);
    await ctx.exposeFunction('__nat', (pl, m, o) => nat(d, pl, m, o));
    const p = await ctx.newPage();
    p.on('pageerror', e => errori.push(chiave + ': ' + e.message));
    p.on('console', m => { if (m.type() === 'error' || /Content Security|Refused/.test(m.text())) errori.push(chiave + ' console: ' + m.text().slice(0, 160)); });
    await p.goto(URL); await p.waitForTimeout(800);
    d.pagina = p; return p;
  }
  const tocca = async (p, sel, t = 300) => { await p.locator(sel).filter({ visible: true }).first().click(); await p.waitForTimeout(t); };
  const fin = p => p.locator('#modalFinestra:not(.hidden)').waitFor({ timeout: 5000 });
  // apre una sezione delle Impostazioni (solo se è chiusa: toccarla di nuovo la richiude)
  const sezione = async (p, k) => { if ((await p.locator(`[data-arg="${k}"]`).getAttribute('aria-expanded')) !== 'true') await tocca(p, `[data-arg="${k}"]`); };
  const passo = async (n, fn) => { console.log('▶ ' + n); try { await fn(); } catch (e) { ko++; console.log('  ✗ ERRORE: ' + e.message.replace(/\s+/g, ' ').slice(0, 600)); } };

  const A = await apri('A', devices['Pixel 7']), B = await apri('B', devices['Galaxy Tab S4']);

  await passo('Primo avvio', async () => {
    esito('PairWood avviato con la porta di BothWise', disp.A.avviato && disp.A.conf.porta === 47812);
    esito('nessuna cartella: spiega cosa fare', /Nessuna cartella/.test(await A.locator('#cartelle').textContent()));
    esito('nessun dispositivo: spiega come abbinare', /Nessun dispositivo/.test(await A.locator('#dispositivi').textContent()));
    esito('stato «Nessun dispositivo abbinato»', /Nessun dispositivo abbinato/.test(await A.locator('#statoRete').textContent()));
  });

  await passo('Nome del dispositivo', async () => {
    await tocca(A, '#impBtn'); await tocca(A, '[data-arg="dispositivo"]'); await tocca(A, '[data-az="cambiaNome"]'); await fin(A);
    await A.locator('#finCampo').fill('Telefono di Cris'); await tocca(A, '#finSi', 500);
    esito('nome mandato a PairWood', disp.A.conf.nome === 'Telefono di Cris');
    await tocca(A, '[data-az="chiudiImpostazioni"]');
    esito('nome in Home', (await A.locator('#nomeDispositivo').textContent()) === 'Telefono di Cris');
    await tocca(B, '#impBtn'); await tocca(B, '[data-arg="dispositivo"]'); await tocca(B, '[data-az="cambiaNome"]'); await fin(B);
    await B.locator('#finCampo').fill('Tablet magazzino'); await tocca(B, '#finSi', 500); await tocca(B, '[data-az="chiudiImpostazioni"]');
  });

  // dopo un abbinamento l'app propone «Sempre raggiungibile»: qui si risponde «Non ora»
  const nonOra = async P => { await P.waitForTimeout(300); if (await P.locator('#modalFinestra:not(.hidden)').count() && /Sempre raggiungibile/.test(await P.locator('#finTitolo').textContent())) await tocca(P, '#finNo', 300); };
  await passo('Abbinamento: primi passi, codice sbagliato, poi giusto', async () => {
    esito('primi passi in Home: «Mostra il codice» e «Inquadra il codice»', await A.locator('#primiPassi:not(.hidden) [data-az="abbinaMostra"]').count() === 1 && await A.locator('#primiPassi [data-az="abbinaInquadra"]').count() === 1);
    await tocca(A, '#primiPassi [data-az="abbinaMostra"]'); await fin(A);
    esito('A mostra il codice', /ABCD-EFGH/.test(await A.locator('#finEvidenza').textContent()));
    await tocca(B, '#primiPassi [data-az="abbinaScrivi"]'); await fin(B);
    await B.locator('#finCampo').fill('1234'); await tocca(B, '#finSi');
    esito('codice corto: errore chiaro', /20 caratteri/.test(await B.locator('#finErrore').textContent()));
    await B.locator('#finCampo').fill('ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ'); await tocca(B, '#finSi', 600);
    esito('codice sbagliato: errore chiaro', /sbagliato/.test(await B.locator('#finErrore').textContent()));
    await B.locator('#finCampo').fill(''); await B.locator('#finCampo').pressSequentially('abcdefghjkmnpqrstvwx', { delay: 5 });
    esito('i trattini si mettono da soli ogni 4 caratteri', (await B.locator('#finCampo').inputValue()) === 'ABCD-EFGH-JKMN-PQRS-TVWX', await B.locator('#finCampo').inputValue());
    await tocca(B, '#finSi', 800);
    esito('abbinati', disp.A.fidati.has('B') && disp.B.fidati.has('A'));
    await A.waitForTimeout(300);
    esito('A: il codice si chiude da solo appena abbinati', !/Codice di abbinamento/.test((await A.locator('#modalFinestra:not(.hidden) #finTitolo').count()) ? await A.locator('#finTitolo').textContent() : ''));
    esito('dopo l\'abbinamento propone «Sempre raggiungibile»', /Sempre raggiungibile/.test(await B.locator('#modalFinestra:not(.hidden) #finTitolo').textContent().catch(() => '')));
    await nonOra(A); await nonOra(B);
    await A.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await A.waitForTimeout(400);
    esito('A vede «Tablet magazzino»', /Tablet magazzino/.test(await A.locator('#dispositivi').textContent()));
    esito('B vede «Telefono di Cris»', /Telefono di Cris/.test(await B.locator('#dispositivi').textContent()));
    esito('primi passi: ora la cartella', await A.locator('#primiPassi:not(.hidden) [data-az="aggiungiCartella"]').count() === 1);
  });

  await passo('Cartella aggiunta su A, proposta e accettata su B', async () => {
    disp.A.scelte.push({ uri: 'content://a/Documenti', nome: 'Documenti' });
    await tocca(A, '[data-az="aggiungiCartella"]', 400);
    esito('«Aggiungi cartella» propone le cartelle pronte', await A.locator('#listaCorpo [data-az="cartellaPronta"]').count() === 4 && /Foto della fotocamera/.test(await A.locator('#listaCorpo').textContent()));
    await tocca(A, '[data-az="cartellaPronta"][data-arg="altra"]', 400); await fin(A);
    esito('propone il nome della cartella', (await A.locator('#finCampo').inputValue()) === 'Documenti');
    await A.locator('#finCampo').fill('Documenti ufficio'); await tocca(A, '#finSi', 800);
    const ca = disp.A.conf.cartelle.find(c => typeof c === 'object');
    esito('A: cartella con uri e nome mandata a PairWood', ca && ca.uri === 'content://a/Documenti' && ca.nome === 'Documenti ufficio');
    esito('A: cartella in Home', /Documenti ufficio/.test(await A.locator('#cartelle').textContent()));
    disp.A.file[ca.id] = { 'preventivo.pdf': 1, 'listino.xlsx': 1 };
    await tocca(A, '#sincBtn', 800);
    await B.waitForTimeout(500);
    esito('B: la cartella è proposta, in cima e ben visibile', /Nuova cartella da sincronizzare/.test(await B.locator('#offerte').textContent()) && /«Documenti ufficio»/.test(await B.locator('#offerte').textContent()) && await B.evaluate(() => document.getElementById('offerte').getBoundingClientRect().top < 300));
    disp.B.scelte.push({ uri: 'content://b/Doc', nome: 'Doc' });
    await tocca(B, '[data-az="accettaOfferta"]'); await fin(B);
    esito('spiega che i file si uniscono senza perdite', /niente si perde/.test(await B.locator('#finTesto').textContent()));
    await tocca(B, '#finSi', 900);
    const cb = disp.B.conf.cartelle.find(c => typeof c === 'object');
    esito('B: stessa cartella (stesso id), nella posizione scelta', cb && cb.id === ca.id && cb.uri === 'content://b/Doc' && cb.nome === 'Documenti ufficio');
    await B.waitForTimeout(400); await B.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await B.waitForTimeout(400);
    esito('B: proposta sparita, cartella con i suoi 2 file', !(await B.locator('#offerte').textContent()).trim() && /2 file/.test(await B.locator('#cartelle').textContent()), await B.locator('#cartelle').textContent());
  });

  await passo('Rifiutare una proposta', async () => {
    disp.A.scelte.push({ uri: 'content://a/Foto', nome: 'Foto' });
    await tocca(A, '[data-az="aggiungiCartella"]', 400); await tocca(A, '[data-az="cartellaPronta"][data-arg="altra"]', 400); await fin(A); await tocca(A, '#finSi', 800);
    await tocca(A, '#sincBtn', 800); await B.waitForTimeout(400);
    esito('B: «Foto» proposta', /«Foto»/.test(await B.locator('#offerte').textContent()));
    await tocca(B, '[data-az="rifiutaOfferta"]', 500);
    esito('B: rifiutata e non più proposta', !(await B.locator('#offerte').textContent()).trim());
  });

  await passo('Smettere di sincronizzare una cartella', async () => {
    await tocca(A, '[data-az="apriCartella"]'); await tocca(A, '[data-az="smettiCartella"]'); await fin(A);
    esito('spiega che i file restano', /restano su questo dispositivo/.test(await A.locator('#finTesto').textContent()));
    await tocca(A, '#finSi', 800);
    esito('cartella tolta e permesso restituito', disp.A.conf.cartelle.filter(c => typeof c === 'object').length === 1 && disp.A.chiamate.includes('PairWood.rilasciaCartellaUtente'));
  });

  await passo('Cestino: vedere, ripristinare, eliminare, svuotare', async () => {
    const id = disp.B.conf.cartelle.find(c => typeof c === 'object').id;
    const ora = Date.now();
    disp.B.cestino = [
      { cartella: id, posizione: '.sincronia/cestino/20261112-101500/fatture/marzo.pdf', percorso: 'fatture/marzo.pdf', dimensione: 2048, tolto: ora },
      { cartella: id, posizione: '.sincronia/cestino/20261112-101500/<img src=x>.txt', percorso: '<img src=x>.txt', dimensione: 10, tolto: ora - 1000, occupato: true },
      { cartella: id, posizione: '.sincronia/cestino/20261110-080000/vecchio.txt', percorso: 'vecchio.txt', dimensione: 5, tolto: ora - 2 * 86400000 },
    ];
    esito('riga «Cestino» in Home (c\'è una cartella)', await B.locator('#cestinoRiga:not(.hidden)').count() === 1);
    await tocca(B, '#cestinoRiga', 500);
    const testo = await B.locator('#listaCorpo').textContent();
    esito('elenco del cestino con nome, cartella e posizione', /marzo\.pdf/.test(testo) && /fatture/.test(testo) && /Documenti ufficio/.test(testo) && /2 KB/.test(testo), testo.slice(0, 120));
    esito('i nomi arrivati da fuori non diventano codice', await B.locator('#listaCorpo img').count() === 0 && /<img src=x>\.txt/.test(testo));
    await tocca(B, '#listaCorpo [data-az="ripristina"]', 600);
    esito('ripristino chiesto a PairWood', (disp.B.ripristinati || []).includes('fatture/marzo.pdf'));
    esito('avviso: tornato al suo posto', /tornato al suo posto/.test(await B.locator('#avvisoTesto').textContent()));
    esito('il ripristinato sparisce dall\'elenco', !/marzo\.pdf/.test(await B.locator('#listaCorpo').textContent()));
    await tocca(B, '#listaCorpo [data-az="ripristina"]', 600);
    esito('posto occupato: avviso con il nuovo nome, l\'altro file non toccato', /ripristinato\)\.txt/.test(await B.locator('#avvisoTesto').textContent()) && /non è stato toccato/.test(await B.locator('#avvisoTesto').textContent()));
    await tocca(B, '#listaCorpo [data-az="eliminaDalCestino"]'); await fin(B);
    esito('eliminare per sempre chiede conferma', /non si potrà più recuperare/.test(await B.locator('#finTesto').textContent()));
    await tocca(B, '#finNo');
    esito('annullato: il file resta', disp.B.cestino.length === 1);
    await tocca(B, '#listaPiede [data-az="svuotaCestino"]'); await fin(B); await tocca(B, '#finSi', 600);
    esito('cestino svuotato: lo dice', disp.B.cestino.length === 0 && /è vuoto/.test(await B.locator('#listaTesto').textContent()));
    esito('Indietro chiude l\'elenco', await B.evaluate(() => window.__indietro()) && await B.locator('#modalLista.hidden').count() === 1);
  });

  await passo('Chiedi prima di cancellare', async () => {
    const id = disp.B.conf.cartelle.find(c => typeof c === 'object').id;
    await tocca(B, '#impBtn'); await sezione(B, 'dati');
    esito('spenta all\'inizio', (await B.locator('#impConferma').getAttribute('aria-checked')) === 'false' && !disp.B.conf.confermaCancellazioni);
    await tocca(B, '#impConferma', 800);
    esito('accesa: PairWood riavviato con la conferma', disp.B.conf.confermaCancellazioni === true && (await B.locator('#impConferma').getAttribute('aria-checked')) === 'true');
    await tocca(B, '[data-az="chiudiImpostazioni"]');
    disp.B.daDecidere = [{ cartella: id, percorso: 'listino.xlsx' }, { cartella: id, percorso: 'foto/cantiere 1.jpg' }, { cartella: id, percorso: 'foto/cantiere 2.jpg' }];
    await evento(disp.B, { tipo: 'daConfermare', percorsi: ['listino.xlsx'] }); await B.waitForTimeout(500);
    esito('in Home: «3 file tolti … aspettano la tua conferma»', /3 file tolti.*Documenti ufficio.*aspettano la tua conferma/.test(await B.locator('#attesa').textContent()), await B.locator('#attesa').textContent());
    await tocca(B, '[data-az="apriAttesa"]', 400);
    esito('elenco dei file da confermare', /listino\.xlsx/.test(await B.locator('#listaCorpo').textContent()) && /Togli tutti i 3 file/.test(await B.locator('#listaPiede').textContent()));
    await tocca(B, '#listaCorpo [data-az="tieniFile"]', 600);
    esito('«Tieni» un file: deciso senza cancellare', JSON.stringify(disp.B.decisioni.at(-1)) === JSON.stringify({ cartella: id, percorsi: ['listino.xlsx'], conferma: false }), JSON.stringify(disp.B.decisioni.at(-1)));
    esito('restano 2 da decidere', /2 file tolti/.test(await B.locator('#attesa').textContent()) && /Togli tutti i 2 file/.test(await B.locator('#listaPiede').textContent()));
    disp.B.cambiato = 'foto/cantiere 2.jpg';
    await tocca(B, '#listaPiede [data-az="togliTutti"]', 700);
    esito('«Togli tutti»: i 2 file nel cestino', disp.B.decisioni.at(-1).conferma === true && disp.B.decisioni.at(-1).percorsi.length === 2);
    esito('file cambiato qui nel frattempo: lo dice (resta)', /cambiato qui nel frattempo/.test(await B.locator('#avvisoTesto').textContent()));
    esito('tutto deciso: elenco chiuso, niente in Home', await B.locator('#modalLista.hidden').count() === 1 && !(await B.locator('#attesa').textContent()).trim());
    // spegnere con file in attesa: avvisa che andranno nel cestino
    disp.B.daDecidere = [{ cartella: id, percorso: 'x.txt' }]; await evento(disp.B, { tipo: 'daConfermare', percorsi: ['x.txt'] }); await B.waitForTimeout(400);
    await tocca(B, '#impBtn'); await sezione(B, 'dati'); await tocca(B, '#impConferma'); await fin(B);
    esito('spegnere con file in attesa: avvisa', /andrà nel cestino/.test(await B.locator('#finTesto').textContent()));
    await tocca(B, '#finSi', 800);
    esito('spenta', disp.B.conf.confermaCancellazioni === false && (await B.locator('#impConferma').getAttribute('aria-checked')) === 'false');
    disp.B.daDecidere = [];
    await tocca(B, '[data-az="chiudiImpostazioni"]');
  });

  await passo('Cartella a senso unico', async () => {
    const id = disp.B.conf.cartelle.find(c => typeof c === 'object').id;
    esito('di serie: invia e ricevi', disp.B.conf.cartelle.find(c => c.id === id).modo === 'entrambi');
    await tocca(B, '[data-az="apriCartella"]', 400);
    esito('dettaglio della cartella con i tre modi', await B.locator('#listaCorpo [data-az="scegliModo"]').count() === 3 && (await B.locator('[data-arg="entrambi"]').getAttribute('aria-checked')) === 'true');
    await tocca(B, '#listaCorpo [data-arg="soloRicezione"]', 800);
    esito('«Solo ricezione» mandato a PairWood', disp.B.conf.cartelle.find(c => c.id === id).modo === 'soloRicezione');
    esito('spiega cosa vuol dire', /restano qui/.test(await B.locator('#listaCorpo').textContent()) && (await B.locator('[data-arg="soloRicezione"]').getAttribute('aria-checked')) === 'true');
    await tocca(B, '[data-az="chiudiLista"]');
    esito('in Home la cartella dice «Solo ricezione»', /Solo ricezione/.test(await B.locator('#cartelle').textContent()));
    await tocca(B, '[data-az="apriCartella"]', 400); await tocca(B, '#listaCorpo [data-arg="entrambi"]', 800); await tocca(B, '[data-az="chiudiLista"]');
    esito('si torna a «Invia e ricevi»', disp.B.conf.cartelle.find(c => c.id === id).modo === 'entrambi');
  });

  await passo('Versioni precedenti', async () => {
    const id = disp.B.conf.cartelle.find(c => typeof c === 'object').id;
    esito('di serie accese (mandate a PairWood)', disp.B.conf.versioni === true);
    disp.B.versioni = [{ cartella: id, posizione: '.sincronia/versioni/20261112-101500/preventivo.pdf', percorso: 'preventivo.pdf', dimensione: 4096, tolto: Date.now() - 3600000 }];
    await tocca(B, '[data-az="apriCartella"]', 400); await tocca(B, '#listaPiede [data-az="apriVersioni"]', 500);
    esito('elenco delle versioni della cartella', /preventivo\.pdf/.test(await B.locator('#listaCorpo').textContent()) && /Versioni precedenti/.test(await B.locator('#listaTitolo').textContent()));
    await tocca(B, '#listaCorpo [data-az="ripristina"]'); await fin(B);
    esito('ripristinare chiede conferma e dice che l\'attuale non si perde', /non si perde/.test(await B.locator('#finTesto').textContent()));
    await tocca(B, '#finSi', 600);
    esito('ripristino chiesto a PairWood', (disp.B.ripristinati || []).includes('versione:preventivo.pdf'));
    esito('avviso: tornato com\'era', /tornato com'era/.test(await B.locator('#avvisoTesto').textContent()));
    await tocca(B, '[data-az="chiudiLista"]');
    await tocca(B, '#impBtn'); await sezione(B, 'dati');
    esito('interruttore acceso', (await B.locator('#impVersioni').getAttribute('aria-checked')) === 'true');
    await tocca(B, '#impVersioni', 800);
    esito('spento: PairWood riavviato senza versioni', disp.B.conf.versioni === false && (await B.locator('#impVersioni').getAttribute('aria-checked')) === 'false');
    await tocca(B, '#impVersioni', 800);
    esito('riacceso', disp.B.conf.versioni === true);
    await tocca(B, '[data-az="chiudiImpostazioni"]');
  });

  await passo('File da non sincronizzare', async () => {
    esito('di serie: esclusi i file temporanei', disp.B.conf.esclusioniDiSerie === true && JSON.stringify(disp.B.conf.esclusioni) === '[]');
    await tocca(B, '#impBtn'); await sezione(B, 'sinc'); await tocca(B, '[data-az="apriRegole"]', 300);
    await B.locator('#regoleCampo').fill('*.mp4\n\n  Bozze/  \nnote-*.txt');
    await tocca(B, '[data-az="salvaRegole"]', 800);
    esito('regole mandate a PairWood (pulite)', JSON.stringify(disp.B.conf.esclusioni) === JSON.stringify(['*.mp4', 'Bozze/', 'note-*.txt']), JSON.stringify(disp.B.conf.esclusioni));
    esito('riassunto nelle Impostazioni', /3 regole/.test(await B.locator('#impRegoleSotto').textContent()));
    await tocca(B, '[data-az="apriRegole"]', 300);
    esito('riaprendo ci sono le regole salvate', (await B.locator('#regoleCampo').inputValue()) === '*.mp4\nBozze/\nnote-*.txt');
    await B.locator('#regoleCampo').fill('x'.repeat(201)); await tocca(B, '[data-az="salvaRegole"]', 300);
    esito('regola troppo lunga: errore chiaro, niente salvato', /troppo lunga/.test(await B.locator('#regoleErrore').textContent()) && disp.B.conf.esclusioni.length === 3);
    await tocca(B, '[data-az="chiudiLista"]');
    await tocca(B, '#impEsclSerie', 800);
    esito('esclusioni di serie spente', disp.B.conf.esclusioniDiSerie === false);
    await tocca(B, '#impEsclSerie', 800);
    await tocca(B, '[data-az="chiudiImpostazioni"]');
  });

  await passo('Avanzamento e ultime modifiche', async () => {
    const id = disp.B.conf.cartelle.find(c => typeof c === 'object').id;
    esito('senza modifiche il blocco non c\'è', await B.locator('#ultimeBlocco.hidden').count() === 1);
    await evento(disp.B, { tipo: 'avanzamento', dispositivo: 'Telefono di Cris', cartella: id, percorso: 'foto/IMG_2031.jpg', fileFatti: 2, fileTotali: 12, byteFatti: 47185920, byteTotali: 125829120, secondi: 20, finito: false });
    await B.waitForTimeout(200);
    const t = await B.locator('#avanzTesto').textContent();
    esito('mentre arriva: file, quanti, quanto e velocità', /IMG_2031\.jpg/.test(t) && /3 di 12 file/.test(t) && /45,0 MB di 120,0 MB/.test(t) && /2,3 MB\/s/.test(t), t);
    esito('barra al 38%', (await B.locator('#avanzBarra').getAttribute('aria-valuenow')) === '38');
    disp.B.ultime = [
      { cartella: id, quando: Date.now(), percorso: 'foto/IMG_2031.jpg', tipo: 'arrivato', dispositivo: 'Telefono di Cris' },
      { cartella: id, quando: Date.now() - 1000, percorso: 'listino.xlsx', tipo: 'cambiato', dispositivo: 'Telefono di Cris' },
      { cartella: id, quando: Date.now() - 2000, percorso: '<b>vecchio</b>.txt', tipo: 'tolto', dispositivo: '<i>x</i>' },
    ];
    await evento(disp.B, { tipo: 'avanzamento', dispositivo: 'Telefono di Cris', cartella: id, percorso: null, fileFatti: 12, fileTotali: 12, byteFatti: 125829120, byteTotali: 125829120, secondi: 50, finito: true });
    await B.waitForTimeout(500);
    esito('alla fine: «Arrivati 12 file»', /Arrivati 12 file/.test(await B.locator('#avanzTesto').textContent()));
    const u = await B.locator('#ultime').textContent();
    esito('ultime modifiche in Home (solo le 2 più recenti, compatte)', /IMG_2031\.jpg/.test(u) && /cambiato/.test(u) && /Telefono di Cris/.test(u) && await B.locator('#ultime > *').count() <= 2 && /Vedi tutte \(3\)/.test(await B.locator('#ultimeTutte').textContent()), u.replace(/\s+/g, ' ').slice(0, 160));
    esito('nomi arrivati da fuori non diventano codice', await B.locator('#ultime b, #ultime i:not(.fa-solid)').count() === 0);
    await tocca(B, '[data-az="apriUltime"]', 300);
    esito('«Vedi tutte»: elenco completo', await B.locator('#listaCorpo .bw-modifica').count() === 3);
    await tocca(B, '[data-az="chiudiLista"]');
  });

  await passo('Fuori dalla Wi‑Fi (Google Drive o Dropbox)', async () => {
    esito('avvio con la casella: dati mobili sì, nome della cartella', disp.B.conf.casellaDatiMobili === true && disp.B.conf.nomeCasella === 'BothWise - casella cifrata' && /^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(disp.B.conf.googleClientId) && /^[a-z0-9]{10,20}$/.test(disp.B.conf.dropboxAppKey));
    await tocca(B, '#impBtn'); await sezione(B, 'cloud');
    esito('senza registrazione presso Google: «In arrivo»', /In arrivo/.test(await B.locator('#impDriveSotto').textContent()));
    await tocca(B, '#impDrive'); await fin(B);
    esito('spiega che arriverà, senza errori', /non ancora attiva/.test(await B.locator('#finTesto').textContent()) && !disp.B.chiamate.includes('PairWood.collegaDrive'));
    await tocca(B, '#finSi');
    disp.B.googleDisponibile = true; await tocca(B, '[data-az="chiudiImpostazioni"]');
    await B.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await B.waitForTimeout(400);
    await tocca(B, '#impBtn'); await sezione(B, 'cloud');
    esito('registrata: «Non collegato»', /Non collegato/.test(await B.locator('#impDriveSotto').textContent()));
    await tocca(B, '#impDrive'); await fin(B);
    esito('prima di collegare si sceglie il servizio e si spiega cosa succede (browser, stesso account)', /browser/.test(await B.locator('#finTesto').textContent()) && /stesso account/.test(await B.locator('#finTesto').textContent()) && /Google Drive/.test(await B.locator('#finSi').textContent()) && /Dropbox/.test(await B.locator('#finAlt').textContent()));
    await tocca(B, '#finAlt'); await fin(B);
    esito('Dropbox non ancora registrato: lo dice, senza errori', /Dropbox non è ancora attivo/.test(await B.locator('#finTesto').textContent()) && !disp.B.chiamate.includes('PairWood.collegaDrive'));
    await tocca(B, '#finSi'); await B.waitForTimeout(500);
    await tocca(B, '#impDrive'); await fin(B);
    await tocca(B, '#finSi', 700);
    esito('collegato a Google Drive', disp.B.drive === true && disp.B.servizio === 'google' && /Collegato a Google Drive/.test(await B.locator('#impDriveSotto').textContent()));
    await tocca(B, '[data-az="chiudiImpostazioni"]');
    esito('in Home lo stato dice «Google Drive»', /Google Drive/.test(await B.locator('#statoRete').textContent()));
    // nessuno nella stessa Wi‑Fi ma la casella funziona: niente «Nessuno raggiungibile», si dice che ci si sincronizza dal Drive
    await evento(disp.B, { tipo: 'sincronizzato', raggiunti: 0, abbinati: 1, ricevuti: 0 }); await B.waitForTimeout(400);
    { const t = await B.locator('#statoRete').textContent(), pal = await B.locator('#pallino').getAttribute('class');
      esito('fuori dalla Wi‑Fi con il Drive: «sincronizzato tramite Google Drive», pallino verde', /Fuori dalla Wi‑Fi: s(incronizzato|i sincronizza) tramite Google Drive/.test(t) && !/Nessuno raggiungibile/.test(t) && /\bok\b/.test(pal), t + ' ' + pal); }
    await evento(disp.B, { tipo: 'casella', ricevuti: 0, errore: 'L\'accesso a Google Drive è scaduto o è stato revocato: collega di nuovo l\'account.', ricollegare: true });
    await B.waitForTimeout(300);
    esito('errore della casella mostrato chiaramente', /collega di nuovo/.test(await B.locator('#avvisoTesto').textContent()));
    await tocca(B, '#impBtn'); await sezione(B, 'cloud');
    await tocca(B, '#impDatiMobili', 800);
    esito('«Anche con la rete mobile» spento: mandato a PairWood', disp.B.conf.casellaDatiMobili === false);
    await tocca(B, '#impDatiMobili', 800);
    await tocca(B, '#impDrive'); await fin(B); await tocca(B, '#finAlt'); await fin(B);
    esito('scollegare offre anche di cancellare la casella', /cancella la casella/.test(await B.locator('#finAlt').textContent()));
    await tocca(B, '#finAlt', 800);
    esito('scollegato e casella cancellata', disp.B.drive === false && disp.B.svuotata === true);
    // Dropbox: quando è registrato si sceglie al posto di Google e lo stato lo dice
    disp.B.dropboxDisponibile = true; await tocca(B, '[data-az="chiudiImpostazioni"]');
    await B.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await B.waitForTimeout(400);
    await tocca(B, '#impBtn'); await sezione(B, 'cloud');
    await tocca(B, '#impDrive'); await fin(B); await tocca(B, '#finAlt', 700);
    esito('collegato a Dropbox', disp.B.drive === true && disp.B.servizio === 'dropbox' && /Collegato a Dropbox/.test(await B.locator('#impDriveSotto').textContent()));
    await tocca(B, '[data-az="chiudiImpostazioni"]');
    esito('in Home lo stato dice «Dropbox»', /Dropbox/.test(await B.locator('#statoRete').textContent()));
    await tocca(B, '#impBtn'); await sezione(B, 'cloud');
    await tocca(B, '#impDrive'); await fin(B); await tocca(B, '#finAlt'); await fin(B);
    esito('scollegare cita Dropbox', /Scollegare Dropbox/.test(await B.locator('#finTitolo').textContent()));
    await tocca(B, '#finAlt', 800);
    await tocca(B, '[data-az="chiudiImpostazioni"]');
  });

  await passo('Protezioni automatiche', async () => {
    const id = disp.B.conf.cartelle.find(c => typeof c === 'object').id;
    disp.B.extra = { [id]: { blocco: { motivo: 'cancellazioni', quanti: 55, totali: 60 } } };
    await B.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await B.waitForTimeout(500);
    esito('in Home: cambiamenti trattenuti, con il motivo', /spariti 55 file su 60/.test(await B.locator('#protezioni').textContent()) && /Trattenuta/.test(await B.locator('#cartelle').textContent()));
    await tocca(B, '#protezioni [data-az="sbloccaCartella"]'); await fin(B);
    esito('confermare spiega cosa succede', /cestino/.test(await B.locator('#finTesto').textContent()));
    await tocca(B, '#finSi', 700);
    esito('confermato: PairWood li lascia partire', (disp.B.sbloccate || []).includes(id) && !(await B.locator('#protezioni').textContent()).trim());
    disp.B.extra = { [id]: { permesso: false } };
    await B.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await B.waitForTimeout(500);
    esito('permesso tolto da Android: lo dice', /tolto il permesso/.test(await B.locator('#protezioni').textContent()));
    disp.B.scelte.push({ uri: 'content://b/Doc2', nome: 'Doc' });
    await tocca(B, '[data-az="ridaiPermesso"]'); await fin(B); await tocca(B, '#finSi', 900);
    esito('permesso ridato: stessa cartella, nuovo accesso', disp.B.conf.cartelle.find(c => c.id === id).uri === 'content://b/Doc2');
    disp.B.extra = {};
    await B.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await B.waitForTimeout(400);
  });

  await passo('Pausa di una cartella e di un dispositivo', async () => {
    const id = disp.B.conf.cartelle.find(c => typeof c === 'object').id;
    await tocca(B, '[data-az="apriCartella"]', 400); await tocca(B, '[data-az="pausaCartella"]', 300);
    esito('tre scelte di pausa', await B.locator('#listaCorpo [data-az="confermaPausa"]').count() === 3);
    await tocca(B, '#listaCorpo [data-az="confermaPausa"]', 700);
    const ch = disp.B.pausaChiamate.at(-1);
    esito('in pausa per un\'ora', ch.cartella === id && Math.abs(ch.finoA - Date.now() - 3600e3) < 60e3);
    esito('in Home la cartella dice «In pausa»', /In pausa/.test(await B.locator('#cartelle').textContent()));
    await tocca(B, '[data-az="apriCartella"]', 400); await tocca(B, '[data-az="riprendiCartella"]', 700); await tocca(B, '[data-az="chiudiLista"]');
    esito('ripresa', disp.B.pausaChiamate.at(-1).finoA === 0 && !/In pausa/.test(await B.locator('#cartelle').textContent()));
    await tocca(B, '[data-az="apriDispositivo"]'); await fin(B);
    await tocca(B, '#finSi', 300); await tocca(B, '#listaCorpo [data-az="confermaPausa"]:nth-child(3)', 700);
    esito('dispositivo in pausa finché non lo riprendo', disp.B.pausaChiamate.at(-1).dispositivo === 'A' && disp.B.pausaChiamate.at(-1).finoA === -1 && /In pausa/.test(await B.locator('#dispositivi').textContent()));
    await tocca(B, '[data-az="apriDispositivo"]'); await fin(B); await tocca(B, '#finSi', 600);
    esito('dispositivo ripreso', disp.B.pausaChiamate.at(-1).finoA === 0);
  });

  await passo('Abbinamento con il QR', async () => {
    await tocca(A, '[data-az="abbina"]'); await A.locator('#modalLista:not(.hidden)').waitFor({ timeout: 5000 });
    esito('tre strade chiare: mostra, inquadra, scrivi', await A.locator('#listaCorpo [data-az="abbinaMostra"], #listaCorpo [data-az="abbinaInquadra"], #listaCorpo [data-az="abbinaScrivi"]').count() === 3);
    await tocca(A, '#listaCorpo [data-az="abbinaMostra"]', 600); await fin(A);
    esito('il codice si vede anche come QR', await A.locator('#finQr:not(.hidden) svg path').count() === 1 && /ABCD-EFGH/.test(await A.locator('#finEvidenza').textContent()));
    disp.B.qrLetto = 'ABCDEFGHJKMNPQRSTVWX';
    const prima = disp.B.chiamate.filter(x => x === 'PairWood.abbina').length;
    await tocca(B, '[data-az="abbina"]'); await B.locator('#modalLista:not(.hidden)').waitFor({ timeout: 5000 });
    await tocca(B, '#listaCorpo [data-az="abbinaInquadra"]', 900);
    esito('inquadrato: abbina da solo, senza altri tocchi', disp.B.chiamate.filter(x => x === 'PairWood.abbina').length === prima + 1);
    await nonOra(A); await nonOra(B);
    if (await A.locator('#modalFinestra:not(.hidden)').count()) await tocca(A, '#finSi', 300);
    await B.evaluate(() => window.__indietro()); await A.evaluate(() => window.__indietro());
  });

  await passo('Cartelle pronte', async () => {
    disp.A.scelte.push({ uri: 'content://a/DCIM/Camera', nome: 'Camera' });
    await tocca(A, '[data-az="aggiungiCartella"]', 400); await tocca(A, '[data-az="cartellaPronta"][data-arg="foto"]', 400); await fin(A);
    esito('prima spiega cosa toccare nel selettore', /Usa questa cartella/.test(await A.locator('#finTesto').textContent()));
    await tocca(A, '#finSi', 500); await fin(A);
    esito('il selettore si apre già su DCIM/Camera', disp.A.iniziale === 'DCIM/Camera');
    esito('nome già proposto', (await A.locator('#finCampo').inputValue()) === 'Foto del telefono');
    await tocca(A, '#finSi', 900);
    const f = disp.A.conf.cartelle.find(c => c.uri === 'content://a/DCIM/Camera');
    esito('foto della fotocamera in «Solo invio»', f && f.modo === 'soloInvio' && f.nome === 'Foto del telefono');
    // scelta un'altra cartella: lo dice e si può riprovare
    disp.A.scelte.push({ uri: 'content://a/Download', nome: 'Download', percorso: 'Download' });
    await tocca(A, '[data-az="aggiungiCartella"]', 400); await tocca(A, '[data-az="cartellaPronta"][data-arg="foto"]', 400); await fin(A);
    await tocca(A, '#finSi', 500); await fin(A);
    esito('cartella diversa da quella della fotocamera: chiede se è giusta', /È la cartella giusta/.test(await A.locator('#finTitolo').textContent()) && /Download/.test(await A.locator('#finTesto').textContent()));
    await tocca(A, '#finNo', 400);
    esito('annullato: la cartella sbagliata non viene aggiunta', !disp.A.conf.cartelle.some(c => c.uri === 'content://a/Download'));
  });

  await passo('Condividi con BothWise', async () => {
    disp.B.condivisi = ['content://altra.app/1', 'content://altra.app/2'];
    await B.evaluate(() => (window.__condivisi || []).forEach(f => f({ quanti: 2 }))); await B.waitForTimeout(500);
    esito('chiede dove salvare i 2 file', /Dove salvare i 2 file/.test(await B.locator('#listaTitolo').textContent()));
    await tocca(B, '#listaCorpo [data-az="salvaCondivisi"]', 800);
    const im = (disp.B.importati || []).at(-1);
    esito('copiati nella sottocartella «Condivisi»', im && im.sottocartella === 'Condivisi' && im.uris.length === 2);
    await B.waitForTimeout(1300);
    esito('lo dice', /2 file salvati/.test(await B.locator('#avvisoTesto').textContent()));
  });

  await passo('Annulla la copia con una sorgente che non risponde', async () => {
    disp.B.condivisi = ['content://galleria/1'];
    await B.evaluate(() => { const o = window.Capacitor.nativePromise; window.__salvaNP = o; window.Capacitor.nativePromise = (p, m, x) => (m === 'importa' ? new Promise(() => {}) : o.call(window.Capacitor, p, m, x)); });
    await B.evaluate(() => (window.__condivisi || []).forEach(f => f({ quanti: 1 }))); await B.waitForTimeout(500);
    await tocca(B, '#listaCorpo [data-az="salvaCondivisi"]', 600);
    esito('la finestra di copia è aperta con «Annulla la copia»', await B.locator('#modalFinestra').isVisible() && await B.locator('#finNo').isVisible());
    await tocca(B, '#finNo', 300);
    esito('«Annulla la copia» chiede conferma (la finestra resta)', await B.locator('#modalFinestra').isVisible() && /davvero annullare/.test(await B.locator('#finTesto').textContent()));
    await tocca(B, '#finNo', 300);
    esito('«No, continua la copia» torna alla copia', await B.locator('#modalFinestra').isVisible() && /Copio/.test(await B.locator('#finTesto').textContent()));
    await tocca(B, '#finNo', 300);
    await tocca(B, '#finSi', 500);
    esito('«Annulla la copia» chiude subito la finestra anche se la copia non risponde', !(await B.locator('#modalFinestra').isVisible()));
    esito('lo dice', /Copia annullata/.test(await B.locator('#avvisoTesto').textContent()));
    await B.evaluate(() => { window.Capacitor.nativePromise = window.__salvaNP; });
  });

  await passo('Sincronizzazione: file grandi, reti di fiducia, notifiche', async () => {
    esito('di serie: file grandi oltre 50 MB, notifiche accese', disp.B.conf.grandiMB === 50 && disp.B.conf.notifiche === true);
    await tocca(B, '#impBtn'); await sezione(B, 'condizioni');
    await tocca(B, 'button[data-grandi="200"]', 700);
    esito('oltre 200 MB mandato a PairWood', disp.B.conf.grandiMB === 200);
    await tocca(B, '#impNotifiche', 700);
    esito('notifiche spente', disp.B.conf.notifiche === false && (await B.locator('#impNotifiche').getAttribute('aria-checked')) === 'false');
    await tocca(B, '#impNotifiche', 700);
    await tocca(B, '#impReti', 500);
    esito('nessuna rete: si sincronizza in ogni Wi‑Fi', /Nessuna/.test(await B.locator('#listaTesto').textContent()));
    await tocca(B, '[data-az="aggiungiRete"]'); await fin(B);
    esito('spiega perché serve il permesso della posizione', /posizione/.test(await B.locator('#finTesto').textContent()));
    await tocca(B, '#finSi', 900);
    esito('«Casa» tra le reti di fiducia', JSON.stringify(disp.B.conf.retiFidate) === '["Casa"]' && /Casa/.test(await B.locator('#listaCorpo').textContent()));
    await tocca(B, '#listaCorpo [data-az="togliRete"]', 800);
    esito('tolta', JSON.stringify(disp.B.conf.retiFidate) === '[]');
    await tocca(B, '[data-az="chiudiLista"]');
    esito('spazio libero mostrato', /Spazio libero sul telefono: 11,18 GB/.test(await B.locator('#impSpazio').textContent()));
    await tocca(B, '[data-az="chiudiImpostazioni"]');
  });

  await passo('Quando sincronizzare e velocità massima', async () => {
    esito('di serie: sempre, senza limite', disp.B.conf.quando === 'sempre' && disp.B.conf.limiteKBs === 0 && disp.B.conf.fasce === '');
    await tocca(B, '#impBtn'); await sezione(B, 'condizioni');
    esito('tre scelte e quattro velocità', await B.locator('#sceltaQuando [data-az="scegliQuando"]').count() === 3 && await B.locator('#sceltaLimite [data-az="scegliLimite"]').count() === 4);
    esito('«Sempre» e «Nessun limite» segnati', (await B.locator('[data-quando="sempre"]').getAttribute('aria-checked')) === 'true' && (await B.locator('[data-limite="0"]').getAttribute('aria-checked')) === 'true');
    await tocca(B, '[data-quando="ora"]', 800);
    esito('«Ogni ora» mandato a PairWood', disp.B.conf.quando === 'ora' && disp.B.conf.fasce === '' && /una volta all'ora/.test(await B.locator('#riass_condizioni').textContent()));
    await tocca(B, '[data-quando="fasce"]'); await fin(B);
    esito('chiede giorni e orario', /Giorni e orario/.test(await B.locator('#finTitolo').textContent()));
    await B.locator('#finCampo').fill('boh'); await tocca(B, '#finSi', 400);
    esito('orario incomprensibile: lo dice e richiede', /Non ho capito/.test(await B.locator('#finErrore').textContent()) && disp.B.conf.quando === 'ora');
    await B.locator('#finCampo').fill('lun-ven 18:00-23:00'); await tocca(B, '#finSi', 900);
    esito('fasce mandate a PairWood (giorni; minuti)', disp.B.conf.quando === 'fasce' && disp.B.conf.fasce === '1,2,3,4,5;1080;1380', JSON.stringify([disp.B.conf.quando, disp.B.conf.fasce]));
    esito('mostra «lun–ven 18:00–23:00»', /lun–ven 18:00–23:00/.test(await B.locator('#impFasceSotto').textContent()) && /lun–ven 18:00–23:00/.test(await B.locator('#riass_condizioni').textContent()));
    await tocca(B, '#impFasce'); await fin(B);
    await B.locator('#finCampo').fill('sab-dom 8-12'); await tocca(B, '#finSi', 900);
    esito('cambiati giorni e orario', disp.B.conf.fasce === '6,7;480;720', disp.B.conf.fasce);
    await tocca(B, '[data-quando="sempre"]', 800);
    esito('«Sempre»: fasce azzerate', disp.B.conf.quando === 'sempre' && disp.B.conf.fasce === '' && (await B.locator('#impFasce').isHidden()));
    await tocca(B, '[data-limite="2048"]', 800);
    esito('2 MB al secondo mandato a PairWood', disp.B.conf.limiteKBs === 2048 && /max 2 MB\/s/.test(await B.locator('#riass_condizioni').textContent()));
    await tocca(B, '[data-limite="0"]', 800);
    esito('limite tolto', disp.B.conf.limiteKBs === 0);
    await tocca(B, '[data-az="chiudiImpostazioni"]');
  });

  await passo('Due versioni dello stesso file: scegliere dall\'app', async () => {
    const id = disp.B.conf.cartelle.find(c => typeof c === 'object').id;
    const copia = 'fatture/conto.conflitto-ABCD1234-20261114-101500.txt';
    disp.B.extra = { [id]: { conflitti: [copia] } };
    disp.B.conflittiLista = [{ cartella: id, copia, originale: 'fatture/conto.txt', dimensioneCopia: 2048, modificatoCopia: Date.now() - 3600e3, dimensioneOriginale: 1024, modificatoOriginale: Date.now() - 7200e3, dispositivo: 'Tablet bottega' }];
    await evento(disp.B, { tipo: 'ricevuti', dispositivo: 'A', quanti: 1 }); await B.waitForTimeout(700);
    esito('un conflitto nuovo: avviso ben visibile (uno solo)', /Conflitto: un file è stato cambiato su due dispositivi insieme/.test(await B.locator('#avvisoTesto').textContent()) && await B.locator('#avviso[data-tipo="errore"]').count() === 1);
    esito('e un riquadro in Home con «Scegli quale tenere»', /Scegli quale tenere/.test(await B.locator('#protezioni').textContent()) && /conflitto|cambiato su due dispositivi/.test(await B.locator('#protezioni').textContent()));
    await tocca(B, '[data-az="apriCartella"]', 500);
    const t = await B.locator('#listaCorpo').textContent();
    esito('mostra il file, l\'originale e l\'altra versione col nome del dispositivo', /conto\.txt/.test(t) && /Originale/.test(t) && /Altra versione/.test(t) && /Tablet bottega/.test(t) && /1 KB|1,0 KB|1 kB/i.test(t), t.slice(0, 200));
    esito('tre scelte', await B.locator('#listaCorpo [data-az="risolviConflitto"]').count() === 3);
    await tocca(B, '#listaCorpo [data-arg$="|copia"]', 900);
    esito('dopo la scelta una finestra dice cosa è successo (non solo un avviso)', /Fatto/.test(await B.locator('#finTitolo').textContent()) && /Tenuta l'altra versione/.test(await B.locator('#finTesto').textContent()) && /altri dispositivi/.test(await B.locator('#finTesto').textContent()));
    await tocca(B, '#finSi', 700);
    const r = (disp.B.risolti || []).at(-1);
    esito('«Tieni l\'altra» mandato a PairWood', r && r.scelta === 'copia' && r.copia === copia && r.cartella === id, JSON.stringify(r));
    esito('il conflitto sparisce dall\'elenco', !/Altra versione/.test(await B.locator('#listaCorpo').textContent()) && /Tenuta l'altra versione/.test(await B.locator('#avvisoTesto').textContent()));
    await tocca(B, '[data-az="chiudiLista"]');
    disp.B.extra = {};
  });

  await passo('Mandare un file a un solo dispositivo', async () => {
    esito('con un dispositivo abbinato c\'è «Invia un file»', await B.locator('[data-az="inviaUnFile"]').count() === 1);
    await tocca(B, '[data-az="inviaUnFile"]', 400);
    esito('annullo la scelta del file: non parte niente', !(disp.B.inviati || []).length);
    disp.B.fileScelti = ['content://documenti/1', 'content://documenti/2'];
    await tocca(B, '[data-az="inviaUnFile"]', 1500);
    const iv = (disp.B.inviati || []).at(-1);
    esito('mandati a un solo dispositivo (un abbinato: senza elenco)', iv && iv.uris.length === 2 && typeof iv.id === 'string' && iv.id.length > 0, JSON.stringify(iv));
    esito('lo dice', /2 file arrivati/.test(await B.locator('#avvisoTesto').textContent()));
    // un file arriva da un altro dispositivo
    disp.B.ricevutiLista = [{ nome: 'relazione.pdf', dimensione: 700000, quando: Date.now() - 60e3 }];
    await evento(disp.B, { tipo: 'fileRicevuto', nome: 'relazione.pdf', dimensione: 700000, da: 'Tablet bottega' }); await B.waitForTimeout(800);
    esito('avviso «ricevuto da»', /«relazione\.pdf» ricevuto da «Tablet bottega»/.test(await B.locator('#avvisoTesto').textContent()));
    esito('riga «1 file ricevuto» in Home', /1 file ricevuto/.test(await B.locator('#invioFile').textContent()));
    await tocca(B, '[data-az="apriRicevuti"]', 400);
    esito('elenco con nome e misura', /relazione\.pdf/.test(await B.locator('#listaCorpo').textContent()) && /Salva/.test(await B.locator('#listaCorpo').textContent()));
    esito('un tocco: «Salva in Download» e, più discreto, «in un\'altra cartella»', await B.locator('#listaCorpo [data-az="salvaRicevutoDownload"]').count() === 1 && await B.locator('#listaCorpo [data-az="salvaRicevuto"]').count() === 1);
    await tocca(B, '#listaCorpo [data-az="salvaRicevutoDownload"]', 900);
    esito('«Salva in Download» salva senza selettore e toglie il file dall\'elenco', (disp.B.salvatiDownload || []).includes('relazione.pdf') && !(disp.B.salvati || []).includes('relazione.pdf') && await B.locator('#modalLista.hidden').count() === 1 && /Download\/BothWise/.test(await B.locator('#avvisoTesto').textContent()));
    esito('non resta la riga in Home', !(await B.locator('#invioFile').textContent()).includes('ricevut'));
    // l'altra strada: scegliere la cartella
    disp.B.ricevutiLista = [{ nome: 'foto.jpg', dimensione: 2000, quando: Date.now() }]; await evento(disp.B, { tipo: 'ricevuti', dispositivo: 'A', quanti: 1 }); await B.waitForTimeout(700);
    await tocca(B, '[data-az="apriRicevuti"]', 400); await tocca(B, '#listaCorpo [data-az="salvaRicevuto"]', 900);
    esito('«Salva in un\'altra cartella» chiede ad Android e poi toglie il file', (disp.B.salvati || []).includes('foto.jpg') && await B.locator('#modalLista.hidden').count() === 1);
    // più file: un tasto per salvarli tutti
    disp.B.ricevutiLista = [{ nome: 'a.pdf', dimensione: 10, quando: Date.now() }, { nome: 'b.pdf', dimensione: 20, quando: Date.now() }, { nome: 'c.pdf', dimensione: 30, quando: Date.now() }]; await evento(disp.B, { tipo: 'ricevuti', dispositivo: 'A', quanti: 1 }); await B.waitForTimeout(700);
    await tocca(B, '[data-az="apriRicevuti"]', 400);
    esito('con più file c\'è «Salva tutti in Download (3)»', /Salva tutti in Download \(3\)/.test(await B.locator('#listaCorpo').textContent()));
    await tocca(B, '#listaCorpo [data-az="salvaTuttiRicevuti"]', 1200);
    esito('li salva tutti e dice quanti', ['a.pdf', 'b.pdf', 'c.pdf'].every(n => (disp.B.salvatiDownload || []).includes(n)) && /3 file salvati/.test(await B.locator('#avvisoTesto').textContent()) && await B.locator('#modalLista.hidden').count() === 1);
  });

  await passo('Gestire i file della cartella', async () => {
    await tocca(B, '[data-az="apriCartella"]', 500);
    esito('il dettaglio ha «Sfoglia i file»', await B.locator('#listaCorpo, #listaPiede').locator('[data-az="apriSfoglia"]').count() >= 1);
    await tocca(B, '[data-az="apriSfoglia"]', 700);
    let t = await B.locator('#listaCorpo').textContent();
    esito('mostra prima le cartelle poi i file, con misure', /foto/.test(t) && /note\.txt/.test(t) && t.indexOf('foto') < t.indexOf('note.txt') && /2 file/.test(t), t.slice(0, 120));
    await tocca(B, '#listaCorpo [data-az="sfogliaApri"]', 600);
    t = await B.locator('#listaCorpo').textContent();
    esito('entra nella cartella: briciole e contenuto', /Tutta la cartella/.test(t) && /lavori/.test(t) && /a\.jpg/.test(t));
    // il gesto Indietro sale di un livello (non chiude tutto)
    esito('Indietro dentro una cartella: torna alla cartella sopra', await B.evaluate(() => window.__indietro()) === true && (await B.waitForTimeout(500), /note\.txt/.test(await B.locator('#listaCorpo').textContent())) && !/Tutta la cartella › /.test(await B.locator('#listaCorpo').textContent()) && await B.locator('#modalLista.hidden').count() === 0);
    await tocca(B, '#listaCorpo [data-az="sfogliaApri"]', 600);
    esito('senza selezione: «Aggiungi file qui» e «Nuova sottocartella»', await B.locator('#listaPiede [data-az="sfogliaAggiungi"]').count() === 1 && await B.locator('#listaPiede [data-az="sfogliaNuova"]').count() === 1);
    // azioni su un file (a.jpg è il secondo: prima la cartella «lavori»)
    await tocca(B, '#listaCorpo [data-az="sfogliaScegli"][data-arg="1"]', 400);
    esito('scelto un file: Apri, Condividi, Rinomina, Sposta, Elimina', await B.locator('#listaPiede [data-az="sfogliaAzione"]').count() === 5);
    await tocca(B, '#listaPiede [data-arg="apri"]', 400);
    esito('«Apri» chiede ad Android di aprirlo', (disp.B.aperti || []).some(x => x.m === 'apriFile' && x.percorso === 'foto/a.jpg'));
    await tocca(B, '#listaPiede [data-arg="condividi"]', 400);
    esito('«Condividi» apre il menu di Android', (disp.B.aperti || []).some(x => x.m === 'condividiFile' && x.percorso === 'foto/a.jpg'));
    // rinomina
    await tocca(B, '#listaPiede [data-arg="rinomina"]'); await fin(B);
    await B.locator('#finCampo').fill('copertina.jpg'); await tocca(B, '#finSi', 800);
    esito('rinomina mandata a PairWood e mostrata', (disp.B.gestione || []).some(x => x.op === 'rinomina' && x.nome === 'copertina.jpg') && /copertina\.jpg/.test(await B.locator('#listaCorpo').textContent()));
    // sposta: sceglie la sottocartella «lavori»
    await tocca(B, '#listaCorpo [data-az="sfogliaScegli"][data-arg="1"]', 300); await tocca(B, '#listaPiede [data-arg="sposta"]', 600);
    esito('«Sposta» torna alla radice e chiede la destinazione', /Sposta «copertina\.jpg»/.test(await B.locator('#listaPiede').textContent()) && await B.locator('#listaPiede [data-az="sfogliaSpostaQui"]').count() === 1);
    await tocca(B, '#listaCorpo [data-az="sfogliaApri"]', 500); await tocca(B, '#listaCorpo [data-az="sfogliaApri"]', 500);
    await tocca(B, '#listaPiede [data-az="sfogliaSpostaQui"]', 800);
    const sp = (disp.B.gestione || []).find(x => x.op === 'sposta');
    esito('«Sposta qui» mandato con la destinazione giusta', sp && sp.percorso === 'foto/copertina.jpg' && sp.destinazione === 'foto/lavori', JSON.stringify(sp));
    // elimina (annullando e poi confermando)
    await tocca(B, '#listaCorpo [data-az="sfogliaVai"][data-arg="0"]', 500);
    await tocca(B, '#listaCorpo [data-az="sfogliaScegli"][data-arg="1"]', 300); await tocca(B, '#listaPiede [data-arg="elimina"]'); await fin(B);
    esito('elimina spiega che va nel cestino anche sugli altri', /cestino/.test(await B.locator('#finTesto').textContent()) && /30 giorni/.test(await B.locator('#finTesto').textContent()));
    await tocca(B, '#finNo', 500);
    esito('annullando non si elimina niente', !(disp.B.gestione || []).some(x => x.op === 'elimina'));
    await tocca(B, '#listaPiede [data-arg="elimina"]'); await fin(B); await tocca(B, '#finSi', 800);
    const el = (disp.B.gestione || []).find(x => x.op === 'elimina');
    esito('confermando va a PairWood e sparisce dall\'elenco', el && el.percorso === 'note.txt' && !/note\.txt/.test(await B.locator('#listaCorpo').textContent()), JSON.stringify(el));
    // più file insieme
    disp.B.albero[disp.B.conf.cartelle.find(c => typeof c === 'object').id] = [{ percorso: 'x1.txt', dimensione: 10, modificato: Date.now() }, { percorso: 'x2.txt', dimensione: 10, modificato: Date.now() }, { percorso: 'x3.txt', dimensione: 10, modificato: Date.now() }, { percorso: 'dest/y.txt', dimensione: 10, modificato: Date.now() }];
    await tocca(B, '#listaCorpo [data-az="sfogliaVai"][data-arg="0"]', 500);
    await tocca(B, '#listaPiede [data-az="sfogliaMulti"]', 400);
    esito('«Seleziona più file»: caselle sulle righe e nessun ingranaggio', await B.locator('#listaCorpo [data-az="sfogliaSpunta"]').count() >= 3 && await B.locator('#listaCorpo [data-az="sfogliaScegli"]').count() === 0 && await B.locator('#listaPiede [data-az="sfogliaAzioneMulti"][disabled]').count() === 2);
    await tocca(B, '#listaCorpo [data-az="sfogliaApri"]:has-text("x1.txt")', 300); await tocca(B, '#listaCorpo [data-az="sfogliaSpunta"][data-arg="2"]', 300);
    esito('due selezionati: lo dice e Sposta/Elimina si accendono', /2 elementi selezionati/.test(await B.locator('#listaPiede').textContent()) && await B.locator('#listaPiede [data-az="sfogliaAzioneMulti"][disabled]').count() === 0);
    await tocca(B, '#listaPiede [data-arg="elimina"]'); await fin(B);
    esito('elimina chiede UNA conferma per tutti', /Eliminare 2 elementi/.test(await B.locator('#finTitolo').textContent()));
    await tocca(B, '#finSi', 900);
    const eliminati = (disp.B.gestione || []).filter(x => x.op === 'elimina').map(x => x.percorso);
    esito('vanno a PairWood tutti e due, uno per uno', eliminati.length >= 2 && eliminati.includes('x1.txt') && !/x1\.txt/.test(await B.locator('#listaCorpo').textContent()), JSON.stringify(eliminati));
    esito('finita l\'azione si esce dalla selezione', await B.locator('#listaCorpo [data-az="sfogliaSpunta"]').count() === 0);
    await tocca(B, '#listaPiede [data-az="sfogliaMulti"]', 300); await tocca(B, '#listaPiede [data-az="sfogliaTutti"]', 300);
    esito('«Tutti» seleziona tutto', /elementi selezionati/.test(await B.locator('#listaPiede').textContent()));
    await tocca(B, '#listaPiede [data-az="sfogliaFine"]', 300);
    esito('«Fine» torna alla vista normale', await B.locator('#listaPiede [data-az="sfogliaMulti"]').count() === 1);
    // aggiungere file in una nuova sottocartella
    disp.B.fileScelti = ['content://documenti/9'];
    await tocca(B, '#listaPiede [data-az="sfogliaNuova"]'); await fin(B);
    await B.locator('#finCampo').fill('contratti'); await tocca(B, '#finSi', 1500);
    const im = (disp.B.importati || []).at(-1);
    esito('nuova sottocartella: i file sono copiati là dentro', im && im.sottocartella === 'contratti' && im.uris.length === 1, JSON.stringify(im));
    // un nome già usato: l'app lo dice e chiede cosa fare (prima aggiungeva un numero senza avvisare)
    disp.B.presentiImporta = ['foto.jpg']; disp.B.fileScelti = ['content://documenti/10']; const n0 = (disp.B.importati || []).length;
    await tocca(B, '#listaPiede [data-az="sfogliaAggiungi"]'); await fin(B);
    esito('nome già usato: chiede cosa fare e dice quale', /Il nome c'è già/.test(await B.locator('#finTitolo').textContent()) && /foto\.jpg/.test(await B.locator('#finEvidenza').textContent()) && /Tieni tutti e due/.test(await B.locator('#finSi').textContent()) && /Sostituisci/.test(await B.locator('#finAlt').textContent()));
    await tocca(B, '#finNo', 500);
    esito('«Annulla»: non si copia niente', (disp.B.importati || []).length === n0);
    await tocca(B, '#listaPiede [data-az="sfogliaAggiungi"]'); await fin(B); await tocca(B, '#finAlt', 1500);
    esito('«Sostituisci»: la copia parte con «sostituisci»', (disp.B.importati || []).at(-1).esistenti === 'sostituisci');
    disp.B.rinominatiImporta = [{ nome: 'foto.jpg', come: 'foto (2).jpg' }];
    await tocca(B, '#listaPiede [data-az="sfogliaAggiungi"]'); await fin(B); await tocca(B, '#finSi', 1500);
    esito('«Tieni tutti e due»: parte con «numera» e l\'avviso dice il nuovo nome', (disp.B.importati || []).at(-1).esistenti === 'numera' && /c'era già: aggiunto come «foto \(2\)\.jpg»/.test(await B.locator('#avvisoTesto').textContent()));
    disp.B.presentiImporta = []; disp.B.rinominatiImporta = [];
    await tocca(B, '[data-az="chiudiLista"]', 300);
    disp.B.fileScelti = null;
  });

  await passo('Ricevi file (come AirDrop)', async () => {
    esito('«Ricevi file» è acceso di default (con dispositivi abbinati)', (await B.locator('#homeRicevi').getAttribute('aria-checked')) === 'true' && disp.B.ricezione.attiva);
    await tocca(B, '#homeRicevi', 700);
    esito('spento a mano: resta spento', (await B.locator('#homeRicevi').getAttribute('aria-checked')) === 'false' && !disp.B.ricezione.attiva && /Spento/.test(await B.locator('#homeRicevi').textContent()));
    await evento(disp.B, { tipo: 'ricevuti', dispositivo: 'A', quanti: 0 }); await B.waitForTimeout(700);
    esito('e non si riaccende da solo', !disp.B.ricezione.attiva);
    await tocca(B, '#homeRicevi', 700);
    esito('riacceso: lo dice e fino a che ora', (await B.locator('#homeRicevi').getAttribute('aria-checked')) === 'true' && /Acceso fino alle \d\d:\d\d/.test(await B.locator('#homeRicevi').textContent()) && disp.B.ricezione.attiva);
    esito('avviso chiaro', /un'ora/.test(await B.locator('#avvisoTesto').textContent()));
    await tocca(B, '#homeRicevi', 700);
    esito('spento di nuovo', (await B.locator('#homeRicevi').getAttribute('aria-checked')) === 'false' && !disp.B.ricezione.attiva);
    await tocca(B, '[data-az="aggiungiTile"]', 700);
    esito('«Metti nella barra rapida» chiede ad Android', disp.B.tile === 1 && /barra rapida/.test(await B.locator('#avvisoTesto').textContent()));
    // tasto «Invia e ricevi» della barra rapida: l'app si apre sul pannello con ricezione accesa e i dispositivi a cui mandare
    disp.B.daTile = true;
    await B.evaluate(() => (window.__inviaRicevi || []).forEach(f => f()));
    await B.waitForTimeout(900);
    esito('dal tasto rapido si apre «Invia e ricevi» con la ricezione accesa', (await B.locator('#modalLista').isVisible()) && /Invia e ricevi/.test(await B.locator('#modalLista').textContent()) && disp.B.ricezione.attiva && (await B.locator('#irRicevi').getAttribute('aria-checked')) === 'true');
    esito('nel pannello c\'è chi può ricevere un file', (await B.locator('#modalLista [data-az="inviaA"]').count()) >= 1);
    await tocca(B, '#irRicevi', 700);
    esito('dal pannello si spegne la ricezione', !disp.B.ricezione.attiva && (await B.locator('#irRicevi').getAttribute('aria-checked')) === 'false');
    await B.evaluate(() => (window.__indietro && window.__indietro()));
    await B.waitForTimeout(600);
  });

  await passo('Impostazioni, animazioni e vibrazione come DoctorWood', async () => {
    await tocca(B, '#impBtn');
    const ordine = await B.evaluate(() => [...document.querySelectorAll('#catImpostazioni .cat-imp')].map(e => e.dataset.cat).join(','));
    esito('stesso schema di DoctorCar: Aspetto e Vibrazione in alto, poi Sicurezza e dati e in fondo Aggiornamenti', ordine.startsWith('aspetto,vibrazione,') && ordine.endsWith(',dati,aggiornamenti'), ordine);
    esito('tutte chiuse all\'apertura', await B.locator('#catImpostazioni .cat-testa[aria-expanded="true"]').count() === 0);
    esito('in fondo: Segnala, Informazioni e licenze, Fatto', await B.locator('[data-az="apriSegnalazione"]').count() === 1 && await B.locator('[data-az="apriInfo"]').count() === 1 && /Fatto/.test(await B.locator('#modalImpostazioni').textContent()));
    await sezione(B, 'aspetto');
    const primaAnim = await B.evaluate(() => document.documentElement.dataset.animazioni);
    await tocca(B, '#animBtn');
    esito('interruttore «Animazioni»', (await B.evaluate(() => document.documentElement.dataset.animazioni)) !== primaAnim && /senza animazioni|^/.test(await B.locator('#riass_aspetto').textContent()));
    await tocca(B, '#animBtn');
    await sezione(B, 'vibrazione');
    esito('vibrazione disponibile nell\'app', await B.locator('#vibBtn:not(.hidden)').count() === 1 && await B.locator('#vibNonDisponibile.hidden').count() === 1);
    disp.B.vibrazioni = [];
    await tocca(B, 'button[data-forza="1.7"]', 300);
    esito('«Forte»: si sente subito, con la forza scelta (dal motore del telefono)', disp.B.vibrazioni.some(v => v.forza === 1.7) && /Forte/.test(await B.locator('#vibForzaTesto').textContent()));
    await B.locator('[data-vibtipo="scelta"]').uncheck(); await B.waitForTimeout(200);
    esito('«Quando vibrare» ricordato', (await B.evaluate(() => JSON.parse(localStorage.getItem('bothwise_vibrazione_tipi') || '{}').scelta)) === false);
    await B.locator('[data-vibtipo="scelta"]').check();
    disp.B.vibrazioni = [];
    await tocca(B, '#vibBtn', 300);
    esito('vibrazione spenta: non vibra più', (await B.locator('#vibBtn').getAttribute('aria-checked')) === 'false' && await B.locator('#vibDettagli.hidden').count() === 1);
    await tocca(B, '#vibBtn', 300);
    esito('riaccesa: un tocco di conferma', disp.B.vibrazioni.length >= 1);
    // barra di stato: l'intestazione fa spazio a ora e batteria (Android disegna l'app anche lì sotto)
    const sotto = await B.evaluate(() => { document.documentElement.style.setProperty('--safe-area-inset-top', '40px'); const v = parseFloat(getComputedStyle(document.querySelector('header')).paddingTop); document.documentElement.style.removeProperty('--safe-area-inset-top'); return v; });
    esito('l\'intestazione non finisce sotto la barra di stato', sotto >= 40 + 11);
    await tocca(B, '[data-az="apriInfo"]', 400);
    esito('Informazioni e licenze', /versione \d+\.\d+\.\d+/.test(await B.locator('#infoVersione').textContent()) && /Font Awesome/.test(await B.locator('#modalInfo').textContent()) && /Privacy/.test(await B.locator('#modalInfo').textContent()));
    await tocca(B, '[data-az="chiudiInfo"]');
    await tocca(B, '#impBtn'); await tocca(B, '[data-az="apriSegnalazione"]', 300);
    await tocca(B, '[data-az="copiaSegnalazione"]', 300);
    esito('segnalazione vuota: chiede di scrivere', /Scrivi in poche parole/.test(await B.locator('#fbErrore').textContent()));
    await B.locator('#fbTesto').fill('La cartella Foto non si aggiorna');
    esito('il testo per la posta è pronto, con le informazioni tecniche', /mailto:/.test(await B.locator('#fbPosta').getAttribute('href')) && decodeURIComponent(await B.locator('#fbPosta').getAttribute('href')).match(/BothWise \d+\.\d+\.\d+/));
    await B.evaluate(() => window.__indietro());
    esito('Indietro chiude «Segnala»', await B.locator('#modalSegnala.hidden').count() === 1);
    // le finestre chiuse lasciano per un attimo la loro «sagoma» che svanisce (come DoctorWood), poi spariscono
    await B.waitForTimeout(900);
    esito('nessuna sagoma rimasta', await B.locator('.dw-sagoma').count() === 0);
  });

  await passo('Un dispositivo ci ha dimenticati: abbinamento perso', async () => {
    await evento(disp.B, { tipo: 'abbinamentoPerso', dispositivo: '<b>Tablet di bottega</b>' }); await B.waitForTimeout(700);
    const tit = await B.locator('#finTitolo').textContent(), tes = await B.locator('#finTesto').textContent();
    esito('finestra chiara: non ti riconosce più, abbinatevi di nuovo', /non ti riconosce più/.test(tit) && /abbinatevi di nuovo/.test(tes) && await B.locator('#modalFinestra b').count() === 0, tit);
    await tocca(B, '#finNo', 700);
  });

  await passo('Dimenticato da un altro dispositivo', async () => {
    await evento(disp.B, { tipo: 'dimenticato', dispositivo: '<b>Tablet perso</b>' }); await B.waitForTimeout(300);
    const t = await B.locator('#avvisoTesto').textContent();
    esito('avviso chiaro, il nome resta testo', /«<b>Tablet perso<\/b>» dimenticato anche qui/.test(t) && await B.locator('#avviso b').count() === 0, t);
    await tocca(B, '[data-az="apriDispositivo"]'); await fin(B);
    esito('«Dimentica» spiega che basta farlo su un dispositivo', /Basta farlo qui/.test(await B.locator('#finTesto').textContent()));
    await tocca(B, '#finNo');
    // dimenticato davvero: le istruzioni per un dispositivo perso o rubato
    await tocca(B, '[data-az="apriDispositivo"]'); await fin(B); await tocca(B, '#finAlt', 500); await fin(B);
    const t2 = await B.locator('#finTesto').textContent();
    esito('dopo «Dimentica»: come bloccarlo a distanza (l\'account Google solo se c\'è Drive)', /Trova il mio dispositivo/.test(t2) && disp.B.chiamate.includes('PairWood.dimentica'), t2.slice(0, 120));
    await tocca(B, '#finSi', 300);
    // per le prove che seguono il dispositivo torna abbinato
    disp.B.fidati.add('A'); disp.A.fidati.add('B');
    await B.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await B.waitForTimeout(400);
  });

  await passo('Sempre raggiungibile, tema, testo', async () => {
    await tocca(B, '#impBtn'); await sezione(B, 'dispositivo'); await tocca(B, '#impAscolto'); await fin(B);
    await B.locator('#finCampo').fill('boh'); await tocca(B, '#finSi');
    esito('orario sbagliato: errore chiaro', /Non ho capito/.test(await B.locator('#finErrore').textContent()));
    await B.locator('#finCampo').fill('lun-sab 7-19'); await tocca(B, '#finSi', 600);
    esito('ascolto continuo attivato', disp.B.ascolto === '1,2,3,4,5,6 07:00-19:00', disp.B.ascolto);
    esito('interruttore acceso', (await B.locator('#impAscolto').getAttribute('aria-checked')) === 'true');
    await sezione(B, 'aspetto'); await tocca(B, 'button[data-tema="chiaro"]');
    esito('tema chiaro', (await B.evaluate(() => document.documentElement.dataset.tema)) === 'chiaro');
    await tocca(B, 'button[data-testo="130"]');
    esito('testo molto grande chiesto ad Android', disp.B.chiamate.includes('BothWise.dimensioneTesto'));
    await tocca(B, '[data-az="chiudiImpostazioni"]');
  });

  await passo('Indietro di Android chiude le finestre', async () => {
    await tocca(A, '#impBtn');
    esito('Indietro chiude le Impostazioni', await A.evaluate(() => window.__indietro()) && await A.locator('#modalImpostazioni.hidden').count() === 1);
    esito('senza finestre aperte risponde «no» (l\'app va in secondo piano)', (await A.evaluate(() => window.__indietro())) === false);
  });

  await passo('Praticità sul telefono stretto (320 px) e sul tablet', async () => {
    for (const [nome, opz] of [['320', { viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true }], ['tablet', devices['Galaxy Tab S4']]]) {
      const ctx = await b.newContext({ locale: 'it-IT', ...opz }); await ctx.addInitScript(MOCK);
      const d = nuovo('P' + nome); disp['P' + nome] = d; d.offerte = [{ id: 'x', nome: 'Una cartella dal nome piuttosto lungo', dispositivo: 'Telefono con un nome lungo' }];
      d.conf = { nome: 'Dispositivo di prova' };
      d.daDecidere = [{ cartella: 'x', percorso: 'cartella con un nome lungo/documento con un nome davvero molto lungo senza spazi_versione_finale_2026.pdf' }];
      d.cestino = [{ cartella: 'x', posizione: '.sincronia/cestino/20261112-101500/a/b.txt', percorso: 'una sottocartella/un_file_dal_nome_lunghissimo_senza_spazi_per_vedere_se_va_a_capo.docx', dimensione: 123456789, tolto: Date.now() }];
      await ctx.addInitScript(() => { if (!localStorage.getItem('bothwise_conf')) localStorage.setItem('bothwise_conf', JSON.stringify({ nome: 'Dispositivo di prova', cartelle: [{ id: 'x', uri: 'content://x', nome: 'Una cartella dal nome piuttosto lungo per provare', modo: 'soloRicezione' }] })); });
      d.versioni = [{ cartella: 'x', posizione: '.sincronia/versioni/20261112-101500/a.txt', percorso: 'documenti/un_documento_con_un_nome_molto_lungo_e_senza_spazi_v12.docx', dimensione: 5000000, tolto: Date.now() }];
      d.ultime = [{ cartella: 'x', quando: Date.now(), percorso: 'cartella/un_file_dal_nome_lunghissimo_senza_spazi_per_vedere_se_va_a_capo.jpg', tipo: 'conflitto', dispositivo: 'Telefono con un nome lungo' }];
      await ctx.exposeFunction('__nat', (pl, m, o) => nat(d, pl, m, o));
      const p = await ctx.newPage(); await p.goto(URL); await p.waitForTimeout(800);
      await p.evaluate(() => window.__evento({ tipo: 'avanzamento', dispositivo: 'Telefono con un nome lungo', cartella: 'x', percorso: 'cartella/un_file_dal_nome_lunghissimo_senza_spazi.jpg', fileFatti: 0, fileTotali: 1200, byteFatti: 1, byteTotali: 99999999999, secondi: 3, finito: false }));
      d.googleDisponibile = true; d.drive = true;
      d.extra = { x: { blocco: { motivo: 'modifiche', quanti: 120, totali: 140 } } };
      for (const vista of ['home', 'impostazioni', 'cestino', 'da confermare', 'cartella', 'versioni', 'ultime', 'regole', 'fuori dalla Wi‑Fi', 'vibrazione', 'sincronizzazione', 'informazioni', 'segnala', 'cartelle pronte']) {
        if (vista === 'impostazioni') { await p.click('#impBtn'); await p.click('[data-arg="aspetto"]'); await p.waitForTimeout(300); }
        if (vista === 'cestino') { await p.click('[data-arg="dati"]'); await p.click('#corpo_dati [data-az="apriCestino"]'); await p.waitForTimeout(500); }
        if (vista === 'da confermare') { await p.evaluate(() => { window.__indietro(); window.__indietro(); }); await p.click('[data-az="apriAttesa"]'); await p.waitForTimeout(400); }
        if (vista === 'cartella') { await p.evaluate(() => window.__indietro()); await p.click('[data-az="apriCartella"]'); await p.waitForTimeout(400); }
        if (vista === 'versioni') { await p.click('#listaPiede [data-az="apriVersioni"]'); await p.waitForTimeout(500); }
        if (vista === 'ultime') { await p.evaluate(() => window.__indietro()); await p.click('[data-az="apriUltime"]'); await p.waitForTimeout(400); }
        if (vista === 'vibrazione') { await p.click('[data-arg="vibrazione"]'); await p.waitForTimeout(300); }
        if (vista === 'sincronizzazione') { await p.click('[data-arg="condizioni"]'); await p.waitForTimeout(300); }
        if (vista === 'informazioni') { await p.click('[data-az="apriInfo"]'); await p.waitForTimeout(400); }
        if (vista === 'segnala') { await p.evaluate(() => window.__indietro()); await p.click('#impBtn'); await p.click('[data-az="apriSegnalazione"]'); await p.waitForTimeout(400); }
        if (vista === 'cartelle pronte') { await p.evaluate(() => window.__indietro()); await p.click('[data-az="aggiungiCartella"]'); await p.waitForTimeout(400); }
        if (vista === 'fuori dalla Wi‑Fi') { await p.evaluate(() => window.__indietro()); await p.click('[data-arg="cloud"]'); await p.waitForTimeout(300); }
        if (vista === 'regole') { await p.evaluate(() => window.__indietro()); await p.click('#impBtn'); await p.click('[data-arg="sinc"]'); await p.click('[data-az="apriRegole"]'); await p.waitForTimeout(400); }
        const m = await p.evaluate(() => {
          const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !e.closest('.hidden'); };
          const tasti = [...document.querySelectorAll('button')].filter(vis);
          return {
            sborda: document.documentElement.scrollWidth - innerWidth,
            piccoli: tasti.filter(e => Math.min(e.getBoundingClientRect().width, e.getBoundingClientRect().height) < 32).map(e => e.innerText || e.getAttribute('aria-label')),
            senzaNome: tasti.filter(e => !(e.innerText || e.textContent).trim() && !e.getAttribute('aria-label')).length,
            minuscoli: [...document.querySelectorAll('body *')].filter(e => vis(e) && e.children.length === 0 && (e.innerText || '').trim() && parseFloat(getComputedStyle(e).fontSize) < 11).length,
            tagliati: [...document.querySelectorAll('button span, button')].filter(e => vis(e) && e.children.length === 0 && (e.innerText || '').trim()).filter(e => { const t = e.closest('button'), a = e.getBoundingClientRect(), c = t.getBoundingClientRect(); return t !== e && (a.left < c.left - 1 || a.right > c.right + 1); }).length,
          };
        });
        esito(`${nome} · ${vista}: niente che sborda, tasti ok, testo ≥ 11 px, niente tagliato`, m.sborda <= 1 && !m.piccoli.length && !m.senzaNome && !m.minuscoli && !m.tagliati, JSON.stringify(m));
      }
      await ctx.close();
    }
  });

  await passo('Cancella tutto', async () => {
    await tocca(A, '#impBtn'); await sezione(A, 'dati'); await tocca(A, '[data-az="cancellaTutto"]'); await fin(A);
    await A.locator('#finCampo').fill('cancela'); await tocca(A, '#finSi');
    esito('parola sbagliata: chiede CANCELLA', /Scrivi CANCELLA/.test(await A.locator('#finErrore').textContent()));
    await A.locator('#finCampo').fill('cancella'); await tocca(A, '#finSi', 1200);
    const dopo = await A.evaluate(() => JSON.parse(localStorage.getItem('bothwise_conf') || '{}'));
    esito('PairWood cancellato, l\'app riparte da zero (nessuna cartella)', disp.A.chiamate.includes('PairWood.cancellaTutto') && !(dopo.cartelle || []).length, JSON.stringify(dopo));
  });

  await passo('Apertura: il logo in dissolvenza, poi l\'impronta', async () => {
    await A.addInitScript(() => { try { if (sessionStorage.getItem('__avvio')) window.__avvioIntero = true; } catch (_) {} });
    await A.evaluate(() => sessionStorage.setItem('__avvio', '1'));
    disp.A.blocco = true; disp.A.rifiutaSblocco = false; await A.evaluate(() => localStorage.removeItem('bothwise_blocco'));
    const prima = disp.A.sblocchi || 0;
    await A.reload(); await A.waitForTimeout(250);
    const stato = () => A.evaluate(() => ({ logo: getComputedStyle(document.getElementById('bloccoApp')).display === 'flex', opacita: Number(getComputedStyle(document.querySelector('#bloccoApp .avvio-logo')).opacity),
      tasto: getComputedStyle(document.getElementById('bloccoSblocca')).visibility, sotto: getComputedStyle(document.querySelector('main')).visibility }));
    const a = await stato();
    esito('subito: solo il logo che sta comparendo, la pagina è nascosta', a.logo && a.opacita > 0 && a.opacita < 1 && a.sotto === 'hidden', JSON.stringify(a));
    esito('durante l\'apertura non c\'è niente da toccare e l\'impronta non è ancora chiesta', a.tasto === 'hidden' && (disp.A.sblocchi || 0) === prima);
    await A.mouse.click(200, 400); await A.keyboard.press('Escape'); await A.evaluate(() => window.__indietro && window.__indietro()); await A.waitForTimeout(900);
    const b = await stato();
    esito('non si salta: toccando o premendo Indietro il logo resta', b.logo && b.sotto === 'hidden' && (disp.A.sblocchi || 0) === prima, JSON.stringify(b));
    await A.waitForTimeout(800);
    esito('finita l\'apertura (circa 1,5 secondi) chiede l\'impronta', (disp.A.sblocchi || 0) === prima + 1);
    await A.waitForTimeout(900);
    esito('dopo l\'impronta la schermata sfuma e si vede la Home', !(await A.locator('#bloccoApp').isVisible()) && await A.evaluate(() => getComputedStyle(document.querySelector('main')).visibility === 'visible'));
    // senza blocco: il logo, poi direttamente la Home
    disp.A.blocco = false;
    await A.reload(); await A.waitForTimeout(1500);
    esito('senza blocco: il logo si vede lo stesso', (await stato()).logo);
    await A.waitForTimeout(2600);
    esito('poi la Home, senza impronta', !(await A.locator('#bloccoApp').isVisible()) && (disp.A.sblocchi || 0) === prima + 1);
    await A.evaluate(() => sessionStorage.removeItem('__avvio'));
  });

  await passo('Blocco con l\'impronta', async () => {
    disp.A.blocco = true; disp.A.rifiutaSblocco = true;
    await A.reload(); await A.waitForTimeout(900);
    esito('all\'apertura BothWise è coperto e chiede l\'impronta', await A.locator('#bloccoApp').isVisible() && (disp.A.sblocchi || 0) >= 1);
    esito('impronta sbagliata: resta bloccato, con un messaggio', await A.locator('#bloccoApp').isVisible() && /non riuscito/.test(await A.locator('#bloccoTesto').textContent()));
    esito('sotto il blocco non si vede niente', await A.evaluate(() => getComputedStyle(document.querySelector('main')).visibility === 'hidden'));
    disp.A.rifiutaSblocco = false;
    await tocca(A, '#bloccoSblocca', 1600);
    esito('impronta giusta: si apre', !(await A.locator('#bloccoApp').isVisible()) && await A.evaluate(() => getComputedStyle(document.querySelector('main')).visibility === 'visible'));
    const visibile = v => A.evaluate(v => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v }); document.dispatchEvent(new Event('visibilitychange')); }, v);
    const prima = disp.A.sblocchi;
    await visibile('hidden'); esito('uscendo dall\'app si copre subito', await A.locator('#bloccoApp').isVisible());
    esito('sotto il blocco la pagina è nascosta e non si può premere niente', await A.evaluate(() => getComputedStyle(document.querySelector('main')).visibility === 'hidden' && getComputedStyle(document.getElementById('impBtn')).visibility === 'hidden'));
    await visibile('visible'); await A.waitForTimeout(800);
    esito('tornando chiede di nuovo l\'impronta', disp.A.sblocchi === prima + 1 && !(await A.locator('#bloccoApp').isVisible()));
    // uscita chiesta dall'app (scelta della cartella): niente blocco
    await A.evaluate(() => window.Capacitor.nativePromise('PairWood', 'scegliCartellaUtente', {}).catch(() => {})); await A.waitForTimeout(100);
    const prima2 = disp.A.sblocchi;
    await visibile('hidden'); await visibile('visible'); await A.waitForTimeout(500);
    esito('scegliendo una cartella non si blocca', disp.A.sblocchi === prima2 && !(await A.locator('#bloccoApp').isVisible()));
    await tocca(A, '#impBtn'); await tocca(A, '[data-arg="dati"]');
    esito('interruttore «Blocca con l\'impronta» acceso', (await A.locator('#impBlocco').getAttribute('aria-checked')) === 'true');
    await tocca(A, '#impBlocco'); await fin(A); await tocca(A, '#finSi', 1600);
    esito('togliere il blocco chiede l\'impronta e poi lo spegne', (await A.locator('#impBlocco').getAttribute('aria-checked')) === 'false');
    await visibile('hidden'); esito('spento: uscendo non si copre', !(await A.locator('#bloccoApp').isVisible())); await visibile('visible');
    await tocca(A, '#impBlocco', 400);
    esito('riacceso', (await A.locator('#impBlocco').getAttribute('aria-checked')) === 'true');
    // tocco sullo sfondo fuori dalle Impostazioni: si chiudono
    await A.mouse.click(5, 5); await A.waitForTimeout(500);
    esito('Impostazioni chiuse toccando fuori', await A.locator('#modalImpostazioni.hidden').count() === 1);
    disp.A.blocco = false; await A.evaluate(() => localStorage.setItem('bothwise_blocco', 'false'));
  });

  await passo('Tastiera, vibrazione, animazioni riattivate, file grandi in attesa', async () => {
    // tastiera che copre una finestra: la finestra si accorcia (padding) e scorre
    await tocca(A, '#impBtn');
    await A.evaluate(() => window.__tastiera(300)); await A.waitForTimeout(250);
    const t = await A.evaluate(() => ({ classe: document.documentElement.classList.contains('con-tastiera'), v: getComputedStyle(document.documentElement).getPropertyValue('--tastiera').trim(),
      pad: getComputedStyle(document.getElementById('modalImpostazioni')).paddingBottom, sc: getComputedStyle(document.querySelector('#modalImpostazioni > div')).overflowY }));
    esito('tastiera aperta: la finestra si adatta allo spazio sopra la tastiera e scorre (senza spazio doppio)', t.classe && t.sc === 'auto' && /^\d+px$/.test(t.v), JSON.stringify(t));
    await A.evaluate(() => window.__tastiera(0)); await A.waitForTimeout(250);
    esito('tastiera chiusa: tutto torna com\'era', await A.evaluate(() => !document.documentElement.classList.contains('con-tastiera')));
    // vibrazione: ogni tipo di tocco manda un impulso abbastanza lungo da sentirsi
    disp.A.vibrazioni = [];
    await A.evaluate(() => { localStorage.setItem('bothwise_vibrazione', 'si'); localStorage.removeItem('bothwise_vibrazione_tipi'); });
    await tocca(A, '.cat-testa >> nth=0', 400); await tocca(A, '.cat-testa >> nth=1', 400);
    const v = disp.A.vibrazioni.map(x => x.tempi);
    esito('ogni sezione toccata vibra, con impulsi di almeno 20 ms', v.length >= 2 && v.every(x => x[0] >= 20), JSON.stringify(v));
    // animazioni spente e riaccese: ciò che è già aperto non rifà l'entrata
    await A.evaluate(() => document.querySelector('[data-az="cambiaAnimazioni"]').click()); await A.waitForTimeout(100);
    await A.evaluate(() => document.querySelector('[data-az="cambiaAnimazioni"]').click()); await A.waitForTimeout(50);
    const anim = await A.evaluate(() => document.getAnimations().filter(a => a.effect && a.effect.getComputedTiming().iterations !== Infinity && a.playState === 'running').length);
    esito('riattivando le animazioni la finestra aperta non si ricarica', anim === 0, String(anim));
    await tocca(A, '[data-az="chiudiImpostazioni"]');
    // notifiche: si chiudono scorrendole con il dito
    await evento(disp.A, { tipo: 'presentato', dispositivo: 'Tablet', da: 'Telefono' }); await A.waitForTimeout(900);
    esito('un dispositivo presentato da un altro: avviso chiaro', /Tablet.*Telefono/.test(await A.locator('#avvisoTesto').textContent()));
    const bb = await A.locator('#avviso').boundingBox();
    await A.mouse.move(bb.x + 40, bb.y + bb.height / 2); await A.mouse.down(); await A.mouse.move(bb.x + 140, bb.y + bb.height / 2, { steps: 6 }); await A.mouse.move(bb.x + 300, bb.y + bb.height / 2, { steps: 6 }); await A.mouse.up();
    await A.waitForTimeout(700);
    esito('scorrendo la notifica di lato si chiude', await A.locator('#avviso.hidden').count() === 1);
    // chi invia vede la barra; «Annulla il trasferimento» ferma tutto (in arrivo e in partenza)
    await evento(disp.A, { tipo: 'avanzamento', dispositivo: 'Tablet', cartella: Object.keys(disp.A.cartelleStato || {})[0] || 'x', percorso: 'video/film.mp4', fileFatti: 0, fileTotali: 1, byteFatti: 50e6, byteTotali: 200e6, secondi: 10, finito: false, invio: true }); await A.waitForTimeout(500);
    esito('chi invia vede «Invio a …» con la barra e il tasto per annullare', /Invio «film\.mp4» a «Tablet»/.test(await A.locator('#avanzTesto').textContent()) && await A.locator('#avanzAnnulla').isVisible());
    await tocca(A, '#avanzAnnulla'); await fin(A); await tocca(A, '#finSi', 600);
    esito('annullando: i trasferimenti si fermano e la barra sparisce', disp.A.chiamate.includes('PairWood.annullaTrasferimenti') && await A.locator('#avanz.hidden').count() === 1);
    // file grandi in attesa: un riquadro in Home lo spiega
    const rim = a => { disp.A.rimandate = a; };
    rim(3); await A.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await A.waitForTimeout(600);
    esito('file grandi in attesa: la Home lo dice e spiega cosa fare', /3 file aspettano/.test(await A.locator('#protezioni').textContent()) && /in carica/.test(await A.locator('#protezioni').textContent()));
    rim(0); await A.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await A.waitForTimeout(600);
    esito('niente file in attesa: nessun riquadro', !/aspett/.test(await A.locator('#protezioni').textContent()));
  });

  await passo('Nessuna rete dalla pagina', async () => {
    const r = await A.evaluate(() => fetch('https://example.com').then(() => 'aperta', () => 'bloccata'));
    esito('fetch bloccato dalla regola di sicurezza', r === 'bloccata');
    errori.splice(0, errori.length, ...errori.filter(e => !/example\.com|connect-src/.test(e)));
  });

  esito('nessun errore in pagina', errori.length === 0, errori.slice(0, 3).join(' | '));
  if (process.env.NONTRAD) { const m = new Set(); for (const d of Object.values(disp)) if (d.pagina) for (const t of await d.pagina.evaluate(() => [...window.__nonTradotti]).catch(() => [])) m.add(t); require('fs').writeFileSync(process.env.NONTRAD, JSON.stringify([...m].sort(), null, 1)); console.log('testi non tradotti: ' + m.size); }
  if (process.env.HARVEST) { const tutti = new Set(); for (const d of Object.values(disp)) if (d.pagina) for (const t of await d.pagina.evaluate(() => [...window.__testi]).catch(() => [])) tutti.add(t); require('fs').writeFileSync(process.env.HARVEST, JSON.stringify([...tutti].sort(), null, 1)); console.log('testi raccolti: ' + tutti.size); }
  await b.close();
  console.log(`\nBothWise: ${ok} riusciti, ${ko} falliti`);
  process.exit(ko ? 1 : 0);
})();
