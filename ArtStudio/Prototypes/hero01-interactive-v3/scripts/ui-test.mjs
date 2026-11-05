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
  try {
    await page.waitForFunction(expected => window.__HERO_QA__.getState().reaction.count >= expected, before + 1, { timeout: 5000 });
  } catch (error) {
    const diagnostics = await page.evaluate(({ x, y }) => ({
      hidden: document.hidden, visibility: document.visibilityState,
      viewport: [innerWidth, innerHeight], scrollY,
      element: document.elementFromPoint(x, y)?.tagName ?? null,
      canvas: document.querySelector('#animated-view canvas').getBoundingClientRect().toJSON(),
      state: window.__HERO_QA__.getState(), pending: window.__HERO_QA__.pendingPointers(),
      events: window.__HERO_TEST_EVENTS__?.slice(-10),
    }), pos);
    throw new Error(`No reaction for ${zone} at ${JSON.stringify(pos)}: ${JSON.stringify(diagnostics)}; ${error}`);
  }
  const after = await page.evaluate(() => window.__HERO_QA__.getState());
  assert.equal(after.reaction.count, before + 1, `duplicate event or missing tap at ${zone}`);
  assert.equal(after.lastReaction.zone, zone);
  assert.equal(after.input, mobile ? 'touch' : 'mouse');
  assert.equal(await page.evaluate(() => window.__HERO_QA__.pendingPointers()), 0);
}

async function captureWebGL(target, frame) {
  // Read the actual Pixi drawing buffer immediately after the deterministic
  // render. Browser screenshots can lag a frame when WebKit switches tabs.
  return target.evaluate(frame => {
    // A second identical render ensures first-use textures have uploaded.
    window.__HERO_QA__.frame(frame);
    window.__HERO_QA__.frame(frame);
    const canvas = document.querySelector('#animated-view canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) throw new Error('No existing WebGL context on animated canvas');
    const width = gl.drawingBufferWidth, height = gl.drawingBufferHeight;
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    let binary = '';
    for (let i = 0; i < pixels.length; i += 32768) binary += String.fromCharCode(...pixels.subarray(i, i + 32768));
    return { width, height, base64: btoa(binary) };
  }, frame);
}

function compareWebGL(a, b) {
  if (a.width !== b.width || a.height !== b.height) return { sameSize: false, dimensions: [a.width, a.height, b.width, b.height] };
  const first = Buffer.from(a.base64, 'base64'), second = Buffer.from(b.base64, 'base64');
  let total = 0, max = 0, changed = 0, visible = 0;
  for (let i = 0; i < first.length; i++) {
    const diff = Math.abs(first[i] - second[i]); total += diff; max = Math.max(max, diff); if (diff) changed++;
    if (i % 4 === 3 && first[i] > 0) visible++;
  }
  return { sameSize: true, mean: total / first.length, max, changed, visible };
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
      await old.bringToFront();
      const a = await captureWebGL(old, { time, blink, strength: 1 });
      await page.bringToFront();
      const b = await captureWebGL(page, { time, blink, strength: 1 });
      const result = compareWebGL(a, b);
      assert.ok(result.sameSize && result.visible > 1000, JSON.stringify(result));
      if (engine === 'webkit' && blink > 0) {
        // WebKit software WebGL can differ locally in the first-use eye
        // overlay across separate contexts. Keep and report the measured
        // result; do not claim exact parity at these sampled blink frames.
        console.log(`WebKit blink ${blink} difference ${view}: ${JSON.stringify(result)}`);
        assert.ok(result.mean < 1 && result.changed < a.width * a.height * 0.1, `${view} at ${time}/${blink}: ${JSON.stringify(result)}`);
      } else {
        assert.ok(result.max <= 1 && result.mean < 0.001, `${view} at ${time}/${blink}: ${JSON.stringify(result)}`);
      }
    }
  }
  console.log('V1 vs V3: synchronous WebGL comparisons completed (WebKit blink frames reported separately).');
  // The V1 comparison tab must not leave V3 backgrounded: WebKit suspends
  // requestAnimationFrame there, which would freeze the reaction clock.
  await page.bringToFront();
  await old.close();
  await page.waitForFunction(() => !document.hidden);
  await page.locator('#layout-solo').click();
  await page.locator('#view-body').click();
  await page.evaluate(() => window.__HERO_QA__.resume());
}

try {
  await ready(page);
  await page.evaluate(() => {
    window.__HERO_TEST_EVENTS__ = [];
    for (const type of ['pointerdown', 'pointerup', 'pointercancel', 'touchstart', 'touchend', 'touchcancel']) {
      document.addEventListener(type, event => {
        const state = window.__HERO_QA__?.getState();
        const entry = { type, target: event.target?.tagName, pointerType: event.pointerType,
          pointerId: event.pointerId, x: event.clientX, y: event.clientY,
          wall: performance.now(), reactionTime: state?.reactionTime, count: state?.reaction.count,
          pending: window.__HERO_QA__?.pendingPointers(),
          pixiHit: event.clientX == null ? null : window.__HERO_QA__?.zoneAtClient(event.clientX, event.clientY) };
        window.__HERO_TEST_EVENTS__.push(entry);
        if (window.__HERO_TEST_EVENTS__.length > 24) window.__HERO_TEST_EVENTS__.shift();
      }, true);
    }
  });
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
    // The sleepy overlay is already half-closed, so a blink changes fewer and
    // lower-contrast pixels than it does for an open-eyed expression.
    const visibleBlink = name === 'sleepy'
      ? blink.maxDifference > 10 && blink.meanAbsoluteDifference > 0.005 && blink.changedFraction > 0.001
      : blink.maxDifference > 25;
    assert.ok(visibleBlink && blink.nonTransparentA === blink.nonTransparentB, `${name} blink: ${JSON.stringify(blink)}`);
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

  // Supplemental deterministic regression: dispatch two Pixi pointer pairs
  // more than the cooldown apart without letting an animation frame run.
  // This is intentionally synthetic and does not replace the real taps above.
  await page.waitForTimeout(250);
  await scrollPointIntoView(...samples.head);
  const stalledFrame = await page.evaluate(({ head, hair, pointerType }) => {
    const qa = window.__HERO_QA__, canvas = document.querySelector('#animated-view canvas');
    const send = ([x, y]) => {
      const point = qa.sourceToClient(x, y);
      for (const type of ['pointerdown', 'pointerup']) canvas.dispatchEvent(new PointerEvent(type, {
        pointerId: 91, pointerType, isPrimary: true, clientX: point.x, clientY: point.y,
        bubbles: true, buttons: type === 'pointerdown' ? 1 : 0,
      }));
    };
    const before = qa.getState().reaction.count;
    send(head);
    const first = qa.getState();
    const start = performance.now(); while (performance.now() - start < 220) { /* no rAF */ }
    send(hair);
    const second = qa.getState();
    return { before, first: first.reaction.count, second: second.reaction.count, zone: second.lastReaction?.zone };
  }, { head: samples.head, hair: samples.hair, pointerType: mobile ? 'touch' : 'mouse' });
  assert.deepEqual(stalledFrame, { before: stalledFrame.before, first: stalledFrame.before + 1,
    second: stalledFrame.before + 2, zone: 'hair' }, `slow-frame cooldown: ${JSON.stringify(stalledFrame)}`);
  console.log('PASS: spaced Pixi input remains responsive between animation frames.');

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
