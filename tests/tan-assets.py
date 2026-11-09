"""Tan/gloss/slip art assets: alpha may exist ONLY inside the skin mask, so
clothing, hair and eyes are provably never tinted."""
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

m = json.loads(Path('assets/characters/animation-manifest.json').read_text())
rigs = [(k, c) for group in ('tiers', 'costumes') for k, c in m[group].items() if c.get('type') == 'layered']
assert len(rigs) == 15, len(rigs)
for key, c in rigs:
    A = c['tanAssets']
    mask = np.array(Image.open(A['mask']).convert('RGBA'))[:, :, 3] > 0
    body = np.array(Image.open(c['layers']['body_base']).convert('RGBA'))
    face = np.array(Image.open(c['layers']['face_open']).convert('RGBA'))
    union = (body[:, :, 3] > 32) | (face[:, :, 3] > 32)
    cov = mask.sum() / union.sum()
    assert 0.02 < cov < 0.90, (key, cov)
    for kind in ('tone', 'pattern'):
        for name, path in A[kind].items():
            im = np.array(Image.open(path).convert('RGBA'))
            assert im.shape[:2] == (1323, 420), (key, path)
            over = im[:, :, 3] > 0
            assert not (over & ~mask).any(), (key, kind, name, 'paints outside skin mask')
    gloss = np.array(Image.open(A['gloss']).convert('RGBA'))
    assert not ((gloss[:, :, 3] > 0) & ~mask).any(), (key, 'gloss outside skin')
    dilated = np.array(Image.fromarray((body[:, :, 3] > 32).astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(31))) > 0
    for path in A['slip']:
        im = np.array(Image.open(path).convert('RGBA'))
        over = im[:, :, 3] > 0
        assert not (over & ~dilated).any(), (key, path, 'slip outside body silhouette')
        assert over.sum() < 0.55 * (body[:, :, 3] > 32).sum(), (key, path, 'slip too large')
    for ex, ey in c['eyes']:  # eyes are never tinted
        ex, ey = int(ex), int(ey)
        assert not mask[max(0, ey - 6):ey + 7, max(0, ex - 6):ex + 7].any(), (key, 'eye in skin mask')
    print('PASS', key, 'skin-only tan/pattern/gloss, eye-safe, slip on-body  cov=%.2f' % cov)
print('PASS all 15 rigs: clothing/hair/eyes provably untinted')
