import * as PIXI from 'pixi.js';
import { buildReactionWeights, applyReactionPose } from './reaction-motion.js';
import { composeReactionPose } from './animation/reaction-pose.js';
import { HEAD_PIVOT } from './animation/head-controller.js';
import { createHitboxes } from './pixi-hitboxes.js';
import { createExpressionLayers, loadExpressions } from './pixi-expressions.js';
import { createJointed, loadJointed } from './pixi-jointed.js';

import { SOURCE_WIDTH, SOURCE_HEIGHT, smoothstep, motionWeights, motionPhases, motionOffset,
  blinkEnvelope, automaticBlink } from './animation/idle-controller.js';
export { SOURCE_WIDTH, SOURCE_HEIGHT, smoothstep, motionWeights, motionPhases, motionOffset,
  blinkEnvelope, automaticBlink };
const COLS = 51;
const ROWS = 149;

function makeApplication(host) {
  // Layered skins increase fill cost. Cap dense touch-screen rendering at 1.5x
  // (including landscape phones) rather than 2x; desktop keeps the V1 cap.
  // Some WebKit environments expose touch events but report zero
  // maxTouchPoints (notably emulators). Do not miss their mobile size cap.
  const touchCapable = navigator.maxTouchPoints > 0 || window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  const compactTouch = touchCapable && Math.min(window.innerWidth, window.innerHeight) <= 600;
  const app = new PIXI.Application({
    width: 1,
    height: 1,
    backgroundAlpha: 0,
    antialias: true,
    autoDensity: true,
    autoStart: false,
    resolution: Math.min(window.devicePixelRatio || 1, compactTouch ? 1.5 : 2),
    powerPreference: 'high-performance',
  });
  app.stop();
  // Pixi defaults to touch-action:none. Permit deliberate vertical scrolling,
  // but do not opt this canvas into pinch/double-tap zoom; cancelled gestures
  // clear the pending Pixi tap instead of creating a reaction.
  app.renderer.events.autoPreventDefault = false;
  app.view.style.touchAction = 'pan-y';
  app.view.setAttribute('aria-hidden', 'true');
  host.appendChild(app.view);
  return app;
}

// The underpainted V3 body retains the V1 plane and its bounded smooth fields.
// Separate skinned limb meshes are projected through these very same triangles.
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

function updateMesh(rig, time, strength, pose = null) {
  const phases = motionPhases(time);
  const vertices = rig.buffer.data;
  const offset = [0, 0];
  const extra = { x: 0, y: 0 };
  for (let i = 0; i < rig.weights.length; i++) {
    const weights = rig.weights[i];
    motionOffset(weights, phases, strength, offset);
    // The idle equations remain the exact V1 equations; reaction poses are
    // composed once per frame and added without stopping breathing or hair.
    if (pose) applyReactionPose(rig.reactionWeights[i], pose, extra);
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

  const [expressionAssets, jointedAssets] = await Promise.all([
    loadExpressions(assetsBase, metadata.eyes), loadJointed(assetsBase),
  ]);
  if (jointedAssets.metadata.source_sha256 !== metadata.source_sha256
      || jointedAssets.body.width !== SOURCE_WIDTH || jointedAssets.body.height !== SOURCE_HEIGHT) {
    throw new Error('Экспериментальные части не соответствуют исходному изображению.');
  }

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
  const mesh = createMesh(jointedAssets.body);
  animatedRoot.addChild(mesh.mesh);
  const jointed = createJointed(jointedAssets, mesh, { cols: COLS, rows: ROWS, width: SOURCE_WIDTH, height: SOURCE_HEIGHT });
  // The thighs cross in one order and the shoes in the opposite order. The
  // split back shoe shares exactly the same hip/knee/ankle chain as its shin.
  for (const layer of ['leg_back', 'leg_front', 'leg_back_foot', 'arm_down']) {
    animatedRoot.addChild(jointed.skins[layer].mesh);
  }
  // Face expressions are behind the genuinely separate raised hand, so that
  // its source-derived fingers still overlap the face when the hand moves.
  const faceRoot = new PIXI.Container();
  animatedRoot.addChild(faceRoot);
  const expressions = createExpressionLayers(faceRoot, expressionAssets, metadata.eyes);
  const eyes = metadata.eyes.map(eye => createEye(faceRoot, eye, eyeTextures));
  expressions.attachForeground();
  animatedRoot.addChild(jointed.skins.arm_raised.mesh);
  jointed.update(0, 0);
  const hitboxes = createHitboxes(animatedRoot, mesh, {
    cols: COLS, rows: ROWS, width: SOURCE_WIDTH, height: SOURCE_HEIGHT, debug, onTap,
    deformZonePoint: jointed.zonePoint,
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

  let currentPose = null;
  function render(time, strength, blink, { contributions = [], expression = null, jointPose = null } = {}) {
    currentPose = contributions.length && strength > 0 ? composeReactionPose(contributions, strength) : null;
    updateMesh(mesh, time, strength, currentPose);
    jointed.update(time, strength, contributions, jointPose);
    const head = currentPose?.head;
    if (head && (head.x || head.y || head.rotation || head.scaleDelta)) {
      faceRoot.pivot.set(HEAD_PIVOT.x, HEAD_PIVOT.y);
      faceRoot.position.set(HEAD_PIVOT.x + head.x, HEAD_PIVOT.y + head.y);
      faceRoot.rotation = head.rotation;
      faceRoot.scale.set(head.scale);
    } else {
      // Preserve the original neutral transform and V1 pixel parity.
      faceRoot.pivot.set(0, 0);
      faceRoot.position.set(0, 0);
      faceRoot.rotation = 0;
      faceRoot.scale.set(1);
    }
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
    let maximumFeetDisplacement = 0; // legacy QA name: all pixels at y >= 1950
    let maximumShoeDisplacement = 0; // y >= 3300 stays anchored during leg shifts
    let minimumCellCross = Infinity;
    for (let i = 0; i < mesh.weights.length; i++) {
      const dx = points[i * 2] - mesh.base[i * 2];
      const dy = points[i * 2 + 1] - mesh.base[i * 2 + 1];
      const displacement = Math.hypot(dx, dy);
      maximumDisplacement = Math.max(maximumDisplacement, displacement);
      if (mesh.base[i * 2 + 1] <= 610) maximumFaceDisplacement = Math.max(maximumFaceDisplacement, displacement);
      if (mesh.base[i * 2 + 1] >= 1950) maximumFeetDisplacement = Math.max(maximumFeetDisplacement, displacement);
      if (mesh.base[i * 2 + 1] >= 3300) maximumShoeDisplacement = Math.max(maximumShoeDisplacement, displacement);
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
    return { maximumDisplacement, maximumFaceDisplacement, maximumFeetDisplacement, maximumShoeDisplacement,
      minimumCellCross, limbs: jointed.geometryStats() };
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

  return { render, setView, geometryStats, comparePixels, compareFrames, sourceToClient, zoneAtClient,
    deformedSourcePoint: (x, y) => hitboxes.toLocal(x, y), pose: () => currentPose,
    jointAngles: () => jointed.angles(), limbPoint: jointed.point,
    hitboxes, metadata, originalApp, animatedApp };
}
