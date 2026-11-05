#!/usr/bin/env python3
"""Validate the checked-in V3 layers without rebuilding AI-assisted underpaints.

Requires Pillow and NumPy. The composite is source-resolution CPU alpha
compositing, not a claim that filtered WebGL output is pixel-identical.
"""
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parents[1]
ROOT = HERE.parents[1]
SOURCE = ROOT / 'Generated/Approved/HERO-01_outfit02_playful_maid.png'
DERIVED = HERE / 'public/derived/jointed'
EXPECTED = '91111189c23d1d7ac424e85d3406202bf028e8d3330ae8c50b33223312f236fd'
meta = json.loads((DERIVED / 'jointed.json').read_text())
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == meta['source_sha256'] == EXPECTED
original = np.asarray(Image.open(SOURCE).convert('RGB'))
result = Image.open(DERIVED / meta['body']).convert('RGBA')
assert result.size == tuple(meta['size']) == (1184, 3488)
for name in ['leg_back', 'leg_front', 'leg_back_foot', 'arm_down', 'arm_raised']:
    item = meta['layers'][name]
    x, y, w, h = item['box']
    layer = Image.open(DERIVED / item['file']).convert('RGBA')
    assert layer.size == (w, h)
    alpha = np.asarray(layer)[:, :, 3]
    # Crops are transparent at their edges, except where they end at the
    # source's bottom boundary. This avoids clamped-UV strips in the meshes.
    for edge, is_outer in [(alpha[:, 0], x == 0), (alpha[:, -1], x + w == result.width),
                           (alpha[0, :], y == 0), (alpha[-1, :], y + h == result.height)]:
        assert is_outer or np.max(edge) == 0, f'{name} has opaque pixels at an internal crop edge'
    result.alpha_composite(layer, (x, y))
difference = np.abs(np.asarray(result.convert('RGB')).astype(np.int16) - original.astype(np.int16))
maximum = int(difference.max())
mean = float(difference.mean())
changed = int((difference.max(axis=2) > 2).sum())
assert maximum <= 2 and changed == 0, (maximum, mean, changed)
print(f'PASS: source SHA, crop edges, neutral reconstruction: mean={mean:.8f}/255 max={maximum} pixels>2={changed}')
