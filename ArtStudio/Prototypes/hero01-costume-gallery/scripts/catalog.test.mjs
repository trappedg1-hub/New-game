import assert from 'node:assert/strict';
import test from 'node:test';
import { art, artById, motions } from '../site/catalog-data.mjs';

test('inventory distinguishes animations, approved static outfits and unresolved candidates', () => {
  assert.equal(motions.length, 3);
  assert.equal(art.filter(item => item.group === 'still').length, 5);
  assert.equal(art.filter(item => item.group === 'pending').length, 3);
  assert.equal(motions.find(item => item.id === 'maid').variants.length, 3);
  assert.equal(new Set(art.map(item => item.id)).size, art.length);
  assert.equal(new Set(art.map(item => item.file)).size, art.length);
  for (const item of art) {
    assert.match(item.sha256, /^[a-f0-9]{64}$/);
    assert.ok(item.width > 0 && item.height > 0);
    assert.equal(item.group === 'pending', item.source === 'Experiments');
  }
  for (const motion of motions) {
    assert.ok(artById[motion.art]);
    for (const id of motion.arts) assert.ok(artById[id]);
    for (const variant of motion.variants) assert.match(variant.path, /^(\.\.\/|\.\/motion\/)/);
  }
});
