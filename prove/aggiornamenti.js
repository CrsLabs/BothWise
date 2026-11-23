// Aggiornamenti da GitHub (app simulata): voce nelle Impostazioni, «Controlla adesso», «Aggiorna», domanda della settimana,
// «Più tardi», controllo spento, in inglese. Uso: node prove/aggiornamenti.js   (server 8767 sulla cartella www)
const { chromium } = require('playwright');
const URL = process.argv[2] || 'http://127.0.0.1:8767/index.html';
let ok = 0, ko = 0;
const t = (n, c, info = '') => { (c ? ok++ : ko++); console.log((c ? '  ✓ ' : '  ✗ ') + n + (info && !c ? ' — ' + info : '')); };
const MOCK = `(() => { window.Capacitor = { isNativePlatform: () => true, addListener: () => Promise.resolve({ remove() {} }),
  nativePromise: (pl, m, o) => window.__nat(pl, m, o || {}).then(r => r && r.errore ? Promise.reject(new Error(r.errore)) : r.v) }; })();`;
function nuovoNat(nuova) {
  const chiamate = [];
  const nat = async (pl, m) => {
    chiamate.push(pl + '.' + m);
    if (pl === 'BothWise') {
      if (m === 'controllaAggiornamento') return { v: nuova ? { installata: 34, nuova: true, versione: '0.9.1', novita: 'Correzioni.', dimensione: 9437184 } : { installata: 34, nuova: false } };
      if (m === 'scaricaAggiornamento') return { v: { permesso: true, avviata: true } };
      return { v: m === 'puoSbloccare' ? { ok: true, impronta: true } : {} };
    }
    if (m === 'avvia' || m === 'stato') return { v: { avviato: true, nome: 'Telefono', id: 'M1', permessoRete: 'ok', dispositivi: [] } };
    if (m === 'statoCartelle') return { v: { cartelle: [] } };
    if (m === 'statoCasella') return { v: { disponibile: false, servizi: [] } };
    return { v: {} };
  };
  return { nat, chiamate };
}
async function apri(b, extra, nuova, webPura) {
  const ctx = await b.newContext({ viewport: { width: 412, height: 860 }, locale: 'it-IT' });
  const n = nuovoNat(nuova);
  if (!webPura) { await ctx.addInitScript(MOCK); await ctx.exposeFunction('__nat', n.nat); }
  await ctx.addInitScript(e => { if (sessionStorage.getItem('__f')) return; sessionStorage.setItem('__f', '1');
    const base = { bothwise_animazioni: '"no"', bothwise_blocco: '"no"', bothwise_conf: JSON.stringify({ nome: 'Telefono', cartelle: [] }) };
    for (const k in Object.assign(base, e)) localStorage.setItem(k, base[k]); }, extra);
  const p = await ctx.newPage(); const err = []; p.on('pageerror', e => err.push(e.message));
  await p.goto(URL); await p.waitForTimeout(1500); return { p, ctx, err, chiamate: n.chiamate };
}
const finestraTesto = p => p.evaluate(() => { const f = document.getElementById('modalFinestra'); return f && !f.classList.contains('hidden') ? f.innerText : ''; });
(async () => {
  const b = await chromium.launch();
  const recente = JSON.stringify({ ultimo: Date.now() });
  console.log('▶ Pagina senza app');
  { const { p, ctx, err } = await apri(b, {}, false, true);
    await p.evaluate(() => document.getElementById('impBtn').click()); await p.waitForTimeout(500);
    t('senza l\'app Android la voce Aggiornamenti non c\'è', await p.evaluate(() => document.getElementById('catAggiornamenti').classList.contains('hidden')));
    t('nessun errore', !err.length, err.join(' | ')); await ctx.close(); }

  console.log('▶ Controllo a mano');
  { const { p, ctx, err, chiamate } = await apri(b, { bothwise_aggiornamenti: recente }, true);
    await p.click('#impBtn'); await p.waitForTimeout(500); await p.click('[data-arg="aggiornamenti"]'); await p.waitForTimeout(500);
    t('nelle Impostazioni c\'è «Aggiornamenti»', await p.evaluate(() => !!document.getElementById('aggControlla').offsetParent));
    t('il controllo settimanale è acceso di serie', (await p.getAttribute('#impAggiornamenti', 'aria-checked')) === 'true');
    await p.click('#aggControlla'); await p.waitForTimeout(500);
    const st = await p.locator('#aggStato').innerText();
    t('«Controlla adesso» trova la versione nuova e la descrive', /BothWise 0\.9\.1/.test(st) && /9,0 MB/.test(st) && /Correzioni/.test(st), st);
    t('compare «Aggiorna»', await p.evaluate(() => !!document.getElementById('aggInstalla').offsetParent));
    await p.click('#aggInstalla'); await p.waitForTimeout(600);
    t('«Aggiorna» scarica e apre l\'installazione', chiamate.includes('BothWise.scaricaAggiornamento'));
    t('la finestra di attesa si chiude', !(await finestraTesto(p)));
    await p.click('#impAggiornamenti'); await p.waitForTimeout(200);
    t('l\'interruttore spegne il controllo settimanale', await p.evaluate(() => JSON.parse(localStorage.getItem('bothwise_aggiornamenti')).attivo === false));
    t('nessun errore', !err.length, err.join(' | ')); await ctx.close(); }

  console.log('▶ Domanda della settimana');
  { const { p, ctx, err, chiamate } = await apri(b, {}, true);
    await p.waitForTimeout(8500);
    const d = await finestraTesto(p);
    t('dopo una settimana chiede «È uscita BothWise 0.9.1»', /È uscita BothWise 0\.9\.1/.test(d) && /Aggiorna/.test(d) && /Più tardi/.test(d), d.slice(0, 160));
    await p.click('#finNo'); await p.waitForTimeout(400);
    t('«Più tardi» la rimanda alla settimana dopo', await p.evaluate(() => { const o = JSON.parse(localStorage.getItem('bothwise_aggiornamenti')); return o.rimandata === '0.9.1' && Date.now() - o.ultimo < 60000; }));
    t('non scarica niente senza il sì', !chiamate.includes('BothWise.scaricaAggiornamento'));
    t('nessun errore', !err.length, err.join(' | ')); await ctx.close(); }
  { const { p, ctx, chiamate } = await apri(b, { bothwise_aggiornamenti: JSON.stringify({ attivo: false }) }, true);
    await p.waitForTimeout(8500);
    t('con il controllo spento non chiede niente a GitHub', !chiamate.includes('BothWise.controllaAggiornamento')); await ctx.close(); }
  { const { p, ctx, chiamate } = await apri(b, {}, false);
    await p.waitForTimeout(8500);
    t('senza versioni nuove non disturba', !(await finestraTesto(p)) && chiamate.includes('BothWise.controllaAggiornamento')); await ctx.close(); }

  console.log('▶ In inglese');
  { const { p, ctx, err } = await apri(b, { bothwise_lingua: '"en"', bothwise_aggiornamenti: recente }, true);
    await p.click('#impBtn'); await p.waitForTimeout(500); await p.click('[data-arg="aggiornamenti"]'); await p.waitForTimeout(500);
    let x = await p.locator('#catAggiornamenti').innerText();
    t('la sezione è in inglese', /Updates/.test(x) && /Check once a week/.test(x) && /Check now/.test(x) && !/Controlla|settimana/.test(x), x.slice(0, 300));
    await p.click('#aggControlla'); await p.waitForTimeout(500);
    x = await p.locator('#catAggiornamenti').innerText();
    t('la versione nuova è descritta in inglese', /BothWise 0\.9\.1 is out/.test(x) && /What's new/.test(x) && /Update/.test(x), x.slice(0, 300));
    t('nessun errore', !err.length, err.join(' | ')); await ctx.close(); }

  console.log(`\nAggiornamenti: ${ok} riusciti, ${ko} falliti`);
  await b.close(); process.exit(ko ? 1 : 0);
})();
