import * as PIXI from 'pixi.js';

export const SOURCE_WIDTH = 1184;
export const SOURCE_HEIGHT = 3488;
export const MESH_STEP = 16;
// Keep a 16px grid only where the separately matted strands must share exact
// vertices with the original mesh. Elsewhere, use a lighter nonuniform grid;
// static head/legs need no extra tessellation at all.
const sequence = (start, end, step) => Array.from({ length: (end - start) / step + 1 }, (_, i) => start + i * step);
export const MESH_X = [...sequence(0, 128, 16), ...sequence(160, 1056, 32),
  ...sequence(1072, 1152, 16), SOURCE_WIDTH];
export const MESH_Y = [...sequence(0, 512, 128), 608, ...sequence(640, 1280, 32),
  ...sequence(1296, 1488, 16), ...sequence(1520, 1936, 32), 1952, ...sequence(2080, SOURCE_HEIGHT, 128)];
export const COLS = MESH_X.length;
export const ROWS = MESH_Y.length;
export const BLINK_DURATION = 0.37;

const clamp01 = value => Math.max(0, Math.min(1, value));
export function smoothstep(a, b, value) {
  const x = clamp01((value - a) / (b - a));
  return x * x * (3 - 2 * x);
}
const bell = (value, center, width) => Math.exp(-0.5 * ((value - center) / width) ** 2);
const cycle = (time, period) => ((time % period) + period) % period;

// Inhale is shorter than exhale, followed by a small resting beat. At the loop
// boundaries the value and its velocity are both zero rather than jumping.
export function breathAt(time) {
  const p = cycle(time, 5.6) / 5.6;
  return smoothstep(0.025, 0.35, p) * (1 - smoothstep(0.41, 0.9, p));
}

export function motionWeights(x, y) {
  const edge = smoothstep(0, 75, x) * (1 - smoothstep(SOURCE_WIDTH - 75, SOURCE_WIDTH, x));
  const upper = smoothstep(610, 720, y);
  const cutoff = 1 - smoothstep(1820, 1950, y);
  const torso = bell(y, 910, 190) * bell(x, 590, 285) * upper * (1 - smoothstep(1110, 1280, y));
  const shoulder = bell(y, 737, 95) * bell(x, 590, 315) * upper * (1 - smoothstep(850, 940, y));
  const apron = bell(y, 1400, 230) * bell(x, 590, 240) * smoothstep(1110, 1200, y) * cutoff;
  const hem = bell(y, 1660, 125) * bell(x, 590, 380) * smoothstep(1370, 1500, y) * cutoff;
  const hairBand = smoothstep(790, 1040, y) * (1 - smoothstep(1450, 1560, y)) * edge;
  // Four spatial fields have different phases. They follow distinct sides and
  // locks; unlike V1, the left and right masses do not sway in unison.
  const leftInner = hairBand * bell(x, 205 - (y - 1000) * 0.05, 51);
  const leftOuter = hairBand * bell(x, 100 - (y - 1100) * 0.10, 24);
  const rightInner = hairBand * bell(x, 1005 + (y - 950) * 0.08, 33);
  const rightOuter = hairBand * bell(x, 1110 - (y - 1100) * 0.05, 25);
  return { x, y, torso, shoulder, apron, hem, leftInner, leftOuter, rightInner, rightOuter };
}

export function motionPhases(time) {
  const wave = (period, second) => 0.82 * Math.sin(time * 2 * Math.PI / period)
    + 0.18 * Math.sin(time * 2 * Math.PI / second);
  return {
    breath: breathAt(time),
    clothBreath: breathAt(time - 0.14),
    hem: wave(8.5, 13.7),
    leftInner: wave(8.7, 13.2),
    leftOuter: wave(6.6, 10.7),
    rightInner: wave(10.1, 15.8),
    rightOuter: wave(7.5, 12.1),
    leftStrand: wave(5.7, 9.9),
    rightStrand: wave(7.9, 12.8),
  };
}

export function motionOffset(weights, phases, strength, result = [0, 0]) {
  const { x, torso, shoulder, apron, hem, leftInner, leftOuter, rightInner, rightOuter } = weights;
  const breathX = (x - 590) * 0.007 * torso * phases.breath;
  const hairX = 3.4 * leftInner * phases.leftInner + 4.0 * leftOuter * phases.leftOuter
    - 3.2 * rightInner * phases.rightInner - 3.6 * rightOuter * phases.rightOuter;
  const clothX = (x - 590) * 0.0024 * apron * phases.clothBreath + 1.2 * hem * phases.hem;
  result[0] = (breathX + hairX + clothX) * strength;
  result[1] = (-4.2 * torso * phases.breath - 1.4 * shoulder * phases.breath
    - 1.8 * apron * phases.clothBreath + 0.8 * hem * phases.hem
    + 0.65 * leftInner * phases.leftInner + 0.55 * rightInner * phases.rightInner) * strength;
  return result;
}

export function strandBend(y, anchors, amplitude, phase, strength) {
  const [start, end] = anchors;
  const position = clamp01((y - start) / (end - start));
  return Math.sin(Math.PI * position) ** 2 * amplitude * phase * strength;
}

// A brisk close, tiny hold, and a softer, slightly longer reopening.
export function blinkEnvelope(elapsed) {
  const close = 0.135;
  const hold = 0.035;
  const open = BLINK_DURATION - close - hold;
  if (elapsed < 0 || elapsed >= BLINK_DURATION) return 0;
  if (elapsed < close) return smoothstep(0, close, elapsed);
  if (elapsed < close + hold) return 1;
  return 1 - smoothstep(0, open, elapsed - close - hold);
}

// Stable jitter is generated once per 48-second block, not once per frame. The
// deliberate short pair reads as a natural occasional double blink.
export function blinkSchedule(block) {
  const starts = [2.8, 7.1, 12.5, 18.0, 18.52, 24.8, 30.7, 36.2, 42.9];
  return starts.map((time, index) => {
    // The two members of the occasional double share one jitter value.
    const seedIndex = index === 4 ? 3 : index;
    const seed = Math.sin((block + 1) * 12.9898 + seedIndex * 78.233) * 43758.5453;
    return time + (seed - Math.floor(seed) - 0.5) * 0.6;
  });
}

export function automaticBlink(time) {
  const block = Math.floor(Math.max(0, time) / 48);
  const local = cycle(Math.max(0, time), 48);
  return Math.max(...blinkSchedule(block).map(start => blinkEnvelope(local - start)));
}

function makeApplication(host) {
  const app = new PIXI.Application({
    width: 1, height: 1, backgroundAlpha: 0, antialias: true, autoDensity: true,
    autoStart: false, resolution: Math.min(window.devicePixelRatio || 1, 2),
    powerPreference: 'high-performance',
  });
  app.stop();
  app.view.setAttribute('aria-hidden', 'true');
  host.appendChild(app.view);
  return app;
}

function createPlane(texture, box = [0, 0, SOURCE_WIDTH, SOURCE_HEIGHT]) {
  const [x0, y0, x1, y1] = box;
  // Every patch vertex is present in the main grid, with identical diagonals.
  const xs = MESH_X.filter(x => x >= x0 && x <= x1);
  const ys = MESH_Y.filter(y => y >= y0 && y <= y1);
  if (xs[0] !== x0 || xs[xs.length - 1] !== x1 || ys[0] !== y0 || ys[ys.length - 1] !== y1) {
    throw new Error('Motion mesh is not aligned');
  }
  const cols = xs.length, rows = ys.length;
  const vertices = new Float32Array(cols * rows * 2);
  const uvs = new Float32Array(vertices.length);
  const indices = new Uint16Array((cols - 1) * (rows - 1) * 6);
  const active = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const i = row * cols + col, x = xs[col], y = ys[row];
      vertices[i * 2] = x - x0;
      vertices[i * 2 + 1] = y - y0;
      uvs[i * 2] = (x - x0) / (x1 - x0);
      uvs[i * 2 + 1] = (y - y0) / (y1 - y0);
      if (y > 610 && y < 1950) active.push({ index: i, weights: motionWeights(x, y) });
      if (row < rows - 1 && col < cols - 1) {
        const k = (row * (cols - 1) + col) * 6;
        indices.set([i, i + 1, i + cols, i + 1, i + cols + 1, i + cols], k);
      }
    }
  }
  const geometry = new PIXI.MeshGeometry(vertices, uvs, indices);
  const mesh = new PIXI.Mesh(geometry, new PIXI.MeshMaterial(texture));
  mesh.position.set(x0, y0);
  const buffer = geometry.getBuffer('aVertexPosition');
  return { mesh, buffer, base: Float32Array.from(vertices), active, cols, rows, box };
}

function updatePlane(rig, phases, strength, strand = null) {
  const vertices = rig.buffer.data;
  const offset = [0, 0];
  let maximumIndependent = 0;
  for (const { index, weights } of rig.active) {
    motionOffset(weights, phases, strength, offset);
    let extra = 0;
    if (strand) {
      const phase = strand.name === 'left' ? phases.leftStrand : phases.rightStrand;
      extra = strandBend(weights.y, strand.anchors, strand.amplitude, phase, strength);
      maximumIndependent = Math.max(maximumIndependent, Math.abs(extra));
    }
    vertices[index * 2] = rig.base[index * 2] + offset[0] + extra;
    vertices[index * 2 + 1] = rig.base[index * 2 + 1] + offset[1];
  }
  rig.buffer.update();
  return maximumIndependent;
}

function createStrand(parent, info, textures) {
  const restore = createPlane(textures.restore, info.box);
  const strand = createPlane(textures.strand, info.box);
  parent.addChild(restore.mesh, strand.mesh);
  return { info, restore, strand, maximumIndependent: 0 };
}

function createEye(parent, info, atlas) {
  const [x0, y0, x1, y1] = info.box;
  const [cellWidth, cellHeight] = info.cell;
  const width = x1 - x0;
  const height = y1 - y0;
  const frames = Array.from({ length: info.frames }, (_, index) => new PIXI.Texture(atlas.baseTexture,
    new PIXI.Rectangle((index % info.columns) * cellWidth + info.padding,
      Math.floor(index / info.columns) * cellHeight + info.padding, width, height)));
  const group = new PIXI.Container();
  group.position.set(x0, y0);
  group.visible = false;
  const first = new PIXI.Sprite(frames[0]);
  const second = new PIXI.Sprite(frames[0]);
  group.addChild(first, second);
  parent.addChild(group);
  return { group, frames, first, second };
}

function updateEye(eye, amount) {
  eye.group.visible = amount > 0.00001;
  if (!eye.group.visible) return;
  const frame = clamp01(amount) * (eye.frames.length - 1);
  const index = Math.min(eye.frames.length - 1, Math.floor(frame));
  const next = Math.min(eye.frames.length - 1, index + 1);
  eye.first.texture = eye.frames[index];
  eye.second.texture = eye.frames[next];
  eye.second.alpha = frame - index;
}

function fit(root, width, height, view) {
  let scale;
  let centerX;
  let centerY;
  let screenCenterY = height / 2;
  if (view === 'face') {
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

export async function createStage(originalHost, animatedHost, sourceUrl, assetsBase) {
  const response = await fetch(`${assetsBase}derived/rig-v2.json`);
  if (!response.ok) throw new Error('Не удалось загрузить параметры экспериментального рига V2.');
  const metadata = await response.json();
  const texture = await PIXI.Assets.load(sourceUrl);
  texture.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON;
  if (texture.width !== SOURCE_WIDTH || texture.height !== SOURCE_HEIGHT) {
    throw new Error('Размер исходного утверждённого изображения изменился.');
  }
  const [strandTextures, eyeTextures] = await Promise.all([
    Promise.all(metadata.strands.map(async strand => {
      const [restore, isolated] = await Promise.all(['restore', 'strand'].map(layer =>
        PIXI.Assets.load(`${assetsBase}derived/hair_${strand.name}_${layer}.png`)));
      restore.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON;
      isolated.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON;
      return { restore, strand: isolated };
    })),
    Promise.all(metadata.eyes.map(eye => PIXI.Assets.load(`${assetsBase}derived/blink_${eye.name}_atlas.png`))),
  ]);
  const originalApp = makeApplication(originalHost);
  let animatedApp;
  try { animatedApp = makeApplication(animatedHost); }
  catch (error) { originalApp.destroy(true); throw error; }

  const originalRoot = new PIXI.Container();
  originalApp.stage.addChild(originalRoot);
  originalRoot.addChild(new PIXI.Sprite(texture));
  const animatedRoot = new PIXI.Container();
  animatedApp.stage.addChild(animatedRoot);
  const mesh = createPlane(texture);
  animatedRoot.addChild(mesh.mesh);
  const strands = metadata.strands.map((info, index) => createStrand(animatedRoot, info, strandTextures[index]));
  const eyes = metadata.eyes.map((info, index) => createEye(animatedRoot, info, eyeTextures[index]));

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

  function render(time, strength, blink, independentStrands = true) {
    const phases = motionPhases(time);
    updatePlane(mesh, phases, strength);
    for (const strand of strands) {
      updatePlane(strand.restore, phases, strength);
      strand.maximumIndependent = updatePlane(strand.strand, phases, strength, independentStrands ? strand.info : null);
    }
    eyes.forEach(eye => updateEye(eye, blink));
    animatedApp.renderer.render(animatedApp.stage);
  }
  function setView(nextView) { view = nextView; resize(); }
  function geometryStats() {
    const points = mesh.buffer.data;
    let maximumDisplacement = 0;
    let maximumFaceDisplacement = 0;
    let maximumFeetDisplacement = 0;
    let minimumCellCross = Infinity;
    for (let i = 0; i < mesh.base.length / 2; i++) {
      const dx = points[i * 2] - mesh.base[i * 2];
      const dy = points[i * 2 + 1] - mesh.base[i * 2 + 1];
      const displacement = Math.hypot(dx, dy);
      maximumDisplacement = Math.max(maximumDisplacement, displacement);
      if (mesh.base[i * 2 + 1] <= 610) maximumFaceDisplacement = Math.max(maximumFaceDisplacement, displacement);
      if (mesh.base[i * 2 + 1] >= 1950) maximumFeetDisplacement = Math.max(maximumFeetDisplacement, displacement);
      if (i % COLS < COLS - 1 && i < COLS * (ROWS - 1)) {
        const right = i + 1, down = i + COLS, diagonal = i + COLS + 1;
        const cross = (points[right * 2] - points[i * 2]) * (points[down * 2 + 1] - points[i * 2 + 1])
          - (points[right * 2 + 1] - points[i * 2 + 1]) * (points[down * 2] - points[i * 2]);
        const cross2 = (points[diagonal * 2] - points[right * 2]) * (points[down * 2 + 1] - points[right * 2 + 1])
          - (points[diagonal * 2 + 1] - points[right * 2 + 1]) * (points[down * 2] - points[right * 2]);
        minimumCellCross = Math.min(minimumCellCross, cross, cross2);
      }
    }
    return { maximumDisplacement, maximumFaceDisplacement, maximumFeetDisplacement, minimumCellCross,
      independentStrands: Object.fromEntries(strands.map(strand => [strand.info.name, strand.maximumIndependent])) };
  }
  function readPixels(app) {
    app.renderer.render(app.stage);
    const gl = app.renderer.gl;
    const width = gl.drawingBufferWidth, height = gl.drawingBufferHeight;
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    return { pixels, width, height };
  }
  function compareBuffers(a, b) {
    if (a.width !== b.width || a.height !== b.height) return { comparable: false, sizes: [a.width, a.height, b.width, b.height] };
    let sum = 0, max = 0, changed = 0, nonTransparentA = 0, nonTransparentB = 0;
    for (let i = 0; i < a.pixels.length; i += 4) {
      if (a.pixels[i + 3]) nonTransparentA++;
      if (b.pixels[i + 3]) nonTransparentB++;
      let pixelChanged = false;
      for (let j = 0; j < 4; j++) {
        const diff = Math.abs(a.pixels[i + j] - b.pixels[i + j]);
        sum += diff; max = Math.max(max, diff); pixelChanged ||= diff > 0;
      }
      if (pixelChanged) changed++;
    }
    return { comparable: true, meanAbsoluteDifference: sum / a.pixels.length, maxDifference: max,
      changedFraction: changed / (a.width * a.height), nonTransparentA, nonTransparentB,
      width: a.width, height: a.height };
  }
  function comparePixels() { return compareBuffers(readPixels(originalApp), readPixels(animatedApp)); }
  function compareFrames(first, second) {
    render(first.time, first.strength, first.blink, first.independentStrands ?? true);
    const a = readPixels(animatedApp);
    render(second.time, second.strength, second.blink, second.independentStrands ?? true);
    return compareBuffers(a, readPixels(animatedApp));
  }
  function debugFocus(x, y, scale) {
    animatedRoot.scale.set(scale);
    animatedRoot.position.set(animatedHost.clientWidth / 2 - x * scale, animatedHost.clientHeight / 2 - y * scale);
  }
  return { render, setView, geometryStats, comparePixels, compareFrames, debugFocus, metadata, originalApp, animatedApp };
}
