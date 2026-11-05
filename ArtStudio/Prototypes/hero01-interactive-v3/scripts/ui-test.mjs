import assert from 'node:assert/strict';
import { chromium, webkit, devices } from 'playwright-core';
import { blinkEnvelope } from '../src/rig.js';

// Start V3 first. Optionally start untouched V1 and provide HERO_V1_TEST_URL to
// run a real, same-browser pixel regression. No mock canvas or fake events.
const url = new URL(process.env.HERO_TEST_URL || 'http://127.0.0.1:5173/');
url.searchParams.set('qa', '1');
const engine = process.env.HERO_BROWSER || 'chromium';
const mode = process.env.HERO_DEVICE || 'desktop'; // desktop | mobile | landscape
const type = engine === 'webkit' ? webkit : chromium;
const launch = { headless: true };
if (engine === 'chromium') {
  if (process.env.CHROME_PATH) launch.executablePath = process.env.CHROME_PATH;
  launch.args = ['--no-sandbox', '--disable-dev-shm-usage', '--ignore-gpu-blocklist', '--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
  if (process.env.CHROME_PATH) launch.args.push('--no-zygote', '--single-process', '--in-process-gpu');
}
const browser = await type.launch(launch);
const mobile = mode !== 'desktop';
const options = mobile
  ? { ...devices['iPhone 13'], defaultBrowserType: engine,
    ...(mode === 'landscape' ? { viewport: { width: 844, height: 390 }, screen: { width: 844, height: 390 } } : {}) }
  : { viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 };
const context = await browser.newContext(options);
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(`pageerror: ${error}`));
page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
page.on('requestfailed', request => errors.push(`request: ${request.url()}: ${request.failure()?.errorText}`));
const samples = {
  head: [550, 120], hair: [320, 360], face: [560, 410],
  shoulderLeft: [370, 630], shoulderRight: [835, 680],
  armLeft: [330, 1000], armRight: [890, 1220],
  handLeft: [500, 565], handRight: [1070, 1810],
  upperTorso: [600, 900], waist: [600, 1200],
  legLeft: [460, 2250], legRight: [700, 2200],
};

async function ready(target, targetUrl = url) {
  await target.goto(targetUrl.toString(), { waitUntil: 'networkidle', timeout: 90000 });
  await target.waitForSelector('#loading[hidden]', { state: 'attached', timeout: 45000 });
  assert.equal(await target.locator('#error-message').isHidden(), true, 'WebGL initialization failed');
  await target.waitForFunction(() => Boolean(window.__HERO_QA__), null, { timeout: 30000 });
  assert.equal(await target.locator('.viewport canvas').count(), 2);
  assert.equal(await target.locator('#play-toggle').isEnabled(), true);
}

async function scrollPointIntoView(x, y) {
  let point = await page.evaluate(([x, y]) => window.__HERO_QA__.sourceToClient(x, y), [x, y]);
  const height = await page.evaluate(() => window.innerHeight);
  if (point.y < 45 || point.y > height - 45) {
    await page.evaluate(delta => window.scrollBy(0, delta), point.y - height / 2);
    point = await page.evaluate(([x, y]) => window.__HERO_QA__.sourceToClient(x, y), [x, y]);
  }
  return point;
}

async function tapZone(zone, point) {
  await page.waitForTimeout(160); // real input cooldown, no mocked time
  const pos = await scrollPointIntoView(...point);
  const hit = await page.evaluate(({ x, y }) => window.__HERO_QA__.zoneAtClient(x, y), pos);
  assert.equal(hit, zone, `Pixi hit test at ${point} picked ${hit} instead of ${zone}`);
  const before = (await page.evaluate(() => window.__HERO_QA__.getState())).reaction.count;
  if (mobile) await page.touchscreen.tap(pos.x, pos.y);
  else await page.mouse.click(pos.x, pos.y);
  await page.waitForFunction(expected => window.__HERO_QA__.getState().reaction.count >= expected, before + 1, { timeout: 5000 });
  const after = await page.evaluate(() => window.__HERO_QA__.getState());
  assert.equal(after.reaction.count, before + 1, `duplicate event or missing tap at ${zone}`);
  assert.equal(after.lastReaction.zone, zone);
  assert.equal(after.input, mobile ? 'touch' : 'mouse');
  assert.equal(await page.evaluate(() => window.__HERO_QA__.pendingPointers()), 0);
}

async function compareScreenshots(a, b, bottomToIgnore = 0) {
  return page.evaluate(async ([first, second, bottom]) => {
    const image = base64 => new Promise((resolve, reject) => {
      const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = `data:image/png;base64,${base64}`;
    });
    const [one, two] = await Promise.all([image(first), image(second)]);
    if (one.width !== two.width || one.height !== two.height) return { sameSize: false, widths: [one.width, two.width], heights: [one.height, two.height] };
    const canvas = document.createElement('canvas'); canvas.width = one.width; canvas.height = one.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(one, 0, 0); const aa = context.getImageData(0, 0, one.width, one.height - bottom).data;
    context.clearRect(0, 0, canvas.width, canvas.height); context.drawImage(two, 0, 0);
    const bb = context.getImageData(0, 0, one.width, one.height - bottom).data;
    let total = 0, max = 0, changed = 0;
    for (let i = 0; i < aa.length; i++) { const diff = Math.abs(aa[i] - bb[i]); total += diff; max = Math.max(max, diff); if (diff) changed++; }
    return { sameSize: true, mean: total / aa.length, max, changed };
  }, [a.toString('base64'), b.toString('base64'), bottomToIgnore]);
}

async function regressionAgainstV1() {
  if (!process.env.HERO_V1_TEST_URL) return;
  const v1Url = new URL(process.env.HERO_V1_TEST_URL); v1Url.searchParams.set('qa', '1');
  const old = await context.newPage();
  await ready(old, v1Url);
  await page.locator('#layout-compare').click();
  for (const view of ['body', 'face']) {
    await page.locator(`#view-${view}`).click(); await old.locator(`#view-${view}`).click();
    for (const [time, blink] of [[0, 0], [1.2, 0], [3.4, 0], [0, 0.5], [0, 1]]) {
      await old.evaluate(frame => window.__HERO_QA__.frame(frame), { time, blink, strength: 1 });
      await page.evaluate(frame => window.__HERO_QA__.frame(frame), { time, blink, strength: 1 });
      const a = await old.locator('#animated-view canvas').screenshot();
      const b = await page.locator('#animated-view canvas').screenshot();
      // Body panel labels are intentionally different V1/V3 UI text. The
      // bottom 50 CSS px are outside the artwork on the shared full-body fit.
      const pixelRatio = mobile ? 3 : 1;
      const result = await compareScreenshots(a, b, view === 'body' ? 50 * pixelRatio : 0);
      assert.ok(result.sameSize, JSON.stringify(result));
      // Mobile screenshots can differ by one 8-bit level because of
      // compositing/color rounding at fractional CSS coordinates.
      assert.ok(result.max <= (mobile ? 1 : 0) && result.mean < (mobile ? 0.15 : 0.00001), `${view} at ${time}/${blink}: ${JSON.stringify(result)}`);
    }
  }
  console.log(`V1 vs V3 idle/blink: 10 rendered comparisons ${mobile ? 'within 1/255' : 'identical'} (excluding renamed footer label).`);
  // This environment's --single-process Chromium exits when a context closes;
  // leaving the second page open until browser.close avoids that problem.
  await page.locator('#layout-solo').click();
  await page.locator('#view-body').click();
  await page.evaluate(() => window.__HERO_QA__.resume());
}

try {
  await ready(page);
  assert.equal(await page.locator('#layout-solo').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('#view-body').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('#animated-view canvas').evaluate(node => node.style.touchAction), 'manipulation');
  const size = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  assert.ok(size.scroll <= size.width, `horizontal overflow: ${JSON.stringify(size)}`);

  await regressionAgainstV1();
  await page.locator('#layout-compare').click();
  const neutral = await page.evaluate(() => {
    const geometry = window.__HERO_QA__.frame({ time: 0, blink: 0, strength: 1 });
    return { geometry, pixels: window.__HERO_QA__.comparePixels() };
  });
  assert.equal(neutral.geometry.maximumDisplacement, 0);
  assert.equal(neutral.geometry.maximumFaceDisplacement, 0);
  assert.equal(neutral.geometry.maximumFeetDisplacement, 0);
  assert.ok(neutral.pixels.comparable);
  assert.ok(neutral.pixels.meanAbsoluteDifference < 0.25 && neutral.pixels.maxDifference <= 20, JSON.stringify(neutral.pixels));
  console.log('Neutral static/mesh mean difference:', neutral.pixels.meanAbsoluteDifference);

  if (!mobile) {
    let minCross = Infinity, maxDisplacement = 0;
    for (const time of [0, 1.2, 2.7, 5.0, 8.4]) {
      const stats = await page.evaluate(t => window.__HERO_QA__.frame({ time: t, strength: 1.5,
        contributions: [{ zone: 'hair', amount: 1 }, { zone: 'waist', amount: 1 }, { zone: 'upperTorso', amount: 1 }] }), time);
      assert.equal(stats.maximumFaceDisplacement, 0); assert.equal(stats.maximumFeetDisplacement, 0);
      minCross = Math.min(minCross, stats.minimumCellCross); maxDisplacement = Math.max(maxDisplacement, stats.maximumDisplacement);
    }
    assert.ok(minCross > 300 && maxDisplacement < 32, `mesh: ${minCross}, ${maxDisplacement}`);
    console.log('Combined V1 + reaction geometry:', { minCross, maxDisplacement });
  }

  await page.locator('#view-face').click();
  const expressions = ['happy', 'surprised', 'shy', 'blushing', 'playful', 'sleepy', 'sad'];
  for (const name of expressions) {
    const difference = await page.evaluate(name => window.__HERO_QA__.compareExpressions({ name: 'neutral' }, { name }), name);
    assert.ok(difference.comparable && difference.maxDifference > 25 && difference.meanAbsoluteDifference > 0.002, `${name}: ${JSON.stringify(difference)}`);
    const blink = await page.evaluate(name => window.__HERO_QA__.compareBlink(name), name);
    assert.ok(blink.maxDifference > 25 && blink.nonTransparentA === blink.nonTransparentB, `${name} blink: ${JSON.stringify(blink)}`);
  }
  const distinctBlush = await page.evaluate(() => window.__HERO_QA__.compareExpressions({ name: 'shy' }, { name: 'blushing' }));
  assert.ok(distinctBlush.meanAbsoluteDifference > 0.002, 'blushing is distinct from shy');
  if (!mobile) {
    let maxExpressionJump = 0;
    for (let i = 0; i < 24; i++) {
      const diff = await page.evaluate(i => window.__HERO_QA__.compareExpressions(
        { name: 'surprised', amount: i / 24 }, { name: 'surprised', amount: (i + 1) / 24 }), i);
      maxExpressionJump = Math.max(maxExpressionJump, diff.meanAbsoluteDifference);
    }
    assert.ok(maxExpressionJump < 1, `expression frame jump ${maxExpressionJump}`);
    let maxBlinkJump = 0;
    for (let frame = 0; frame < 26; frame++) {
      const first = { time: 0, strength: 1, blink: blinkEnvelope(frame / 60) };
      const second = { time: 0, strength: 1, blink: blinkEnvelope((frame + 1) / 60) };
      const diff = await page.evaluate(([a, b]) => window.__HERO_QA__.compareFrames(a, b), [first, second]);
      maxBlinkJump = Math.max(maxBlinkJump, diff.meanAbsoluteDifference);
      assert.equal(diff.nonTransparentA, diff.nonTransparentB);
    }
    assert.ok(maxBlinkJump < 2, `blink frame jump ${maxBlinkJump}`);
    console.log('Worst successive-frame mean changes:', { expression: maxExpressionJump, blink: maxBlinkJump });
  }
  await page.evaluate(() => window.__HERO_QA__.resume());
  await page.locator('#layout-solo').click(); await page.locator('#view-body').click();
  for (const [zone, point] of Object.entries(samples)) await tapZone(zone, point);
  console.log(`PASS: ${Object.keys(samples).length} source-space zones using ${mobile ? 'touchscreen' : 'mouse'} events.`);

  // A drag/swipe must not generate a tap. On mobile Chromium verify scrolling;
  // desktop verifies movement tolerance with real mouse events.
  const torso = await scrollPointIntoView(600, 1200);
  const beforeDrag = (await page.evaluate(() => window.__HERO_QA__.getState())).reaction.count;
  if (!mobile) {
    await page.mouse.move(torso.x, torso.y); await page.mouse.down();
    await page.mouse.move(torso.x + 80, torso.y + 30); await page.mouse.up();
    await page.waitForTimeout(200);
    assert.equal((await page.evaluate(() => window.__HERO_QA__.getState())).reaction.count, beforeDrag);
  } else if (engine === 'chromium') {
    const client = await context.newCDPSession(page);
    const scrollBefore = await page.evaluate(() => scrollY);
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: torso.x, y: torso.y, id: 1 }] });
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: torso.x, y: torso.y - 100, id: 1 }] });
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(300);
    assert.equal((await page.evaluate(() => window.__HERO_QA__.getState())).reaction.count, beforeDrag);
    assert.equal(await page.evaluate(() => window.__HERO_QA__.pendingPointers()), 0);
    assert.ok((await page.evaluate(() => scrollY)) > scrollBefore, 'native swipe should scroll');
  }

  // Blink and interactions remain functional with V1 idle paused.
  await page.locator('#play-toggle').click();
  assert.equal(await page.locator('#play-toggle').getAttribute('aria-pressed'), 'true');
  const pausedTime = (await page.evaluate(() => window.__HERO_QA__.getState())).time;
  await page.waitForTimeout(150);
  assert.equal((await page.evaluate(() => window.__HERO_QA__.getState())).time, pausedTime);
  await tapZone('face', samples.face);
  assert.equal((await page.evaluate(() => window.__HERO_QA__.getState())).time, pausedTime);
  await page.locator('#blink-button').click();
  await page.waitForFunction(() => window.__HERO_QA__.getState().currentBlink > 0.5, null, { timeout: 3000 });
  await page.waitForFunction(() => window.__HERO_QA__.getState().manualBlinkStart === null, null, { timeout: 3000 });
  await page.locator('#intensity').evaluate(input => { input.value = '0'; input.dispatchEvent(new Event('input', { bubbles: true })); });
  assert.equal(await page.locator('#intensity-value').textContent(), '0%');
  await page.locator('#play-toggle').click();
  assert.equal(await page.locator('#play-toggle').getAttribute('aria-pressed'), 'false');
  await page.locator('#view-face').click();
  await tapZone('face', samples.face); // after responsive zoom
  await page.waitForFunction(() => window.__HERO_QA__.getState().reaction.state === 'IDLE', null, { timeout: 7000 });
  await page.waitForFunction(() => window.__HERO_QA__.getState().facial.amount === 0, null, { timeout: 5000 });

  // Desktop reduced-motion behavior; each test still permits an explicit tap.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  assert.equal(await page.locator('#play-toggle').getAttribute('aria-pressed'), 'true');
  await tapZone('head', samples.head);
  assert.equal((await page.evaluate(() => window.__HERO_QA__.getState())).playing, false);
  assert.deepEqual(errors, [], errors.join('\n'));
  console.log(`PASS: ${engine} / ${mode}: controls, expressions, blink, pause, recovery, responsiveness and no browser errors.`);
} finally {
  await browser.close();
}
