// Real WebKit engine with iPhone-sized emulation; not physical iPhone Safari.
// Install the browser with `npx playwright-core install --with-deps webkit`.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { webkit, devices } from 'playwright-core';

const url = process.env.HERO_TEST_URL || 'http://127.0.0.1:4173/';
const expectedHash = '91111189c23d1d7ac424e85d3406202bf028e8d3330ae8c50b33223312f236fd';
let browser;
let phase = 'launch';
const errors = [];
const responses = [];
try {
  browser = await webkit.launch({ headless: true });
  const context = await browser.newContext({ ...devices['iPhone 13'], reducedMotion: 'no-preference' });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(`Page error: ${error}`));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(`Console: ${msg.text()}`); });
  page.on('requestfailed', req => errors.push(`Request failed: ${req.url()} ${req.failure()?.errorText}`));
  page.on('response', response => responses.push(response));
  phase = 'load';
  const main = await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  assert.equal(main.status(), 200, 'page must be accessible');
  await page.waitForSelector('#loading[hidden]', { state: 'attached', timeout: 45000 });
  assert.equal(await page.locator('#error-message').isHidden(), true, 'WebKit scene initialization failed');
  assert.equal(await page.locator('.viewport canvas').count(), 2);
  assert.equal(await page.locator('#play-toggle').isEnabled(), true);
  const size = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  assert.ok(size.scroll <= size.width, `horizontal overflow: ${JSON.stringify(size)}`);

  phase = 'assets';
  const artwork = responses.find(r => /HERO-01_outfit02_playful_maid[^/]*\.png/.test(r.url()));
  assert.ok(artwork, 'approved image was not requested');
  assert.equal(artwork.status(), 200);
  const hash = createHash('sha256').update(await artwork.body()).digest('hex');
  assert.equal(hash, expectedHash, 'artwork differs from the approved original');
  const derived = responses.filter(r => /\/derived\/(blink_(left|right)_atlas|hair_(left|right)_(restore|strand))\.png/.test(r.url()));
  assert.equal(derived.length, 6, 'two eye atlases and four strand layers should load');
  assert.ok(derived.every(r => r.status() === 200));

  phase = 'body animation';
  const animated = page.locator('#animated-view');
  await page.locator('#intensity').evaluate(input => { input.value = '150'; input.dispatchEvent(new Event('input', { bubbles: true })); });
  const motionA = await animated.screenshot();
  await page.waitForTimeout(1200);
  const motionB = await animated.screenshot();
  assert.notDeepEqual(motionA, motionB, 'body animation must change the rendered frame');
  const frameTiming = await page.evaluate(() => new Promise(resolve => {
    const times = [];
    const started = performance.now();
    function frame(now) {
      times.push(now);
      if (now - started < 2000) requestAnimationFrame(frame);
      else {
        const intervals = times.slice(1).map((time, i) => time - times[i]).sort((a, b) => a - b);
        resolve({ frames: times.length, medianMs: intervals[Math.floor(intervals.length / 2)] || null,
          p95Ms: intervals[Math.floor(intervals.length * 0.95)] || null });
      }
    }
    requestAnimationFrame(frame);
  }));

  phase = 'pause and blink';
  await page.locator('#view-face').click();
  assert.equal(await page.locator('#view-face').getAttribute('aria-pressed'), 'true');
  await page.locator('#play-toggle').click();
  assert.equal(await page.locator('#play-toggle').getAttribute('aria-pressed'), 'true');
  await page.waitForTimeout(500);
  const pausedA = await animated.screenshot();
  await page.waitForTimeout(500);
  const pausedB = await animated.screenshot();
  assert.deepEqual(pausedA, pausedB, 'paused animation must freeze');
  // Sampling at animation-frame boundaries avoids screenshots scrolling the
  // controls and missing this deliberately brief blink.
  const blinkFrames = await page.evaluate(() => new Promise(resolve => {
    const source = document.querySelector('#animated-view canvas');
    const sample = document.createElement('canvas');
    sample.width = source.width;
    sample.height = source.height;
    const ctx = sample.getContext('2d', { willReadFrequently: true });
    const frames = [], started = performance.now();
    document.querySelector('#blink-button').click();
    const capture = now => {
      ctx.clearRect(0, 0, sample.width, sample.height);
      ctx.drawImage(source, 0, 0);
      const pixels = ctx.getImageData(0, 0, sample.width, sample.height).data;
      let hash = 2166136261, opaque = 0;
      for (let i = 0; i < pixels.length; i += 16) {
        if (pixels[i + 3]) opaque++;
        hash = Math.imul(hash ^ pixels[i], 16777619);
        hash = Math.imul(hash ^ pixels[i + 1], 16777619);
        hash = Math.imul(hash ^ pixels[i + 2], 16777619);
        hash = Math.imul(hash ^ pixels[i + 3], 16777619);
      }
      frames.push({ elapsed: Math.round(now - started), hash: hash >>> 0, opaque });
      if (performance.now() - started < 700) requestAnimationFrame(capture);
      else resolve(frames);
    };
    requestAnimationFrame(capture);
  }));
  const visibleFrames = blinkFrames.filter(frame => frame.opaque > 100);
  assert.ok(new Set(visibleFrames.map(frame => frame.hash)).size > 1,
    `manual blink must alter visible frames while paused: ${JSON.stringify(blinkFrames)}`);
  if (process.env.HERO_SCREENSHOT) await page.screenshot({ path: process.env.HERO_SCREENSHOT, fullPage: true });

  phase = 'reduced motion';
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForSelector('#loading[hidden]', { state: 'attached', timeout: 45000 });
  assert.equal(await page.locator('#play-toggle').getAttribute('aria-pressed'), 'true');
  assert.deepEqual(errors, [], `browser errors: ${errors.join('\n')}`);
  console.log(`::notice title=HERO-01 V2 WebKit QA::PASS: approved source SHA ${hash}; 2 eye atlases, 4 hair layers; iPhone 13-sized WebKit load, layout, motion, pause, blink, and reduced motion. CI frame sample: ${JSON.stringify(frameTiming)}. Not a physical device.`);
} catch (error) {
  const detail = `Phase: ${phase}. ${error?.message || error}. Browser errors: ${errors.join(' | ')}`.slice(0, 5000);
  console.error(`::error title=HERO-01 V2 WebKit QA::${detail.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A')}`);
  process.exitCode = 1;
} finally { if (browser) await browser.close(); }
