import * as PIXI from 'pixi.js';
import { buildReactionWeights, reactionOffset } from './reaction-motion.js';
import { createHitboxes } from './pixi-hitboxes.js';
import { createExpressionLayers, loadExpressions } from './pixi-expressions.js';

export const SOURCE_WIDTH = 1184;
export const SOURCE_HEIGHT = 3488;
const COLS = 51;
const ROWS = 149;

const clamp01 = value => Math.max(0, Math.min(1, value));
export function smoothstep(a, b, value) {
  const x = clamp01((value - a) / (b - a));
  return x * x * (3 - 2 * x);
}
const bell = (value, center, width) => Math.exp(-0.5 * ((value - center) / width) ** 2);

export function motionWeights(x, y) {
  const edge = smoothstep(0, 90, x) * (1 - smoothstep(SOURCE_WIDTH - 90, SOURCE_WIDTH, x));
  const torso = bell(y, 910, 230) * bell(x, 590, 390) * smoothstep(610, 760, y)
    * (1 - smoothstep(1350, 1600, y)) * edge;
  const side = smoothstep(245, 415, Math.abs(x - 592));
  const hair = side * smoothstep(675, 900, y) * (1 - smoothstep(1430, 1600, y)) * edge;
  const cloth = bell(y, 1650, 170) * bell(x, 590, 440)
    * smoothstep(1260, 1420, y) * (1 - smoothstep(1810, 1950, y)) * edge;
  return { x, y, torso, hair, cloth };
}

export function motionPhases(time) {
  return {
    breath: Math.sin(time * Math.PI * 2 / 4.8),
    hair: Math.sin(time * Math.PI * 2 / 6.2),
    cloth: Math.sin(time * Math.PI * 2 / 7.4),
  };
}

export function motionOffset(weights, phases, strength, result = [0, 0]) {
  const { x, torso, hair, cloth } = weights;
  result[0] = ((x - 590) * 0.014 * torso * phases.breath + 10 * hair * phases.hair + 5 * cloth * phases.cloth) * strength;
  result[1] = (-8 * torso * phases.breath + 2.8 * hair * phases.hair - 3.0 * cloth * phases.cloth) * strength;
  return result;
}

// One blink is a continuous short close, hold and release. No full-frame swaps.
export function blinkEnvelope(elapsed) {
  const close = 0.16;
  const hold = 0.055;
  const open = 0.205;
  if (elapsed < 0 || elapsed >= close + hold + open) return 0;
  if (elapsed < close) return smoothstep(0, close, elapsed);
  if (elapsed < close + hold) return 1;
  return 1 - smoothstep(0, open, elapsed - close - hold);
}

export function automaticBlink(time) {
  const cycle = time % 18.4;
  // A long, gently irregular sequence, including one occasional double blink.
  return Math.max(...[2.35, 6.95, 7.45, 13.2].map(start => blinkEnvelope(cycle - start)));
}

function makeApplication(host) {
  const app = new PIXI.Application({
    width: 1,
    height: 1,
    backgroundAlpha: 0,
    antialias: true,
    autoDensity: true,
    autoStart: false,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    powerPreference: 'high-performance',
  });
  app.stop();
  // Pixi defaults to touch-action:none. Restore native scrolling/pinch and
  // let a cancelled gesture clear the pending Pixi tap rather than firing it.
  app.renderer.events.autoPreventDefault = false;
  app.view.style.touchAction = 'manipulation';
  app.view.setAttribute('aria-hidden', 'true');
  host.appendChild(app.view);
  return app;
}

// The flat approved illustration is one mesh. Local, smoothly weighted fields
// keep the face and feet immobile while gently moving the torso and silhouette.
function createMesh(texture) {
  const mesh = new PIXI.SimplePlane(texture, COLS, ROWS);
  const buffer = mesh.geometry.getBuffer('aVertexPosition');
  const base = Float32Array.from(buffer.data);
  const weights = [];
  const reactionWeights = [];
  for (let i = 0; i < base.length; i += 2) {
    weights.push(motionWeights(base[i], base[i + 1]));
    reactionWeights.push(buildReactionWeights(base[i], base[i + 1]));
  }
  return { mesh, buffer, base, weights, reactionWeights };
}

function updateMesh(rig, time, strength, contributions = []) {
  const phases = motionPhases(time);
  const vertices = rig.buffer.data;
  const offset = [0, 0];
  const extra = { x: 0, y: 0 };
  for (let i = 0; i < rig.weights.length; i++) {
    const weights = rig.weights[i];
    motionOffset(weights, phases, strength, offset);
    // No-reaction branch uses the byte-for-byte V1 equations above.
    if (contributions.length) reactionOffset(rig.reactionWeights[i], contributions, strength, extra);
    vertices[i * 2] = weights.x + offset[0] + extra.x;
    vertices[i * 2 + 1] = weights.y + offset[1] + extra.y;
  }
  rig.buffer.update();
}

function createEye(parent, eye, textures) {
  const [x0, y0] = eye.box;
  const [cx, cy] = eye.pivot;
  const group = new PIXI.Container();
  group.visible = false;
  parent.addChild(group);

  const underpaint = new PIXI.Sprite(textures[`${eye.name}_underpaint`]);
  underpaint.position.set(x0, y0);
  group.addChild(underpaint);
  const closed = new PIXI.Sprite(textures[`${eye.name}_closed`]);
  closed.position.set(x0, y0);
  group.addChild(closed);

  // R(angle) × scaleY × R(-angle): close along each tilted eye's own axis.
  // The source's eye pixels remain the open state; the separate underpaint and
  // closed lash patch are experimental derivatives, not whole new portraits.
  const rotate = new PIXI.Container();
  rotate.position.set(cx, cy);
  rotate.rotation = eye.angle;
  const squash = new PIXI.Container();
  const unrotate = new PIXI.Container();
  unrotate.rotation = -eye.angle;
  const open = new PIXI.Sprite(textures[`${eye.name}_open`]);
  open.position.set(x0 - cx, y0 - cy);
  group.addChild(rotate);
  rotate.addChild(squash);
  squash.addChild(unrotate);
  unrotate.addChild(open);
  return { group, closed, open, squash };
}

function updateEye(eye, amount) {
  eye.group.visible = amount > 0;
  if (!eye.group.visible) return;
  // Fade in the overlapping skin patch at the start/end to avoid a seam pop.
  eye.group.alpha = smoothstep(0, 0.06, amount);
  eye.squash.scale.y = Math.max(0.02, 1 - amount * 0.98);
  // Only a brief transition near full closure uses the aligned closed lash art.
  eye.closed.alpha = smoothstep(0.65, 0.84, amount);
  eye.open.alpha = 1 - smoothstep(0.65, 0.84, amount);
}

function fit(root, width, height, view) {
  let scale;
  let centerX;
  let centerY;
  let screenCenterY = height / 2;
  if (view === 'face') {
    // Same centered crop for both panes. On narrow screens favor the eyes,
    // rather than leaving most of the tall viewport as empty background.
    const narrow = width < 300;
    scale = narrow
      ? Math.min(width * 0.96 / 445, height * 0.84 / 600)
      : Math.min(width * 0.93 / 610, height * 0.82 / 610);
    centerX = 585;
    centerY = 325;
    if (narrow) screenCenterY = height * 0.44;
  } else {
    scale = Math.min((width - 26) / SOURCE_WIDTH, (height - 26) / SOURCE_HEIGHT);
    centerX = SOURCE_WIDTH / 2;
    centerY = SOURCE_HEIGHT / 2;
  }
  root.scale.set(scale);
  root.position.set(width / 2 - centerX * scale, screenCenterY - centerY * scale);
}

export async function createStage(originalHost, animatedHost, sourceUrl, assetsBase, { debug = false, onTap = () => {} } = {}) {
  // Load the original and the tiny eye derivatives once; both panes use the same texture.
  const response = await fetch(`${assetsBase}derived/rig.json`);
  if (!response.ok) throw new Error('Не удалось загрузить параметры экспериментального рига.');
  const metadata = await response.json();
  const texture = await PIXI.Assets.load(sourceUrl);
  // The artwork is much larger than the full-body viewport. WebGL2 mipmaps
  // prevent sparkling / jagged details during motion; Pixi safely falls back
  // for non-power-of-two textures in WebGL1.
  texture.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON;
  if (texture.width !== SOURCE_WIDTH || texture.height !== SOURCE_HEIGHT) {
    throw new Error('Размер исходного утверждённого изображения изменился.');
  }
  const eyeTextures = {};
  await Promise.all(metadata.eyes.flatMap(eye => ['open', 'underpaint', 'closed'].map(async layer => {
    const key = `${eye.name}_${layer}`;
    eyeTextures[key] = await PIXI.Assets.load(`${assetsBase}derived/eye_${eye.name}_${layer}.png`);
  })));

  const expressionAssets = await loadExpressions(assetsBase, metadata.eyes);

  const originalApp = makeApplication(originalHost);
  let animatedApp;
  try {
    animatedApp = makeApplication(animatedHost);
  } catch (error) {
    originalApp.destroy(true);
    throw error;
  }
  const originalRoot = new PIXI.Container();
  originalApp.stage.addChild(originalRoot);
  originalRoot.addChild(new PIXI.Sprite(texture));

  const animatedRoot = new PIXI.Container();
  animatedApp.stage.addChild(animatedRoot);
  const mesh = createMesh(texture);
  animatedRoot.addChild(mesh.mesh);
  const expressions = createExpressionLayers(animatedRoot, expressionAssets, metadata.eyes);
  const eyes = metadata.eyes.map(eye => createEye(animatedRoot, eye, eyeTextures));
  expressions.attachForeground();
  const hitboxes = createHitboxes(animatedRoot, mesh, {
    cols: COLS, rows: ROWS, width: SOURCE_WIDTH, height: SOURCE_HEIGHT, debug, onTap,
  });

  let view = 'body';
  function resize() {
    for (const [host, app, root] of [[originalHost, originalApp, originalRoot], [animatedHost, animatedApp, animatedRoot]]) {
      const width = Math.max(1, Math.round(host.clientWidth));
      const height = Math.max(1, Math.round(host.clientHeight));
      app.renderer.resize(width, height);
      fit(root, width, height, view);
    }
    originalApp.renderer.render(originalApp.stage);
    animatedApp.renderer.render(animatedApp.stage);
  }
  const observer = new ResizeObserver(resize);
  observer.observe(originalHost);
  observer.observe(animatedHost);
  resize();

  function render(time, strength, blink, { contributions = [], expression = null } = {}) {
    updateMesh(mesh, time, strength, contributions);
    eyes.forEach(eye => updateEye(eye, blink));
    expressions.update(expression, blink);
    hitboxes.update();
    animatedApp.renderer.render(animatedApp.stage);
  }
  function zoneAtClient(x, y) {
    const rect = animatedApp.view.getBoundingClientRect();
    const screenX = (x - rect.left) * animatedApp.screen.width / rect.width;
    const screenY = (y - rect.top) * animatedApp.screen.height / rect.height;
    const boundary = animatedApp.renderer.events.rootBoundary;
    boundary.rootTarget ||= animatedApp.stage;
    return boundary.hitTest(screenX, screenY)?.name || null;
  }
  function sourceToClient(x, y) {
    const point = hitboxes.toLocal(x, y);
    const global = animatedRoot.toGlobal(new PIXI.Point(point.x, point.y));
    const rect = animatedApp.view.getBoundingClientRect();
    return { x: rect.left + global.x * rect.width / animatedApp.screen.width,
      y: rect.top + global.y * rect.height / animatedApp.screen.height };
  }
  function setView(nextView) {
    view = nextView;
    resize();
  }
  function geometryStats() {
    const points = mesh.buffer.data;
    let maximumDisplacement = 0;
    let maximumFaceDisplacement = 0;
    let maximumFeetDisplacement = 0;
    let minimumCellCross = Infinity;
    for (let i = 0; i < mesh.weights.length; i++) {
      const dx = points[i * 2] - mesh.base[i * 2];
      const dy = points[i * 2 + 1] - mesh.base[i * 2 + 1];
      const displacement = Math.hypot(dx, dy);
      maximumDisplacement = Math.max(maximumDisplacement, displacement);
      if (mesh.base[i * 2 + 1] <= 610) maximumFaceDisplacement = Math.max(maximumFaceDisplacement, displacement);
      if (mesh.base[i * 2 + 1] >= 1950) maximumFeetDisplacement = Math.max(maximumFeetDisplacement, displacement);
      if (i % COLS < COLS - 1 && i < COLS * (ROWS - 1)) {
        const right = i + 1;
        const down = i + COLS;
        const cross = (points[right * 2] - points[i * 2]) * (points[down * 2 + 1] - points[i * 2 + 1])
          - (points[right * 2 + 1] - points[i * 2 + 1]) * (points[down * 2] - points[i * 2]);
        const diagonal = i + COLS + 1;
        const cross2 = (points[diagonal * 2] - points[right * 2]) * (points[down * 2 + 1] - points[right * 2 + 1])
          - (points[diagonal * 2 + 1] - points[right * 2 + 1]) * (points[down * 2] - points[right * 2]);
        minimumCellCross = Math.min(minimumCellCross, cross, cross2);
      }
    }
    return { maximumDisplacement, maximumFaceDisplacement, maximumFeetDisplacement, minimumCellCross };
  }
  // Opt-in visual QA reads the actual WebGL output, not a mock of the rig.
  function readPixels(app) {
    app.renderer.render(app.stage);
    const gl = app.renderer.gl;
    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    return { pixels, width, height };
  }
  function compareBuffers(a, b) {
    if (a.width !== b.width || a.height !== b.height) return { comparable: false, sizes: [a.width, a.height, b.width, b.height] };
    let sum = 0;
    let max = 0;
    let changed = 0;
    let nonTransparentA = 0;
    let nonTransparentB = 0;
    for (let i = 0; i < a.pixels.length; i += 4) {
      if (a.pixels[i + 3]) nonTransparentA++;
      if (b.pixels[i + 3]) nonTransparentB++;
      let pixelChanged = false;
      for (let j = 0; j < 4; j++) {
        const diff = Math.abs(a.pixels[i + j] - b.pixels[i + j]);
        sum += diff;
        max = Math.max(max, diff);
        pixelChanged ||= diff > 0;
      }
      if (pixelChanged) changed++;
    }
    return { comparable: true, meanAbsoluteDifference: sum / a.pixels.length, maxDifference: max,
      changedFraction: changed / (a.width * a.height), nonTransparentA, nonTransparentB,
      width: a.width, height: a.height };
  }
  function comparePixels() {
    return compareBuffers(readPixels(originalApp), readPixels(animatedApp));
  }
  function compareFrames(first, second) {
    render(first.time, first.strength, first.blink, first);
    const a = readPixels(animatedApp);
    render(second.time, second.strength, second.blink, second);
    const b = readPixels(animatedApp);
    return compareBuffers(a, b);
  }

  return { render, setView, geometryStats, comparePixels, compareFrames, sourceToClient, zoneAtClient, hitboxes, metadata, originalApp, animatedApp };
}
