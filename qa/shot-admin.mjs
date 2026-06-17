import puppeteer from 'puppeteer-core';
import { readFileSync } from 'node:fs';

const token = readFileSync(process.env.TOKEN_FILE || '/tmp/bsk_token.txt', 'utf8').trim();
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:5173';
const OUT = 'c:/Users/Admin/Desktop/Ruffy/qa';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const shots = [
  { path: '/admin/inicio', file: 'admin-desktop-inicio.png', w: 1440, h: 900 },
  { path: '/admin/rifas', file: 'admin-desktop-rifas.png', w: 1440, h: 900 },
  { path: '/admin/ordenes', file: 'admin-desktop-ordenes.png', w: 1440, h: 900 },
  { path: '/admin/perfil', file: 'admin-desktop-perfil.png', w: 1440, h: 900 },
  { path: '/admin/inicio', file: 'admin-mobile-inicio.png', w: 390, h: 844 },
];

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
});
try {
  for (const s of shots) {
    const page = await browser.newPage();
    await page.setViewport({ width: s.w, height: s.h, deviceScaleFactor: 1 });
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    await page.evaluate((t) => localStorage.setItem('bsk_token', t), token);
    await page.goto(`${BASE}${s.path}`, { waitUntil: 'networkidle2' });
    await sleep(1800);
    await page.screenshot({ path: `${OUT}/${s.file}` });
    console.log('OK', s.file, `${s.w}x${s.h}`);
    await page.close();
  }
} catch (e) {
  console.error('ERR', e.message);
} finally {
  await browser.close();
}
