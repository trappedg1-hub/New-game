"""Remove a detached rear curl mistakenly drawn in the Tier 3 front component.
Run after register_more_layers.py. This edits independent AI front art only,
not a slice from a full character painting. Original candidates remain outside Git.
"""
from collections import deque
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

path = Path('assets/characters/tier3/hair_front.png')
im = Image.open(path).convert('RGBA')
a = np.array(im.getchannel('A')) > 20
seen = np.zeros(a.shape, dtype=bool)
largest = []
for y, x in zip(*np.where(a)):
    if seen[y, x]:
        continue
    seen[y, x] = True
    queue = deque([(y, x)])
    component = []
    while queue:
        yy, xx = queue.popleft()
        component.append((yy, xx))
        for dy, dx in ((0,1), (0,-1), (1,0), (-1,0)):
            ny, nx = yy + dy, xx + dx
            if 0 <= ny < a.shape[0] and 0 <= nx < a.shape[1] and a[ny,nx] and not seen[ny,nx]:
                seen[ny,nx] = True
                queue.append((ny,nx))
    if len(component) > len(largest):
        largest = component
mask = np.zeros(a.shape, dtype=np.uint8)
for y, x in largest:
    mask[y,x] = 255
# Include the main component's antialiased fringe without retaining detached art.
mask = Image.fromarray(mask).filter(ImageFilter.MaxFilter(5))
alpha = np.minimum(np.array(im.getchannel('A')), np.array(mask))
im.putalpha(Image.fromarray(alpha))
im.save(path, optimize=True)
