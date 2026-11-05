import assert from 'node:assert/strict';
import { chromium, webkit, devices } from 'playwright-core';
import { blinkEnvelope } from '../src/rig.js';
import { EXPRESSIONS } from '../src/reactions.js';

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
const physicalPoints = {
  head: [550, 120], hair: [200, 1120], face: [560, 410],
  shoulderLeft: [370, 700], shoulderRight: [835, 700],
  armLeft: [330, 1000], armRight: [905, 1320],
  handLeft: [500, 565], handRight: [1060, 1795],
  upperTorso: [600, 900], waist: [600, 1200],
  legLeft: [460, 2400], legRight: [685, 2400],
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
  const scrollBefore = await page.evaluate(() => scrollY);
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
  assert.ok(Math.abs((await page.evaluate(() => scrollY)) - scrollBefore) < 1, `tap scrolled the page at ${zone}`);
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
  if (mobile) {
    // Match the V1 QA tab to V3's actual canvas density. Different WebKit
    // emulations expose touch capabilities differently, and comparing buffers
    // with unequal drawing sizes would be meaningless.
    const density = await page.locator('#animated-view canvas').evaluate(canvas => canvas.width / canvas.clientWidth);
    await old.addInitScript(value => Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value }), density);
    console.log(`V1 QA resolution matched to V3 canvas density: ${density}`);
  }
  await ready(old, v1Url);
  await page.locator('#layout-compare').click();
  for (const view of ['body', 'face']) {
    await page.locator(`#view-${view}`).click(); await old.locator(`#view-${view}`).click();
    // V3 intentionally has independent idle limb motion now. Only the rest
    // pose and inherited blink are expected to resemble V1; animated frames
    // must no longer be falsely asserted pixel-identical to V1.
    const frames = [];
    for (const [time, blink] of [[0, 0], [0, 0.5], [0, 1]]) {
      await old.bringToFront();
      const a = await captureWebGL(old, { time, blink, strength: 1 });
      await page.bringToFront();
      const b = await captureWebGL(page, { time, blink, strength: 1 });
      const result = compareWebGL(a, b);
      frames.push({ a, b });
      assert.ok(result.sameSize && result.visible > 1000, JSON.stringify(result));
      // Compositing several independently minified textures cannot be
      // pixel-identical to filtering a flattened image. The source-resolution
      // offline reconstruction is measured separately. WebKit's inherited
      // blink layers also vary across software contexts, as before.
      console.log(`${engine} V1/rest ${view} blink ${blink}: ${JSON.stringify(result)}`);
      const threshold = engine === 'webkit' && blink > 0 ? 1 : 0.4;
      assert.ok(result.mean < threshold && result.changed < a.width * a.height * 0.36,
        `${view} at ${time}/${blink}: ${JSON.stringify(result)}`);
    }
    if (view === 'face') {
      // Ensure the captured buffers actually contain different blink states;
      // otherwise two stale/read-cleared frames could falsely look identical.
      const v1Blink = compareWebGL(frames[0].a, frames[2].a);
      const v3Blink = compareWebGL(frames[0].b, frames[2].b);
      assert.ok(v1Blink.max > 25 && v1Blink.changed > 100, `V1 blink capture: ${JSON.stringify(v1Blink)}`);
      assert.ok(v3Blink.max > 25 && v3Blink.changed > 100, `V3 blink capture: ${JSON.stringify(v3Blink)}`);
      console.log('Open vs closed eyes were rendered in both versions:', { v1Blink, v3Blink });
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
  assert.equal(await page.locator('#animated-view canvas').evaluate(node => node.style.touchAction), 'pan-y');
  const rendering = await page.evaluate(() => ({ dpr: devicePixelRatio, maxTouchPoints: navigator.maxTouchPoints,
    coarsePointer: matchMedia('(pointer: coarse)').matches, touchEvents: 'ontouchstart' in window,
    canvasDensity: document.querySelector('#animated-view canvas').width / document.querySelector('#animated-view canvas').clientWidth }));
  console.log(`${engine}/${mode} rendering:`, rendering);
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
  // Minification and alpha compositing happen independently on each skin;
  // exact equality is not expected at WebGL sampling boundaries.
  assert.ok(neutral.pixels.meanAbsoluteDifference < 0.25 && neutral.pixels.maxDifference <= 100
    && neutral.pixels.changedFraction < 0.25, JSON.stringify(neutral.pixels));
  console.log('Neutral static/mesh comparison:', neutral.pixels);

  // Freeze the shared body and all other limbs. Exercise every actual joint
  // in both directions and compare the WebGL buffers as well as the joint's
  // projected source-space descendant. This cannot pass via whole-mesh sway.
  const jointCases = [
    ['raised', 'shoulder', [350, 1120], 'arm_raised'],
    ['raised', 'elbow', [430, 710], 'arm_raised'],
    ['raised', 'wrist', [585, 500], 'arm_raised'],
    ['lowered', 'shoulder', [1090, 1870], 'arm_down'],
    ['lowered', 'elbow', [1090, 1870], 'arm_down'],
    ['lowered', 'wrist', [1130, 1930], 'arm_down'],
    ['frontLeg', 'hip', [515, 2390], 'leg_front'],
    ['frontLeg', 'knee', [425, 3350], 'leg_front'],
    ['frontLeg', 'ankle', [490, 3410], 'leg_front'],
    ['backLeg', 'hip', [650, 2390], 'leg_back'],
    ['backLeg', 'knee', [565, 3350], 'leg_back'],
    ['backLeg', 'ankle', [630, 3410], 'leg_back_foot'],
  ];
  let minimumJointShift = Infinity, minimumJointPixels = Infinity, minLimbCross = Infinity;
  for (const [limb, joint, [x, y], layer] of jointCases) for (const direction of [-1, 1]) {
    const result = await page.evaluate(({ limb, joint, x, y, layer, direction }) => {
      const qa = window.__HERO_QA__, neutral = { time: 0, strength: 0, blink: 0, jointPose: {} };
      const active = { ...neutral, jointPose: { [limb]: { [joint]: direction * 0.012 } } };
      qa.frame(neutral); const a = qa.limbPoint(limb, x, y);
      const geometry = qa.frame(active), b = qa.limbPoint(limb, x, y);
      const diff = qa.compareFrames(neutral, active);
      const others = Object.entries(geometry.limbs)
        .filter(([name]) => name !== layer && !(limb === 'backLeg' && name === 'leg_back')
          && !(limb === 'backLeg' && name === 'leg_back_foot'))
        .map(([, stat]) => stat.maximumJointDisplacement);
      return { geometry, diff, shift: Math.hypot(b.x - a.x, b.y - a.y), maxOther: Math.max(...others) };
    }, { limb, joint, x, y, layer, direction });
    assert.ok(result.shift > 0.5 && result.maxOther < 0.001, `${limb}/${joint}/${direction}: ${JSON.stringify(result)}`);
    assert.equal(result.geometry.maximumDisplacement, 0, 'joint QA moved the body plane');
    assert.ok(result.diff.comparable && result.diff.maxDifference > 3 && result.diff.changedFraction > 0.000001,
      `${limb}/${joint}/${direction}: no rendered change ${JSON.stringify(result.diff)}`);
    for (const stat of Object.values(result.geometry.limbs)) minLimbCross = Math.min(minLimbCross, stat.minimumCellCross);
    minimumJointShift = Math.min(minimumJointShift, result.shift);
    minimumJointPixels = Math.min(minimumJointPixels, result.diff.changedFraction);
  }
  assert.ok(minLimbCross > 300, `isolated limb grid inverted or compressed: ${minLimbCross}`);
  console.log('24 isolated WebGL joint directions:', { minimumJointShift, minimumJointPixels, minLimbCross });

  const jointHitCases = [
    ['armLeft', 'raised', { shoulder: 0.02, elbow: 0.025, wrist: -0.02 }],
    ['handLeft', 'raised', { shoulder: -0.02, elbow: -0.025, wrist: 0.02 }],
    ['armRight', 'lowered', { shoulder: -0.02, elbow: -0.025, wrist: 0.03 }],
    ['handRight', 'lowered', { shoulder: 0.02, elbow: 0.025, wrist: -0.03 }],
    ['legLeft', 'frontLeg', { hip: 0.012, knee: 0.015, ankle: -0.018 }],
    ['legRight', 'backLeg', { hip: -0.012, knee: -0.015, ankle: 0.018 }],
  ];
  for (const [zone, limb, angles] of jointHitCases) {
    const hit = await page.evaluate(({ zone, limb, angles, source }) => {
      const qa = window.__HERO_QA__;
      qa.frame({ time: 0, strength: 0, jointPose: { [limb]: angles } });
      const pos = qa.sourceToClient(...source);
      return qa.zoneAtClient(pos.x, pos.y);
    }, { zone, limb, angles, source: samples[zone] });
    assert.equal(hit, zone, `${zone}: hitbox did not follow isolated ${limb} joints`);
  }
  console.log('PASS: six arm/hand/leg hitboxes follow independent joint poses.');

  if (!mobile) {
    let minCross = Infinity, maxDisplacement = 0;
    for (const time of [0, 1.2, 2.7, 5.0, 8.4]) {
      const stats = await page.evaluate(t => window.__HERO_QA__.frame({ time: t, strength: 1.5,
        contributions: [{ zone: 'hair', amount: 1 }, { zone: 'waist', amount: 1 }, { zone: 'upperTorso', amount: 1 }] }), time);
      assert.ok(stats.maximumFaceDisplacement > 0); assert.equal(stats.maximumShoeDisplacement, 0);
      minCross = Math.min(minCross, stats.minimumCellCross); maxDisplacement = Math.max(maxDisplacement, stats.maximumDisplacement);
    }
    assert.ok(minCross > 300 && maxDisplacement < 48, `mesh: ${minCross}, ${maxDisplacement}`);
    console.log('Combined V1 + reaction geometry:', { minCross, maxDisplacement });
    let minCombinedLimbCross = Infinity, maxCombinedJointDisplacement = 0;
    for (const time of [0, 0.8, 2, 4, 7]) for (const variant of [0, 1, 2]) {
      const stats = await page.evaluate(({ time, variant }) => window.__HERO_QA__.frame({ time, strength: 1.5,
        contributions: ['armLeft', 'armRight', 'legLeft', 'legRight'].map(zone =>
          ({ zone, amount: 1, followAmount: 1, lateAmount: 1, variant })) }), { time, variant });
      for (const limb of Object.values(stats.limbs)) {
        minCombinedLimbCross = Math.min(minCombinedLimbCross, limb.minimumCellCross);
        maxCombinedJointDisplacement = Math.max(maxCombinedJointDisplacement, limb.maximumJointDisplacement);
      }
    }
    assert.ok(minCombinedLimbCross > 300 && maxCombinedJointDisplacement < 60,
      `combined skins: ${minCombinedLimbCross}, ${maxCombinedJointDisplacement}`);
    console.log('15 combined arm/leg stress poses:', { minCombinedLimbCross, maxCombinedJointDisplacement });
  }

  // Check movement in the actual rendered buffer, not only controller values.
  // Expression is neutral so it cannot masquerade as a physical response.
  let smallestVisibleChange = Infinity, smallestPointShift = Infinity;
  for (const [zone, [x, y]] of Object.entries(physicalPoints)) {
    const result = await page.evaluate(({ zone, x, y, hitPoint }) => {
      const qa = window.__HERO_QA__;
      const neutral = { time: 0, strength: 1.5, blink: 0, contributions: [] };
      const active = { ...neutral, contributions: [{ zone, amount: 1, followAmount: 1, lateAmount: 1, variant: 0 }] };
      qa.frame(neutral); const a = qa.deformedSourcePoint(x, y);
      const geometry = qa.frame(active); const b = qa.deformedSourcePoint(x, y);
      const client = qa.sourceToClient(...hitPoint);
      const hit = qa.zoneAtClient(client.x, client.y);
      const difference = qa.compareFrames(neutral, active);
      return { geometry, difference, hit, pointShift: Math.hypot(b.x - a.x, b.y - a.y) };
    }, { zone, x, y, hitPoint: samples[zone] });
    assert.equal(result.hit, zone, `${zone}: hitbox did not follow deformation`);
    assert.ok(result.pointShift > 1, `${zone}: point did not move: ${JSON.stringify(result)}`);
    assert.ok(result.difference.comparable && result.difference.maxDifference > 8 && result.difference.changedFraction > 0.00005,
      `${zone}: no rendered physical change: ${JSON.stringify(result)}`);
    assert.ok(result.geometry.minimumCellCross > 300 && result.geometry.maximumShoeDisplacement === 0,
      `${zone}: geometry ${JSON.stringify(result.geometry)}`);
    smallestVisibleChange = Math.min(smallestVisibleChange, result.difference.changedFraction);
    smallestPointShift = Math.min(smallestPointShift, result.pointShift);
  }
  console.log('13 WebGL physical responses:', { smallestVisibleChange, smallestPointShift });

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
    const moving = { time: 0, strength: 1.5, blink: 0,
      contributions: [{ zone: 'head', amount: 1, followAmount: 1, lateAmount: 1, variant: 2 }] };
    const face = { name, amount: 1, ...EXPRESSIONS[name] };
    const movingExpression = await page.evaluate(([a, b]) => window.__HERO_QA__.compareFrames(a, b),
      [{ ...moving, expression: null }, { ...moving, expression: face }]);
    assert.ok(movingExpression.maxDifference > 15 && movingExpression.meanAbsoluteDifference > 0.002,
      `${name} on moving head: ${JSON.stringify(movingExpression)}`);
    const movingBlink = await page.evaluate(([a, b]) => window.__HERO_QA__.compareFrames(a, b),
      [{ ...moving, expression: face }, { ...moving, expression: face, blink: 1 }]);
    assert.ok(movingBlink.maxDifference > 10 && movingBlink.meanAbsoluteDifference > 0.005,
      `${name} blink on moving head: ${JSON.stringify(movingBlink)}`);
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

  // A synthetic multi-contact sequence checks bookkeeping in every engine;
  // Chromium's native two-finger gesture is exercised separately below.
  await page.waitForTimeout(200);
  await scrollPointIntoView(...samples.head);
  const multiContact = await page.evaluate(([x, y]) => {
    const qa = window.__HERO_QA__, canvas = document.querySelector('#animated-view canvas');
    const pos = qa.sourceToClient(x, y), before = qa.getState().reaction.count;
    const pointer = type => canvas.dispatchEvent(new PointerEvent(type, { pointerId: 93, pointerType: 'touch', isPrimary: true,
      clientX: pos.x, clientY: pos.y, bubbles: true, buttons: type === 'pointerdown' ? 1 : 0 }));
    pointer('pointerdown');
    const started = qa.pendingPointers();
    const event = (type, touches) => {
      const e = new Event(type, { bubbles: true });
      Object.defineProperties(e, { touches: { value: touches }, changedTouches: { value: [] }, targetTouches: { value: touches } });
      canvas.dispatchEvent(e);
    };
    event('touchstart', [{}, {}]);
    const afterSecondContact = qa.pendingPointers();
    pointer('pointerup'); event('touchend', []);
    return { started, afterSecondContact, after: qa.getState().reaction.count, before, pending: qa.pendingPointers() };
  }, samples.head);
  assert.deepEqual(multiContact, { started: 1, afterSecondContact: 0, after: multiContact.before, before: multiContact.before, pending: 0 },
    `multi-contact suppression: ${JSON.stringify(multiContact)}`);
  console.log('PASS: synthetic multi-contact cancellation (not a native WebKit pinch test).');
  // The synthetic touch intentionally arms Pixi's 800 ms compatibility-mouse
  // suppression; wait before exercising subsequent real desktop mouse taps.
  if (!mobile) await page.waitForTimeout(850);

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

    const pinchCenter = await scrollPointIntoView(600, 1200);
    const scaleBefore = await page.evaluate(() => visualViewport.scale);
    const countBefore = (await page.evaluate(() => window.__HERO_QA__.getState())).reaction.count;
    const points = spread => [
      { x: pinchCenter.x - spread, y: pinchCenter.y, id: 1 },
      { x: pinchCenter.x + spread, y: pinchCenter.y, id: 2 },
    ];
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(12) });
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(55) });
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(250);
    assert.ok(Math.abs((await page.evaluate(() => visualViewport.scale)) - scaleBefore) < 0.01, 'pinch starting on canvas zoomed');
    assert.equal((await page.evaluate(() => window.__HERO_QA__.getState())).reaction.count, countBefore, 'pinch generated a tap');
    assert.equal(await page.evaluate(() => window.__HERO_QA__.pendingPointers()), 0);
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(12) });
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(200);
    assert.equal((await page.evaluate(() => window.__HERO_QA__.getState())).reaction.count, countBefore, 'two-finger tap generated a reaction');
    assert.equal(await page.evaluate(() => window.__HERO_QA__.pendingPointers()), 0);
    const doubleTap = await scrollPointIntoView(...samples.head);
    await page.touchscreen.tap(doubleTap.x, doubleTap.y);
    await page.waitForTimeout(140);
    await page.touchscreen.tap(doubleTap.x, doubleTap.y);
    await page.waitForTimeout(400);
    assert.ok(Math.abs((await page.evaluate(() => visualViewport.scale)) - scaleBefore) < 0.01, 'double-tap on canvas zoomed');
    console.log('PASS: native Chromium swipe scrolls, while canvas pinch/double-tap do not zoom or create a pinch reaction.');
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
