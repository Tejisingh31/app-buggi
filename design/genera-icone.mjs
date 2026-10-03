import fs from 'node:fs';
import { chromium } from 'playwright-core';

// Genera le icone quadrate dal logo dell'utente (768×512): ritagli + ridimensionamento con Chrome.
const SORGENTE = 'C:/WORK/APP_BUGGI/design/buggi_logo_bhindi.png';
const OUT = process.argv[2] ?? 'C:/WORK/APP_BUGGI/public/icons/';
const dati = 'data:image/png;base64,' + fs.readFileSync(SORGENTE).toString('base64');

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const page = await browser.newPage();

// colore dello sfondo del logo (angolo in alto a sinistra), per riempire i bordi
await page.setContent(`<img id="i" src="${dati}">`);
await page.waitForFunction(() => document.getElementById('i').complete);
const sfondo = await page.evaluate(() => {
  const img = document.getElementById('i');
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const [r, gg, b] = g.getImageData(4, 4, 1, 1).data;
  return `rgb(${r}, ${gg}, ${b})`;
});
console.log('sfondo del logo:', sfondo);

/**
 * Ritaglio quadrato del logo: (x, y, lato) in pixel dell'originale.
 * scala < 1 = disegno rimpicciolito al centro (zona sicura delle icone "maskable").
 */
async function genera(file, latoOut, { x, y, lato }, { raggio = '0', scala = 1, trasparente = false } = {}) {
  await page.setViewportSize({ width: latoOut, height: latoOut });
  const k = (latoOut * scala) / lato; // ingrandimento
  const off = (latoOut * (1 - scala)) / 2;
  await page.setContent(`<html><body style="margin:0;background:transparent">
    <div style="position:relative;width:${latoOut}px;height:${latoOut}px;overflow:hidden;border-radius:${raggio};background:${sfondo}">
      <img src="${dati}" style="position:absolute;left:${off - x * k}px;top:${off - y * k}px;width:${768 * k}px;height:${512 * k}px;${scala < 1 ? '-webkit-mask-image:linear-gradient(to bottom, transparent 0%, #000 7%, #000 93%, transparent 100%);mask-image:linear-gradient(to bottom, transparent 0%, #000 7%, #000 93%, transparent 100%)' : ''}">
    </div></body></html>`);
  await page.waitForTimeout(80);
  await page.screenshot({ path: OUT + file, omitBackground: trasparente });
  console.log('creato', file);
}

const CON_SCRITTA = { x: 128, y: 0, lato: 512 }; // personaggio + "buggi"
const PERSONAGGIO = { x: 238, y: 2, lato: 312 }; // solo il personaggio (senza la scritta)

await genera('icon-512.png', 512, CON_SCRITTA, { raggio: '22%', trasparente: true });
await genera('icon-192.png', 192, CON_SCRITTA, { raggio: '22%', trasparente: true });
await genera('icon-maskable-512.png', 512, CON_SCRITTA, { scala: 0.8 });
await genera('apple-touch-icon.png', 180, CON_SCRITTA);
await genera('favicon-32.png', 32, PERSONAGGIO, { raggio: '22%', trasparente: true });
await genera('logo-piccolo.png', 128, PERSONAGGIO, { raggio: '22%', trasparente: true });
await browser.close();
