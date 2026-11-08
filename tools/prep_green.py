#!/usr/bin/env python3
"""Chroma-key green backgrounds to real alpha, trim, detail crops. Safe global key."""
import numpy as np
from PIL import Image
import os
import sys

BASE = os.path.join(os.path.dirname(__file__), "..", "assets", "concepts")


def key_out(path):
    img = Image.open(path).convert("RGBA")
    arr = np.array(img)
    h, w = arr.shape[:2]
    rgb = arr[..., :3].astype(np.int32)
    # sample bg from corners
    corners = [rgb[3, 3], rgb[3, w - 4], rgb[h - 4, 3], rgb[h - 4, w - 4],
               rgb[h // 2, 3], rgb[3, w // 2]]
    bg = np.median(np.stack(corners), axis=0)
    d = np.abs(rgb - bg).sum(axis=2)
    alpha = arr[..., 3].copy()
    key = d <= 70
    alpha[key] = 0
    # one-pass fringe: opaque pixels hugging key with near-bg color
    trans = alpha == 0
    adj = np.zeros_like(trans)
    adj[1:, :] |= trans[:-1, :]
    adj[:-1, :] |= trans[1:, :]
    adj[:, 1:] |= trans[:, :-1]
    adj[:, :-1] |= trans[:, 1:]
    fringe = adj & (alpha > 0) & (d <= 110)
    alpha[fringe] = 0
    # second fringe pass
    trans = alpha == 0
    adj = np.zeros_like(trans)
    adj[1:, :] |= trans[:-1, :]
    adj[:-1, :] |= trans[1:, :]
    adj[:, 1:] |= trans[:, :-1]
    adj[:, :-1] |= trans[:, 1:]
    fringe = adj & (alpha > 0) & (d <= 110)
    alpha[fringe] = 0
    # despill: edge pixels keep green channel in check
    trans = alpha == 0
    adj = np.zeros_like(trans)
    adj[1:, :] |= trans[:-1, :]
    adj[:-1, :] |= trans[1:, :]
    adj[:, 1:] |= trans[:, :-1]
    adj[:, :-1] |= trans[:, 1:]
    edge = adj & (alpha > 0)
    ys, xs = np.where(edge)
    for y, x in zip(ys, xs):
        r, g, b = int(arr[y, x, 0]), int(arr[y, x, 1]), int(arr[y, x, 2])
        if g > r and g > b:
            newg = max(r, b)
            arr[y, x, 1] = newg
    arr[..., 3] = alpha
    out = Image.fromarray(arr, "RGBA")
    bbox = out.getbbox()
    if bbox:
        pad = 6
        out = out.crop((max(bbox[0] - pad, 0), max(bbox[1] - pad, 0),
                        min(bbox[2] + pad, w), min(bbox[3] + pad, h)))
    out.save(path)
    return out.size, bg.tolist()


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


if __name__ == "__main__":
    for g in (sys.argv[1:] or ["b", "c", "d"]):
        d = os.path.join(BASE, f"girl_{g.upper()}")
        p = os.path.join(d, f"girl_{g}_full.png")
        size, bg = key_out(p)
        print(g, "->", size, "bg was", bg)
        crops(p, os.path.join(d, f"girl_{g}"))
