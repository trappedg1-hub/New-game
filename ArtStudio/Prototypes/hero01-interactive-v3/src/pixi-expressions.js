import * as PIXI from 'pixi.js';
const smoothstep = (a, b, value) => {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Local assets are loaded once up front. They are never whole-frame portraits.
export async function loadExpressions(base, eyeMetadata) {
  const response = await fetch(`${base}derived/expressions/expressions.json`);
  if (!response.ok) throw new Error('Не удалось загрузить экспериментальные выражения.');
  const metadata = await response.json();
  const root = `${base}derived/expressions/`;
  const [blush, ...mouthImages] = await Promise.all([
    PIXI.Assets.load(`${root}blush.png`),
    ...Object.keys(metadata.studies).map(name => PIXI.Assets.load(`${root}mouth_${name}.png`)),
  ]);
  const mouths = {};
  Object.keys(metadata.studies).forEach((name, index) => {
    const texture = mouthImages[index];
    const [, , w, h] = metadata.mouthRect;
    mouths[name] = Array.from({ length: metadata.frames }, (_, frame) => new PIXI.Texture(
      texture.baseTexture,
      new PIXI.Rectangle((frame % metadata.columns) * w, Math.floor(frame / metadata.columns) * h, w, h),
    ));
  });
  const sleepy = await Promise.all(eyeMetadata.map(eye => PIXI.Assets.load(`${root}eye_${eye.name}_sleepy.png`)));
  return { metadata, blush, mouths, sleepy };
}

// Attach blush beneath blink, mouth and sleepy eyes above blink. When blinking,
// sleepy eye patches fade out so the exact V1 closed lid remains unobstructed.
export function createExpressionLayers(parent, assets, eyeMetadata) {
  const blush = new PIXI.Sprite(assets.blush);
  blush.position.set(assets.metadata.blushRect[0], assets.metadata.blushRect[1]);
  blush.visible = false;
  parent.addChild(blush);
  const foreground = new PIXI.Container();
  const mouth = new PIXI.Sprite(assets.mouths.happy[0]);
  mouth.position.set(assets.metadata.mouthRect[0], assets.metadata.mouthRect[1]);
  mouth.visible = false;
  foreground.addChild(mouth);
  const sleepy = eyeMetadata.map((eye, index) => {
    const sprite = new PIXI.Sprite(assets.sleepy[index]);
    sprite.position.set(eye.box[0], eye.box[1]);
    sprite.visible = false;
    foreground.addChild(sprite);
    return sprite;
  });
  function attachForeground() { parent.addChild(foreground); }
  function update(expression, blink) {
    const amount = expression?.amount || 0;
    blush.alpha = amount * (expression?.blush || 0);
    blush.visible = blush.alpha > 0.001;
    const mouthFrames = expression?.mouth && assets.mouths[expression.mouth];
    mouth.visible = Boolean(mouthFrames && amount > 0.001);
    if (mouth.visible) mouth.texture = mouthFrames[Math.min(mouthFrames.length - 1, Math.round(amount * (mouthFrames.length - 1)))];
    const sleepyOpacity = amount * (expression?.sleepy || 0) * (1 - smoothstep(0.04, 0.52, blink));
    for (const eye of sleepy) { eye.alpha = sleepyOpacity; eye.visible = sleepyOpacity > 0.001; }
  }
  return { attachForeground, update };
}
