#!/usr/bin/env python3
"""Rebuild the *experimental V3-only* skin/underpaint textures.

Requires numpy, OpenCV and Pillow (offline development only). The aligned
inpaint studies and hand-refined masks live in artifacts/experiments/jointed-rig;
the approved illustration is read, never overwritten. Colors are straight
alpha; the background and foreground reconstruct the original at rest.
"""
from pathlib import Path
import hashlib
import json

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent.parent / 'Generated/Approved/HERO-01_outfit02_playful_maid.png'
EXPECTED = '91111189c23d1d7ac424e85d3406202bf028e8d3330ae8c50b33223312f236fd'
EXPERIMENT = ROOT / 'artifacts/experiments/jointed-rig'
OUT = ROOT / 'public/derived/jointed'
if hashlib.sha256(SOURCE.read_bytes()).hexdigest() != EXPECTED:
    raise RuntimeError('Approved source checksum mismatch; refusing to build derivative textures')
OUT.mkdir(parents=True, exist_ok=True)
source = cv2.imread(str(SOURCE), cv2.IMREAD_COLOR)
H, W = source.shape[:2]
assert (W, H) == (1184, 3488)
names = ('raised', 'downupper', 'downhand', 'stocking')
masks = {name: cv2.imread(str(EXPERIMENT / 'masks' / f'{name}.png'), cv2.IMREAD_GRAYSCALE) for name in names}
assert all(m is not None and m.shape == (H, W) for m in masks.values())
# Trim a few pixels of skirt bow accidentally captured at the raised elbow.
for y in range(1125, 1200):
    limit = int(np.interp(y, [1125, 1150, 1175, 1199], [410, 408, 398, 385]))
    masks['raised'][y, limit + 1:] = 0
# The stockings touch above the calves, then an actual background gap opens.
# Row-filling the original silhouette across that gap would make an opaque
# rectangular strip travel with a leg. Detect only the original background
# within that narrow, hand-guided gap and leave it in the body instead.
leg_study = cv2.imread(str(EXPERIMENT / 'aligned/hero-jointed-legs-aligned.png'), cv2.IMREAD_COLOR)
leg_background = source.copy()
leg_background[1500:3488, 130:1010] = leg_study
change = np.max(np.abs(source.astype(np.int16) - leg_background.astype(np.int16)), axis=2)
gap = np.zeros((H, W), np.uint8)
gap_centers = {}
for y in range(2820, 3230):
    center = int(np.interp(y, [2820,2850,2900,2950,3000,3050,3100,3150,3200,3230],
                           [528,525,520,518,515,512,504,500,492,488]))
    matches = change[y] <= 9
    if not matches[center]:
        near = [x for x in range(max(450, center - 8), min(560, center + 9)) if matches[x]]
        center = min(near, key=lambda x: abs(x - center)) if near else None
    if center is None:
        continue
    left = right = center
    while left > 450 and matches[left - 1]: left -= 1
    while right < 560 and matches[right + 1]: right += 1
    if right - left >= 3:
        gap[y, left:right + 1] = 255
        gap_centers[y] = (left + right) / 2
masks['stocking'][gap > 0] = 0
# The flat source has no cut edge at the tops of the thighs. Feather the
# cut into the stocking instead of sampling a hard horizontal skin/background
# boundary (which otherwise shows up in mipmapped mobile rendering).
for y in range(1880, 2050):
    t = max(0, min(1, (y - 1890) / 150))
    fade = t * t * (3 - 2 * t)
    masks['stocking'][y] = np.uint8(np.round(masks['stocking'][y] * fade))
# The left shoe's diffuse floor shadow is not an opaque part of its sole.
# Let the algebraic matte below recover it with soft alpha instead of carrying
# a hard-edged opaque rectangle along with the shoe.
for y in range(3405, H):
    t = max(0, min(1, (y - 3405) / 32))
    fade = 1 - t * t * (3 - 2 * t)
    masks['stocking'][y, :458] = np.uint8(np.round(masks['stocking'][y, :458] * fade))
shadow_support = np.zeros((H, W), np.uint8)
cv2.ellipse(shadow_support, (420, 3418), (165, 78), 0, 0, 360, 255, -1)
shadow_support = cv2.GaussianBlur(shadow_support, (101, 101), 25).astype(np.float64) / 255

# Original pixels are replaced with local reconstructed art in a narrow,
# feathered region around each silhouette. The wider support removes original
# outlines/shadows rather than leaving a stationary ghost when a limb moves.
base = source.astype(np.float64)
supports = {}
for name in names:
    support = cv2.dilate(masks[name], cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (25, 25)))
    support = cv2.GaussianBlur(support, (17, 17), 4).astype(np.float64) / 255
    if name == 'stocking':
        support = np.maximum(support, shadow_support)
        support[gap > 0] = 0
    supports[name] = support
    replacement = source.copy()
    if name != 'downhand':
        box, file = {
            'raised': ((55, 380, 710, 1300), 'hero-jointed-raised_arm-aligned.png'),
            'downupper': ((715, 700, 1184, 2060), 'hero-jointed-lowered_arm-aligned.png'),
            'stocking': ((130, 1500, 1010, 3488), 'hero-jointed-legs-aligned.png'),
        }[name]
        x0, y0, x1, y1 = box
        aligned = cv2.imread(str(EXPERIMENT / 'aligned' / file), cv2.IMREAD_COLOR)
        assert aligned is not None and aligned.shape[:2] == (y1 - y0, x1 - x0)
        replacement[y0:y1, x0:x1] = aligned
    else:
        # The model drew extra ruffles behind this hand; the real setting is
        # an unobstructed dark gradient. Sample the original background instead.
        for y in range(1660, 1965):
            replacement[y, 940:1184] = np.median(source[y, 1168:1183], axis=0)
    base = base * (1 - support[:, :, None]) + replacement * support[:, :, None]
base = np.uint8(np.round(base))
cv2.imwrite(str(OUT / 'body.png'), base)

# Solve C = A*foreground + (1-A)*background. The smallest representable A
# outside each mask is used to retain the original at rest without needlessly
# dragging the replacement background along as an opaque rectangular patch.
def foreground(name):
    alpha = cv2.GaussianBlur(masks[name], (5, 5), 0.7).astype(np.float64) / 255
    original, background = source.astype(np.float64), base.astype(np.float64)
    delta = original - background
    required = np.where(delta >= 0, delta / np.maximum(255 - background, 1), -delta / np.maximum(background, 1)).max(axis=2)
    alpha = np.maximum(alpha, required)
    alpha[supports[name] == 0] = 0
    # Quantize *up* before solving so no foreground channel has to leave 0..255.
    alpha8 = np.uint8(np.ceil(np.clip(alpha, 0, 1) * 255))
    a = alpha8.astype(np.float64) / 255
    pixels = np.zeros_like(original)
    visible = a > 0
    pixels[visible] = (original[visible] - (1 - a[visible, None]) * background[visible]) / a[visible, None]
    return np.uint8(np.clip(np.round(pixels), 0, 255)), alpha8

fg = {name: foreground(name) for name in names}
leg, leg_a = fg['stocking']
# Hand-traced depth boundary follows the near leg; an extra 22px continuation
# behind it is an extrapolation, not recovered original artwork. It only fills
# a small revealed seam for modest 2D shifts; see QA.md for the limitations.
knots = np.array([[1880,565],[1900,579],[2000,593],[2100,603],[2200,609],[2300,619],
                  [2400,624],[2450,612],[2500,594],[2600,576],[2700,558],[2800,531],
                  [2900,520],[3000,515],[3100,505],[3200,495],[3250,490],[3270,482],
                  [3300,474],[3330,466],[3360,461],[3400,458],[3475,458]])
boundary = np.interp(np.arange(H), knots[:,0], knots[:,1])
for y, center in gap_centers.items():
    boundary[y] = center
xx = np.arange(W)[None, :]
near_a = leg_a.copy(); near_a[xx > boundary[:, None]] = 0
far_a = leg_a.copy(); far_a[xx <= boundary[:, None]] = 0
far = leg.copy()
for y in range(1880, 2820):
    edge = int(boundary[y])
    xs = np.arange(max(0, edge - 22), min(W, edge + 1))
    xs = xs[(near_a[y, xs] == 255)]
    if len(xs):
        far[y, xs] = source[y, min(W - 1, edge + 8)]
        # Fade out the inferred overlap before the real background gap opens.
        far_a[y, xs] = int(round(255 * min(1, max(0, (2820 - y) / 65))))

# Restore a small hidden strip of the left shoe behind the foreground right
# shoe by reflecting nearby pixels of the same shoe. It is only added under
# fully opaque pixels of the foreground shoe and thus cannot change the rest
# pose. This is a limited inpaint, not a claim to have recovered unseen art.
near = leg.copy()
for y in range(3250, 3475):
    edge = int(boundary[y])
    axis = np.interp(y, [3250,3300,3350,3400,3435,3475], [421,421,420,418,416,416])
    for x in range(edge + 1, min(W, edge + 45)):
        mirror = int(round(2 * axis - x))
        if mirror < 0 or far_a[y, x] != 255:
            continue
        if y >= 3420:
            # Mirror from the actual cut edge and taper the *soft* floor shadow
            # to zero; a constant-width alpha cut would leave a black wedge.
            distance = x - edge
            reflected = max(0, edge - distance)
            fade = max(0, min(1, (45 - distance) / 30))
            fade = fade * fade * (3 - 2 * fade)
            near[y, x] = near[y, reflected]
            near_a[y, x] = int(round(near_a[y, reflected] * fade))
        elif near_a[y, mirror] >= 250:
            t = min(1, max(0, (x - edge) / 12))
            t = t * t * (3 - 2 * t)
            near[y, x] = np.uint8(np.round(source[y, max(0, edge - 3)] * (1 - t) + source[y, mirror] * t))
            near_a[y, x] = near_a[y, mirror]

# Put the right shoe above the left shoe, reversing the thigh depth order.
# Overlap both pieces with an alpha-correct cross-fade, so bilinear filtering
# cannot expose an underpaint seam at the ankle. Both use the same FK chain.
original_a = far_a.astype(np.float64) / 255
rows = np.arange(H, dtype=np.float64)[:, None]
t = np.clip((rows - 3220) / 65, 0, 1)
t = t * t * (3 - 2 * t)
upper8 = np.uint8(np.round(original_a * (1 - t) * 255))
upper = upper8.astype(np.float64) / 255
foot_a = np.uint8(np.round(np.where(upper < 1, (original_a - upper) / np.maximum(1 - upper, 1e-8), 0).clip(0, 1) * 255))
far_a = upper8

def rgba(rgb, alpha):
    result = cv2.cvtColor(rgb, cv2.COLOR_BGR2BGRA)
    result[:, :, 3] = alpha
    result[alpha == 0, :3] = 0
    return result

raised = rgba(*fg['raised'])
down = rgba(*fg['downupper'])
downhand = rgba(*fg['downhand'])
# Disjoint visible portions of one chain: sleeve-to-skirt and skirt-to-fingers.
where = downhand[:,:,3] > 0
down[where] = downhand[where]
layers = {'leg_back': rgba(far, far_a), 'leg_front': rgba(near, near_a),
          'leg_back_foot': rgba(far, foot_a), 'arm_down': down, 'arm_raised': raised}
metadata = {'source_sha256': EXPECTED, 'size': [W, H], 'body': 'body.png', 'layers': {}}
for name, image in layers.items():
    yy, xx = np.where(image[:,:,3] > 0)
    x0, x1 = max(0, int(xx.min()) - 2), min(W, int(xx.max()) + 3)
    y0, y1 = max(0, int(yy.min()) - 2), min(H, int(yy.max()) + 3)
    path = OUT / f'{name}.png'
    cv2.imwrite(str(path), image[y0:y1, x0:x1])
    metadata['layers'][name] = {'file': path.name, 'box': [x0, y0, x1 - x0, y1 - y0]}

# Independent CPU compositing check before any renderer sampling/mipmapping.
composite = Image.fromarray(cv2.cvtColor(base, cv2.COLOR_BGR2RGBA))
for name, image in layers.items():
    composite.alpha_composite(Image.fromarray(cv2.cvtColor(image, cv2.COLOR_BGRA2RGBA)))
reconstructed = cv2.cvtColor(np.asarray(composite), cv2.COLOR_RGBA2BGR)
difference = np.abs(reconstructed.astype(np.int16) - source.astype(np.int16))
max_diff, mean_diff = int(difference.max()), float(difference.mean())
print(f'Neutral source reconstruction: mean={mean_diff:.8f}/255 max={max_diff} pixels>2={int((difference.max(axis=2) > 2).sum())}')
if max_diff > 2:
    raise RuntimeError('Neutral reconstruction differs by more than 2 channel levels')
(OUT / 'jointed.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + '\n')
print('Wrote', OUT, json.dumps(metadata['layers']))
