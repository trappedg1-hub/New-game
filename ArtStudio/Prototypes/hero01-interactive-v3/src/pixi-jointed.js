import * as PIXI from 'pixi.js';
import { deformedPoint } from './pixi-hitboxes.js';
import { composeJoints, jointMatrices, limbWeights, skinPoint } from './animation/jointed-rig.js';

// The skin grids are snapped to the same source-space cells as the V1 body
// plane. At rest they therefore share its triangles exactly, including idle
// and reaction deformation. Textures are cropped, not full-size duplicates.
function makeSkin(texture, box, name, { cols: bodyCols, rows: bodyRows, width, height }) {
  const [x0, y0, textureWidth, textureHeight] = box;
  const sx = width / (bodyCols - 1), sy = height / (bodyRows - 1);
  const firstCol = Math.max(0, Math.floor(x0 / sx));
  const firstRow = Math.max(0, Math.floor(y0 / sy));
  const lastCol = Math.min(bodyCols - 1, Math.ceil((x0 + textureWidth) / sx));
  const lastRow = Math.min(bodyRows - 1, Math.ceil((y0 + textureHeight) / sy));
  const cols = lastCol - firstCol + 1, rows = lastRow - firstRow + 1;
  const mesh = new PIXI.SimplePlane(texture, cols, rows);
  mesh.eventMode = 'none';
  const buffer = mesh.geometry.getBuffer('aVertexPosition');
  const uvBuffer = mesh.geometry.getBuffer('aTextureCoord');
  const base = new Float32Array(buffer.data.length);
  const bodyIndices = new Uint32Array(cols * rows);
  const weights = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const i = row * cols + col, x = (firstCol + col) * sx, y = (firstRow + row) * sy;
      base[i * 2] = x; base[i * 2 + 1] = y;
      bodyIndices[i] = ((firstRow + row) * bodyCols + firstCol + col) * 2;
      uvBuffer.data[i * 2] = (x - x0) / textureWidth;
      uvBuffer.data[i * 2 + 1] = (y - y0) / textureHeight;
      weights.push(limbWeights(name, x, y));
    }
  }
  uvBuffer.update();
  return { mesh, buffer, base, bodyIndices, weights, cols, rows, firstCol, firstRow, sx, sy, name };
}

export async function loadJointed(assetsBase) {
  const root = `${assetsBase}derived/jointed/`;
  const response = await fetch(`${root}jointed.json`);
  if (!response.ok) throw new Error('Не удалось загрузить параметры суставного рига.');
  const metadata = await response.json();
  const entries = Object.entries(metadata.layers);
  const loaded = await Promise.all([PIXI.Assets.load(`${root}${metadata.body}`),
    ...entries.map(([, item]) => PIXI.Assets.load(`${root}${item.file}`))]);
  for (const texture of loaded) texture.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON;
  return { metadata, body: loaded[0], textures: Object.fromEntries(entries.map(([name], index) => [name, loaded[index + 1]])) };
}

export function createJointed(assets, body, grid) {
  const definitions = [
    ['leg_back', 'backLeg'], ['leg_front', 'frontLeg'], ['leg_back_foot', 'backLeg'],
    ['arm_down', 'lowered'], ['arm_raised', 'raised'],
  ];
  const skins = Object.fromEntries(definitions.map(([layer, name]) => [layer,
    makeSkin(assets.textures[layer], assets.metadata.layers[layer].box, name, grid)]));
  let angles = composeJoints(0, 0);
  let matrices = Object.fromEntries(Object.keys(angles).map(name => [name, jointMatrices(name, angles[name])]));
  const skinned = { x: 0, y: 0 };
  const bodyPoint = (x, y, result = { x: 0, y: 0 }) => {
    // Extend the anchored outer edge linearly for a hand or shoe that moves
    // just outside the source rectangle; clamping would collapse triangles.
    const cx = Math.max(0, Math.min(grid.width, x));
    const cy = Math.max(0, Math.min(grid.height, y));
    deformedPoint(cx, cy, body.buffer.data, grid.cols, grid.rows, grid.width, grid.height, result);
    result.x += x - cx; result.y += y - cy;
    return result;
  };
  function update(time, strength, contributions = [], override = null) {
    angles = composeJoints(time, strength, contributions, override);
    matrices = Object.fromEntries(Object.keys(angles).map(name => [name, jointMatrices(name, angles[name])]));
    const bodyVertices = body.buffer.data;
    for (const skin of Object.values(skins)) {
      const points = skin.buffer.data, matrix = matrices[skin.name];
      for (let i = 0; i < skin.weights.length; i++) {
        const x = skin.base[i * 2], y = skin.base[i * 2 + 1], bodyIndex = skin.bodyIndices[i];
        skinPoint(x, y, skin.weights[i], matrix, skinned);
        // Grids share exact V1 nodes, so their body offset can be read directly
        // rather than interpolating 4,000+ triangles and allocating per frame.
        points[i * 2] = skinned.x + bodyVertices[bodyIndex] - x;
        points[i * 2 + 1] = skinned.y + bodyVertices[bodyIndex + 1] - y;
      }
      skin.buffer.update();
    }
  }
  function point(name, x, y) {
    const layer = name === 'raised' ? 'arm_raised' : name === 'lowered' ? 'arm_down'
      : name === 'frontLeg' ? 'leg_front' : y >= 3220 ? 'leg_back_foot' : 'leg_back';
    const skin = skins[layer];
    const left = skin.firstCol * skin.sx, top = skin.firstRow * skin.sy;
    const width = (skin.cols - 1) * skin.sx, height = (skin.rows - 1) * skin.sy;
    if (x >= left && x <= left + width && y >= top && y <= top + height) {
      // Interpolate the actual rendered skin triangles, not a guessed rigid
      // hitbox transform; this also matches blended joints between vertices.
      return deformedPoint(x - left, y - top, skin.buffer.data, skin.cols, skin.rows, width, height);
    }
    // Polygon vertices can extend beyond the cropped texture (e.g. the
    // exposed upper thigh). Fall back to the same continuous skin equation.
    const p = skinPoint(x, y, limbWeights(name, x, y), matrices[name]);
    const reference = bodyPoint(x, y);
    return { x: p.x + reference.x - x, y: p.y + reference.y - y };
  }
  const zoneLimb = { armLeft: 'raised', handLeft: 'raised', armRight: 'lowered', handRight: 'lowered',
    legLeft: 'frontLeg', legRight: 'backLeg' };
  function zonePoint(zone, x, y) {
    const name = zoneLimb[zone];
    return name ? point(name, x, y) : bodyPoint(x, y);
  }
  function geometryStats() {
    const result = {};
    for (const [layer, skin] of Object.entries(skins)) {
      const p = skin.buffer.data;
      let minCross = Infinity, maxJointDisplacement = 0;
      for (let i = 0; i < skin.weights.length; i++) {
        const j = skin.bodyIndices[i];
        maxJointDisplacement = Math.max(maxJointDisplacement,
          Math.hypot(p[i * 2] - body.buffer.data[j], p[i * 2 + 1] - body.buffer.data[j + 1]));
        if (i % skin.cols < skin.cols - 1 && i < skin.cols * (skin.rows - 1)) {
          const right = i + 1, down = i + skin.cols, diagonal = down + 1;
          const cross1 = (p[right * 2] - p[i * 2]) * (p[down * 2 + 1] - p[i * 2 + 1])
            - (p[right * 2 + 1] - p[i * 2 + 1]) * (p[down * 2] - p[i * 2]);
          const cross2 = (p[diagonal * 2] - p[right * 2]) * (p[down * 2 + 1] - p[right * 2 + 1])
            - (p[diagonal * 2 + 1] - p[right * 2 + 1]) * (p[down * 2] - p[right * 2]);
          minCross = Math.min(minCross, cross1, cross2);
        }
      }
      result[layer] = { minimumCellCross: minCross, maximumJointDisplacement: maxJointDisplacement,
        vertices: skin.weights.length };
    }
    return result;
  }
  return { skins, update, point, zonePoint, geometryStats, angles: () => angles };
}
