// Browser-level smoke tests, usable against local output or the public Vercel URL.
// Mobile is emulated; this is not a test of a physical phone, Safari or FPS.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { art, artUrl } from '../site/catalog-data.mjs';
const gallery = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(resolve(gallery, '../hero01-night-step/package.json'));
const { chromium: playwright } = require('playwright-core');
const chromiumPath = require.resolve('@sparticuz/chromium');
const { default: chromium, inflate } = await import(chromiumPath);
const root = new URL(process.env.GALLERY_URL || 'http://127.0.0.1:5189/collection/');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

for (const item of art) {
  const url = new URL(artUrl(item), root);
  const response = await fetch(url, { cache: 'no-store' });
  assert.equal(response.status, 200, `${item.file}: HTTP ${response.status}`);
  assert.equal(sha256(Buffer.from(await response.arrayBuffer())), item.sha256, `${item.file}: original bytes changed`);
  const thumbnail = await fetch(new URL(`./thumb/${item.id}.webp`, root), { method: 'HEAD', cache: 'no-store' });
  assert.equal(thumbnail.status, 200, `${item.id}: thumbnail HTTP ${thumbnail.status}`);
}
console.log(`${art.length} original PNGs match the recorded SHA-256 hashes.`);

const executablePath = await chromium.executablePath();
let env = { ...process.env };
if (process.platform === 'linux') {
  const libs = await inflate(join(dirname(chromiumPath), '../bin/al2023.tar.br'));
  env.LD_LIBRARY_PATH = [join(libs, 'lib'), env.LD_LIBRARY_PATH].filter(Boolean).join(':');
}
const browser = await playwright.launch({ executablePath, headless: true, args: chromium.args, env });
const errors = [];
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, acceptDownloads: true });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(`page: ${error.message}`));
  page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  page.on('response', response => { if (response.status() >= 400 && !response.url().endsWith('/favicon.ico')) errors.push(`HTTP ${response.status()}: ${response.url()}`); });
  await page.goto(root.href, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('[data-motion-card="night"]').waitFor();
  assert.equal(await page.locator('[data-motion-card]').count(), 3);
  assert.equal(await page.locator('#still-grid [data-art-card]').count(), 5);
  assert.equal(await page.locator('#pending-grid [data-art-card]').count(), 3);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'mobile home overflow');
  await page.locator('#tab-still').click();
  await page.locator('#panel-still').waitFor({ state: 'visible', timeout: 30000 });
  await page.locator('[data-art-card="goth"] [data-open-art]').first().click();
  await page.waitForFunction(() => document.querySelector('#art-full-image').naturalWidth === 768);
  assert.equal(await page.locator('#art-dialog-status').textContent(), 'Арт утверждён');
  await page.locator('#toggle-zoom').click();
  assert.equal(await page.locator('#art-viewport').evaluate(node => node.classList.contains('zoomed')), true);
  await page.locator('#review-art').click();
  await page.locator('[data-verdict="improve"]').click();
  await page.locator('#review-note').fill('Проверить вторую стопу и детализацию.');
  await page.locator('[data-close="review-dialog"]').last().click();
  await page.locator('[data-close="art-dialog"]').click();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('#open-summary').click();
  assert.match(await page.locator('#review-list').innerText(), /Готический образ/);
  assert.match(await page.locator('#review-list').innerText(), /Доработать/);
  assert.match(await page.locator('#review-list').innerText(), /Проверить вторую стопу/);
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#download-reviews').click();
  const download = await downloadPromise;
  assert.match(await readFile(await download.path(), 'utf8'), /Проверить вторую стопу/);
  await page.locator('[data-close="summary-dialog"]').click();
  await page.locator('#tab-pending').click();
  assert.match(await page.locator('#panel-pending').innerText(), /конкретный файл не указан/);
  await page.locator('#tab-animation').click();

  async function checkFrame(hash, relativePath) {
    await page.evaluate(value => { location.hash = value; }, hash);
    const expected = new URL(relativePath, root).pathname;
    await page.waitForFunction(path => {
      const frame = document.querySelector('#preview-frame');
      try { return frame && frame.contentWindow.location.pathname === path; } catch { return false; }
    }, expected, { timeout: 60000 });
    const frame = page.frameLocator('#preview-frame');
    await frame.locator('#loading').waitFor({ state: 'hidden', timeout: 90000 });
    assert.equal(await frame.locator('#error-message').isHidden(), true, `${hash}: scene error`);
    await frame.locator('#animated-view canvas').first().waitFor({ state: 'visible', timeout: 30000 });
    return frame;
  }
  const night = await checkFrame('#motion/night/step', '../');
  await night.locator('[data-zone="footNear"]').tap({ timeout: 30000 });
  assert.match(await night.locator('#touch-status').textContent(), /реакция 1/);
  await checkFrame('#motion/yoga/yoga', './motion/yoga/');
  await checkFrame('#motion/maid/v3', './motion/maid-v3/');
  await checkFrame('#motion/maid/v1', './motion/maid-v1/');
  await checkFrame('#motion/maid/v2', './motion/maid-v2/');
  assert.equal(await page.locator('#viewer-badge').textContent(), 'Эксперимент');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'mobile viewer overflow');
  assert.deepEqual(errors, []);
  console.log('Mobile Chromium: tabs, original viewer/zoom, local feedback/export, five WebGL previews and Night Step touch button passed.');

  // Reuse the same page: the single-process serverless Chromium can terminate
  // after its last context closes. This checks the wider layout, not a device.
  await page.evaluate(() => { location.hash = '#animation'; });
  await page.locator('[data-motion-card="night"]').waitFor({ state: 'visible' });
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.waitForFunction(() => [...document.querySelectorAll('#motion-grid img')].every(image => image.complete && image.naturalWidth > 0), null, { timeout: 60000 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'wide layout overflow');
  if (process.env.GALLERY_SCREENSHOT) await page.screenshot({ path: process.env.GALLERY_SCREENSHOT, fullPage: true });
  console.log('Chromium at a wide viewport: collection renders without horizontal overflow.');
  await context.close();
} finally { await browser.close(); }
