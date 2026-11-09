"""Measure per-rig eye centres from the open/closed face difference clusters.
Stores manifest `eyes`: [[lx,ly],[rx,ry]] in 420x1323 canvas pixels so the
renderer can place heart pupils / eyelid / blush overlays on the real eyes.
"""
import json
from pathlib import Path
import numpy as np
from PIL import Image

mpath = Path('assets/characters/animation-manifest.json')
m = json.loads(mpath.read_text())

def measure(c):
    a = np.array(Image.open(c['layers']['face_open']).convert('RGBA')).astype(int)
    b = np.array(Image.open(c['layers']['face_closed']).convert('RGBA')).astype(int)
    diff = np.any(a != b, axis=2)
    ys, xs = np.where(diff)
    # split at the widest empty column gap inside the diff span
    cols = np.where(diff.any(axis=0))[0]
    gaps = [(cols[i + 1] - cols[i], cols[i]) for i in range(len(cols) - 1)]
    split = max(gaps)[1]
    eyes = []
    for side in (xs <= split, xs > split):
        eyes.append([round(float(xs[side].mean()), 1), round(float(ys[side].mean()), 1)])
    return eyes

for group in ('tiers', 'costumes'):
    for key, c in m[group].items():
        if c.get('type') == 'layered':
            c['eyes'] = measure(c)
            print(key, c['eyes'])
m['version'] = 22
mpath.write_text(json.dumps(m, indent=2) + '\n')
print('eyes stored, manifest v22')
