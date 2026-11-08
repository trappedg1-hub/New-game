#!/usr/bin/env python3
"""Pass 2: remove leftover checkerboard grid lines / squares (8-connected)."""
import numpy as np
from PIL import Image
from collections import deque, Counter
import os

BASE = os.path.join(os.path.dirname(__file__), "..", "assets", "concepts")
TOL = 28
MIN_CLUSTER = 40


def collect_bg_colors(arr):
    a = arr[..., 3]
    rgb = arr[..., :3].astype(np.int32)
    h, w = a.shape
    cand = []

    def grayish_light(c):
        return (c.max() - c.min()) <= 35 and c.min() >= 70

    # border ring opaque pixels
    ring = []
    ring += [(y, x) for x in range(w) for y in (0, 1, 2, h - 3, h - 2, h - 1)]
    ring += [(y, x) for y in range(h) for x in (0, 1, 2, w - 3, w - 2, w - 1)]
    for y, x in ring:
        if a[y, x] > 0:
            cand.append(tuple(int(v) for v in rgb[y, x]))

    # opaque pixels adjacent to transparent
    trans = a == 0
    adj = np.zeros_like(trans)
    adj[1:, :] |= trans[:-1, :]
    adj[:-1, :] |= trans[1:, :]
    adj[:, 1:] |= trans[:, :-1]
    adj[:, :-1] |= trans[:, 1:]
    ys, xs = np.where(adj & (a > 0))
    for y, x in zip(ys, xs):
        cand.append(tuple(int(v) for v in rgb[y, x]))

    # cluster noisy candidates first, then keep big clusters
    clusters = []  # [color, count]
    for c in cand:
        if not grayish_light(np.array(c)):
            continue
        hit = None
        for i, (oc, n) in enumerate(clusters):
            if sum(abs(c[j] - oc[j]) for j in range(3)) <= TOL * 2:
                hit = i
                break
        if hit is None:
            clusters.append([c, 1])
        else:
            oc, n = clusters[hit]
            clusters[hit] = [tuple((oc[j] * n + c[j]) // (n + 1) for j in range(3)), n + 1]
    colors = [tuple(int(v) for v in c) for c, n in clusters if n >= MIN_CLUSTER]
    return colors


def pass2(path):
    img = Image.open(path).convert("RGBA")
    arr = np.array(img)
    h, w = arr.shape[:2]
    a = arr[..., 3]
    rgb = arr[..., :3].astype(np.int32)

    colors = collect_bg_colors(arr)
    if not colors:
        print(os.path.basename(path), "no bg colors found; skip")
        return
    print(os.path.basename(path), "bg colors:", colors)

    mask = np.zeros((h, w), dtype=bool)
    for c in colors:
        mask |= (np.abs(rgb - np.array(c)).sum(axis=2) <= TOL * 2)

    trans = a == 0
    T = mask | trans

    # 8-connected labeling
    seen = np.zeros_like(T, dtype=bool)
    remove = np.zeros_like(mask)
    for sy in range(h):
        for sx in range(w):
            if T[sy, sx] and not seen[sy, sx]:
                q = deque([(sy, sx)])
                seen[sy, sx] = True
                pts = []
                border = False
                has_trans = False
                while q:
                    y, x = q.popleft()
                    pts.append((y, x))
                    if y == 0 or x == 0 or y == h - 1 or x == w - 1:
                        border = True
                    if trans[y, x]:
                        has_trans = True
                    for dy in (-1, 0, 1):
                        for dx in (-1, 0, 1):
                            if dy == 0 and dx == 0:
                                continue
                            ny, nx = y + dy, x + dx
                            if 0 <= ny < h and 0 <= nx < w and T[ny, nx] and not seen[ny, nx]:
                                seen[ny, nx] = True
                                q.append((ny, nx))
                if border or has_trans:
                    for y, x in pts:
                        if mask[y, x]:
                            remove[y, x] = True
                else:
                    # enclosed: remove only if >=2 distinct bg colors present
                    cols = set()
                    for y, x in pts:
                        if mask[y, x]:
                            cols.add(tuple(rgb[y, x]))
                    if len(cols) >= 2:
                        for y, x in pts:
                            if mask[y, x]:
                                remove[y, x] = True

    a[remove] = 0

    # fringe cleanup
    trans = a == 0
    adj = np.zeros_like(trans)
    adj[1:, :] |= trans[:-1, :]
    adj[:-1, :] |= trans[1:, :]
    adj[:, 1:] |= trans[:, :-1]
    adj[:, :-1] |= trans[:, 1:]
    fringe = adj & (a > 0) & mask
    a[fringe] = 0

    arr[..., 3] = a
    out = Image.fromarray(arr, "RGBA")
    bbox = out.getbbox()
    if bbox:
        pad = 6
        out = out.crop((max(bbox[0] - pad, 0), max(bbox[1] - pad, 0),
                        min(bbox[2] + pad, w), min(bbox[3] + pad, h)))
    out.save(path)
    print("  ->", out.size, "transp%%: %.1f" % (100 * (np.array(out)[..., 3] == 0).mean()))


def crops(path, prefix):
    img = Image.open(path)
    w, h = img.size
    regions = {
        "face": (0.0, 0.00, 1.0, 0.20),
        "outfit": (0.0, 0.22, 1.0, 0.55),
        "legs": (0.0, 0.57, 1.0, 1.00),
    }
    for name, (fx0, fy0, fx1, fy1) in regions.items():
        c = img.crop((int(fx0 * w), int(fy0 * h), int(fx1 * w), int(fy1 * h)))
        bbox = c.getbbox()
        if bbox:
            c = c.crop(bbox)
        c.save(f"{prefix}_{name}.png")


for g in ["b", "c", "d"]:
    d = os.path.join(BASE, f"girl_{g.upper()}")
    p = os.path.join(d, f"girl_{g}_full.png")
    pass2(p)
    crops(p, os.path.join(d, f"girl_{g}"))
print("done")
