"""Pixel checks for the V3-only expression derivatives (requires Pillow/NumPy)."""
from pathlib import Path
import hashlib
import json

import numpy as np
from PIL import Image

root = Path(__file__).resolve().parents[1]
metadata = json.loads((root / 'public/derived/expressions/expressions.json').read_text())
reference = np.asarray(Image.open(root / 'artifacts/approved_face_crop.png').convert('RGB'))
x0, y0 = 225, 380
width, height = metadata['mouthRect'][2:]
for name in metadata['studies']:
    atlas = np.asarray(Image.open(root / f'public/derived/expressions/mouth_{name}.png').convert('RGBA'))
    first = atlas[:height, :width]
    assert np.array_equal(first[:, :, :3], reference[y0:y0 + height, x0:x0 + width]), f'{name}: neutral frame changed'
    for frame in range(metadata['frames']):
        row, col = divmod(frame, metadata['columns'])
        alpha = atlas[row * height:(row + 1) * height, col * width:(col + 1) * width, 3]
        assert alpha[-1].max() == 0 and alpha[0].max() == 0, f'{name}: uncovered edge'
        assert alpha[70:, 70:110].max() == 0, f'{name}: finger protection'
for side in ('left', 'right'):
    v1 = np.asarray(Image.open(root / f'public/derived/eye_{side}_open.png').convert('RGBA'))
    sleepy = np.asarray(Image.open(root / f'public/derived/expressions/eye_{side}_sleepy.png').convert('RGBA'))
    assert np.array_equal(v1[:, :, 3], sleepy[:, :, 3]), f'{side}: eye mask changed'
source = root.parents[1] / 'Generated/Approved/HERO-01_outfit02_playful_maid.png'
assert hashlib.sha256(source.read_bytes()).hexdigest() == '91111189c23d1d7ac424e85d3406202bf028e8d3330ae8c50b33223312f236fd'
print('PASS: neutral mouth RGB, protected finger/edges, V1 eye masks, and approved-source SHA.')
