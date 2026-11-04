import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { blinkEnvelope } from '../src/rig.js';

// Requires a running Vite server and an installed Chromium. For the container
// used during development, CHROME_PATH points to the temporary test binary.
const url = new URL(process.env.HERO_TEST_URL || 'http://127.0.0.1:5173/');
const production = process.env.HERO_PRODUCTION === '1';
if (!production) url.searchParams.set('qa', '1');
const executablePath = process.env.CHROME_PATH || undefined;
const screenshots = process.env.HERO_SCREENSHOTS;
const browser = await chromium.launch({
  headless: true,
  executablePath,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--no-zygote', '--single-process',
    '--in-process-gpu', '--ignore-gpu-blocklist', '--enable-webgl', '--use-gl=angle',
    '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const errors = [];
const attachErrors = page => {
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('requestfailed', request => errors.push(`${request.url()}: ${request.failure()?.errorText}`));
};
async function ready(page) {
  await page.goto(url.toString(), { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForSelector('#loading[hidden]', { state: 'attached', timeout: 30000 });
  assert.equal(await page.locator('#error-message').isHidden(), true, 'WebGL scene failed');
  assert.equal(await page.locator('.viewport canvas').count(), 2, 'both comparison canvases exist');
  assert.equal(await page.locator('#play-toggle').isEnabled(), true);
  if (!production) await page.waitForFunction(() => Boolean(window.__HERO_QA__), null, { timeout: 30000 });
}

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  attachErrors(page);
  await ready(page);
  assert.equal(await page.locator('#view-body').getAttribute('aria-pressed'), 'true');
  if (screenshots) await page.screenshot({ path: `${screenshots}/hero-desktop-body.png`, fullPage: true });

  if (!production) {
    const neutral = await page.evaluate(() => {
      const geometry = window.__HERO_QA__.frame({ time: 0, blink: 0, strength: 1 });
      return { geometry, pixels: window.__HERO_QA__.comparePixels() };
    });
    assert.equal(neutral.geometry.maximumDisplacement, 0);
    assert.equal(neutral.geometry.maximumFaceDisplacement, 0);
    assert.equal(neutral.geometry.maximumFeetDisplacement, 0);
    assert.ok(neutral.pixels.comparable);
    assert.ok(neutral.pixels.nonTransparentA > 10000 && neutral.pixels.nonTransparentB > 10000);
    assert.ok(neutral.pixels.meanAbsoluteDifference < 0.25 && neutral.pixels.maxDifference <= 20,
      `neutral mesh differs too much from source: ${JSON.stringify(neutral.pixels)}`);
    console.log('Neutral WebGL comparison:', neutral.pixels);

    let maxMotion = 0;
    let minTriangle = Infinity;
    for (let n = 0; n <= 92; n++) {
      const stats = await page.evaluate(time => window.__HERO_QA__.frame({ time, blink: 0, strength: 1.5 }), n * 0.2);
      assert.equal(stats.maximumFaceDisplacement, 0);
      assert.equal(stats.maximumFeetDisplacement, 0);
      maxMotion = Math.max(maxMotion, stats.maximumDisplacement);
      minTriangle = Math.min(minTriangle, stats.minimumCellCross);
    }
    assert.ok(maxMotion > 10 && maxMotion < 25, `motion range ${maxMotion}`);
    assert.ok(minTriangle > 300, `mesh triangle flipped or compressed: ${minTriangle}`);
    console.log(`Maximum intensity: max displacement ${maxMotion.toFixed(2)} source px; min triangle cross ${minTriangle.toFixed(2)}.`);
  }

  await page.locator('#view-face').click();
  assert.equal(await page.locator('#view-face').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('#view-body').getAttribute('aria-pressed'), 'false');
  if (screenshots) {
    if (!production) await page.evaluate(() => window.__HERO_QA__.frame({ time: 0, blink: 0, strength: 1 }));
    await page.waitForTimeout(220);
    await page.screenshot({ path: `${screenshots}/hero-desktop-face.png`, fullPage: true });
    if (!production) {
      await page.evaluate(() => window.__HERO_QA__.frame({ time: 0, blink: 1, strength: 1 }));
      await page.locator('#animated-view').screenshot({ path: `${screenshots}/hero-closed-eyes.png` });
    }
  }

  if (!production) {
    let worstMeanDelta = 0;
    let worstAlphaChange = 0;
    for (let frame = 0; frame < 26; frame++) {
      const first = { time: 0, strength: 1, blink: blinkEnvelope(frame / 60) };
      const second = { time: 0, strength: 1, blink: blinkEnvelope((frame + 1) / 60) };
      const result = await page.evaluate(([a, b]) => window.__HERO_QA__.compareFrames(a, b), [first, second]);
      assert.ok(result.comparable);
      assert.ok(result.nonTransparentA > 10000 && result.nonTransparentB > 10000, 'blank blink frame');
      worstMeanDelta = Math.max(worstMeanDelta, result.meanAbsoluteDifference);
      worstAlphaChange = Math.max(worstAlphaChange, Math.abs(result.nonTransparentA - result.nonTransparentB));
    }
    assert.ok(worstMeanDelta < 2, `blink frames jump: ${worstMeanDelta}`);
    assert.ok(worstAlphaChange < 50, `blink unexpectedly changed canvas coverage: ${worstAlphaChange}`);
    const blinkCompare = await page.evaluate(() => {
      window.__HERO_QA__.frame({ time: 0, blink: 1, strength: 1 });
      return window.__HERO_QA__.comparePixels();
    });
    assert.ok(blinkCompare.maxDifference > 25, 'closed eye patch is not visible');
    console.log(`Blink, 60 fps: worst frame mean delta ${worstMeanDelta.toFixed(4)} / 255; worst alpha-pixel change ${worstAlphaChange}.`);
    await page.evaluate(() => window.__HERO_QA__.resume());
  }

  await page.locator('#play-toggle').click();
  assert.equal(await page.locator('#play-toggle').getAttribute('aria-pressed'), 'true');
  assert.match(await page.locator('#play-status').textContent(), /паузе/i);
  if (!production) {
    const before = await page.evaluate(() => window.__HERO_QA__.getState().time);
    await page.waitForTimeout(150);
    const after = await page.evaluate(() => window.__HERO_QA__.getState().time);
    assert.equal(after, before, 'pause must freeze the timeline');
  }
  // The manual blink must still play even when body animation is paused.
  await page.locator('#blink-button').click();
  if (!production) {
    await page.waitForFunction(() => window.__HERO_QA__.getState().currentBlink > 0.5, null, { timeout: 2500 });
    await page.waitForFunction(() => window.__HERO_QA__.getState().manualBlinkStart === null, null, { timeout: 2500 });
    assert.equal((await page.evaluate(() => window.__HERO_QA__.getState())).playing, false);
  }
  await page.locator('#intensity').evaluate(input => {
    input.value = '0'; input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  assert.equal(await page.locator('#intensity-value').textContent(), '0%');
  if (!production) assert.equal((await page.evaluate(() => window.__HERO_QA__.getState())).strength, 0);
  await page.locator('#play-toggle').click();
  assert.equal(await page.locator('#play-toggle').getAttribute('aria-pressed'), 'false');
  await page.locator('#view-body').click();
  assert.equal(await page.locator('#view-body').getAttribute('aria-pressed'), 'true');

  // Reuse the page: headless-shell in single-process mode exits when a
  // browser context closes, even if another context has just been created.
  const mobilePage = page;
  await mobilePage.emulateMedia({ reducedMotion: 'reduce' });
  await mobilePage.setViewportSize({ width: 390, height: 844 });
  await ready(mobilePage);
  assert.equal(await mobilePage.locator('#play-toggle').getAttribute('aria-pressed'), 'true', 'reduced motion starts paused');
  const mobileSizes = await mobilePage.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  assert.ok(mobileSizes.scroll <= mobileSizes.width, `mobile horizontal overflow: ${JSON.stringify(mobileSizes)}`);
  await mobilePage.locator('#view-face').click();
  assert.equal(await mobilePage.locator('#view-face').getAttribute('aria-pressed'), 'true');
  await mobilePage.locator('#blink-button').click();
  if (!production) await mobilePage.waitForFunction(() => window.__HERO_QA__.getState().currentBlink > 0.5, null, { timeout: 2500 });
  if (screenshots) {
    await mobilePage.waitForTimeout(300);
    await mobilePage.screenshot({ path: `${screenshots}/hero-mobile-face.png`, fullPage: true });
  }
  assert.deepEqual(errors, [], `browser errors: ${errors.join('\n')}`);
  console.log(`PASS: ${production ? 'production' : 'development'} browser controls, comparison, mobile, reduced motion, and no console/network errors.`);
} finally {
  await browser.close();
}
