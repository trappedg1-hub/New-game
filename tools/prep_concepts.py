#!/usr/bin/env python3
"""Remove painted/flat backgrounds to real alpha, trim, and make detail crops."""
import numpy as np
from PIL import Image
from collections import deque
import os

BASE = os.path.join(os.path.dirname(__file__), "..", "assets", "concepts")


def bg_colors(arr, corners):
    """Sample corner pixels -> list of distinct bg colors."""
    cols = []
    for (y, x) in corners:
        c = tuple(int(v) for v in arr[y, x, :3])
        if not any(sum(abs(a - b) for a, b in zip(c, old)) < 30 for old in cols):
            cols.append(c)
    return cols


def close_to(c, refs, tol):
    return any(sum(abs(int(c[i]) - refs[j][i]) for i in range(3)) <= tol for j in range(len(refs)))


def label_components(mask):
    """BFS labeling on boolean mask; yields (coords_array, touches_border)."""
    h, w = mask.shape
    seen = np.zeros_like(mask, dtype=bool)
    for sy in range(h):
        for sx in range(w):
            if mask[sy, sx] and not seen[sy, sx]:
                q = deque([(sy, sx)])
                seen[sy, sx] = True
                pts = []
                border = False
                while q:
                    y, x = q.popleft()
                    pts.append((y, x))
                    if y == 0 or x == 0 or y == h - 1 or x == w - 1:
                        border = True
                    for ny, nx in ((y-1, x), (y+1, x), (y, x-1), (y, x+1)):
                        if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                            seen[ny, nx] = True
                            q.append((ny, nx))
                yield np.array(pts, dtype=np.int32), border


def remove_bg(path, out):
    img = Image.open(path).convert("RGBA")
    arr = np.array(img)
    h, w = arr.shape[:2]
    corners = [(2, 2), (2, w - 3), (h - 3, 2), (h - 3, w - 3),
               (h // 2, 2), (h // 2, w - 3), (2, w // 2), (h - 3, w // 2)]
    refs = bg_colors(arr, corners)
    tol = 24 if len(refs) > 1 else 40

    rgb = arr[..., :3].astype(np.int32)
    match = np.zeros((h, w), dtype=bool)
    for c in refs:
        d = np.abs(rgb - np.array(c)).sum(axis=2)
        match |= d <= tol

    alpha = arr[..., 3].copy()
    for pts, border in label_components(match):
        ys, xs = pts[:, 0], pts[:, 1]
        sub = match[ys, xs]
        frac = sub.mean()
        if border:
            is_bg = True
        elif len(refs) > 1:
            c0 = close_to(rgb[ys[0], xs[0]], refs, tol)
            # count membership per ref color
            cnts = []
            for c in refs:
                d = np.abs(rgb[ys, xs] - np.array(c)).sum(axis=1)
                cnts.append((d <= tol).sum())
            cnts = np.array(cnts, dtype=float)
            balance = (cnts.max() - cnts.min()) / max(cnts.sum(), 1) < 0.35
            is_bg = frac > 0.9 and (balance or frac > 0.98)
        else:
            is_bg = frac > 0.9
        if is_bg:
            alpha[ys, xs] = 0

    # fringe cleanup: opaque pixels hugging transparency that match bg color
    trans = alpha == 0
    adj = np.zeros_like(trans)
    adj[1:, :] |= trans[:-1, :]
    adj[:-1, :] |= trans[1:, :]
    adj[:, 1:] |= trans[:, :-1]
    adj[:, :-1] |= trans[:, 1:]
    fringe = adj & (alpha > 0) & match
    alpha[fringe] = 0

    arr[..., 3] = alpha
    out_img = Image.fromarray(arr, "RGBA")
    bbox = out_img.getbbox()
    if bbox:
        pad = 6
        x0 = max(bbox[0] - pad, 0); y0 = max(bbox[1] - pad, 0)
        x1 = min(bbox[2] + pad, w); y1 = min(bbox[3] + pad, h)
        out_img = out_img.crop((x0, y0, x1, y1))
    out_img.save(out)
    return out_img.size


def crops(path, prefix):
    img = Image.open(path)
    w, h = img.size
    regions = {
        "face": (0.0, 0.00, 1.0, 0.20),
        "outfit": (0.0, 0.22, 1.0, 0.55),
        "legs": (0.0, 0.57, 1.0, 1.00),
    }
    for name, (fx0, fy0, fx1, fy1) in regions.items():
        box = (int(fx0 * w), int(fy0 * h), int(fx1 * w), int(fy1 * h))
        c = img.crop(box)
        # trim fully transparent margins inside crop
        bbox = c.getbbox()
        if bbox:
            c = c.crop(bbox)
        c.save(f"{prefix}_{name}.png")


import sys
for g in (sys.argv[1:] or ["a", "b", "c", "d"]):
    d = os.path.join(BASE, f"girl_{g.upper()}")
    src = os.path.join(d, f"girl_{g}_full.png")
    size = remove_bg(src, src)
    print(g, "trimmed:", size)
    crops(src, os.path.join(d, f"girl_{g}"))
print("done")
