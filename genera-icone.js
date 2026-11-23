// Genera le immagini dell'icona di BothWise da icona/simbolo.svg (come DoctorWood).
// Uso:  node genera-icone.js
// L'icona dentro l'app è vettoriale (res/drawable/ic_launcher_*.xml, stesso disegno): qui si preparano
// l'icona per il Play Store (512), il logo grande (1024) e un'anteprima di come appare sul telefono.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const BLU = '#1e293b';   // blu notte, come DoctorWood e l'intestazione dell'app
const DIR = path.join(__dirname, 'icona');
const simbolo = fs.readFileSync(path.join(DIR, 'simbolo.svg'), 'utf8').replace('<svg ', '<svg width="100%" height="100%" ');
const FONT = `font-family:'Inter','Inter Display',sans-serif`;

const icona = (lato, forma, quota) => `<div style="width:${lato}px;height:${lato}px;background:${BLU};border-radius:${forma === 'tondo' ? '50%' : forma === 'quadrato' ? (lato * 0.22) + 'px' : '0'};display:flex;align-items:center;justify-content:center;overflow:hidden">
  <div style="width:${lato * quota}px;height:${lato * quota}px">${simbolo}</div></div>`;
const marchio = h => `
  <div style="${FONT};font-weight:800;font-size:${h}px;letter-spacing:-0.02em;line-height:1"><span style="color:#f1f5f9">Both</span><span style="color:#f59e0b">Wise</span></div>
  <div style="${FONT};font-weight:500;font-size:${h * 0.2}px;letter-spacing:0.38em;color:#94a3b8;margin-top:${h * 0.32}px;display:flex;align-items:center;gap:${h * 0.25}px">
    <span style="width:${h * 0.7}px;height:1px;background:#475569"></span>LE TUE CARTELLE, UGUALI<span style="width:${h * 0.7}px;height:1px;background:#475569"></span></div>`;
const logo = lato => `<div style="width:${lato}px;height:${lato}px;background:${BLU};display:flex;flex-direction:column;align-items:center;justify-content:center">
  <div style="width:${lato * 0.5}px;height:${lato * 0.5}px">${simbolo}</div>
  <div style="display:flex;flex-direction:column;align-items:center;margin-top:${lato * 0.05}px">${marchio(lato * 0.12)}</div></div>`;
const anteprima = () => `<div style="display:flex;gap:28px;align-items:center;padding:24px;background:#f1f5f9">
  ${icona(192, 'quadrato', 0.8)}${icona(144, 'tondo', 0.62)}${icona(72, 'quadrato', 0.8)}${icona(48, 'tondo', 0.62)}
  <div style="display:flex;gap:18px;align-items:center;padding:16px;background:#334155;border-radius:14px">${icona(72, 'tondo', 0.62)}${icona(48, 'quadrato', 0.8)}</div></div>`;

(async () => {
  const b = await chromium.launch(), p = await b.newPage();
  const foto = async (html, w, h, file) => {
    await p.setViewportSize({ width: w, height: h });
    await p.setContent(`<html><body style="margin:0;background:transparent">${html}</body></html>`);
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: path.join(DIR, file), omitBackground: true, clip: { x: 0, y: 0, width: w, height: h } });
  };
  await foto(icona(512, 'nessuna', 0.8), 512, 512, 'icona-play-store-512.png');   // Play: quadrata piena, gli angoli li fa Google
  await foto(logo(1024), 1024, 1024, 'logo-bothwise-1024.png');
  await foto(anteprima(), 760, 240, 'anteprima.png');
  await b.close();
  console.log('Fatto: icona/icona-play-store-512.png, icona/logo-bothwise-1024.png, icona/anteprima.png');
})();
