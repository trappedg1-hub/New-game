#!/usr/bin/env python3
"""Create V2-only blink atlases and two extracted hair strands from approved pixels.

All output is experimental and stays inside this prototype. The approved source
is read-only; deterministic masks and geometry keep the neutral composition true
to the source. See artifacts/PROVENANCE.md for the candidate eye study.
"""
from __future__ import annotations
from pathlib import Path
import hashlib
import json

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ART_STUDIO = ROOT.parents[1]
SOURCE = ART_STUDIO / 'Generated/Approved/HERO-01_outfit02_playful_maid.png'
OUT = ROOT / 'public/derived'
EXPECTED = '91111189c23d1d7ac424e85d3406202bf028e8d3330ae8c50b33223312f236fd'
CROP = (300, 40, 870, 610)
FRAMES, COLUMNS, PAD = 33, 7, 4

# Positions are in source coordinates. The deliberately short, separately
# matted loose-strand portions are away from the face, body and outfit.
STRANDS = [
    {'name': 'left', 'box': [16, 1280, 128, 1488], 'anchors': [1300, 1465], 'amplitude': 3.4,
     'path': [(69, 1305), (63, 1320), (58, 1335), (53, 1350), (49, 1365), (46, 1380),
              (45, 1395), (46, 1410), (49, 1425), (56, 1441), (68, 1451), (81, 1458), (97, 1461)]},
    {'name': 'right', 'box': [1056, 1312, 1152, 1440], 'anchors': [1360, 1415], 'amplitude': 1.2,
     'path': [(1075, 1360), (1079, 1370), (1083, 1380), (1089, 1390), (1098, 1400), (1110, 1410), (1121, 1415)]},
]
EYES = [
    {'name': 'left', 'box': [395, 340, 540, 430],
     'xs': [0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 145],
     'upper': [53, 52, 47, 38, 31, 28, 28, 30, 34, 42, 53],
     'closed': [62, 59, 56, 53, 49, 46, 43, 41, 42, 45, 53],
     'erase': [(28, 51), (36, 43), (47, 36), (62, 32), (80, 29), (103, 29), (121, 33),
               (130, 39), (128, 54), (113, 60), (96, 65), (75, 69), (53, 70), (36, 66), (28, 60)]},
    {'name': 'right', 'box': [565, 280, 705, 375],
     'xs': [0, 15, 30, 45, 60, 75, 90, 105, 120, 130, 140],
     'upper': [77, 71, 60, 50, 43, 37, 34, 34, 32, 36, 50],
     'closed': [80, 77, 70, 64, 61, 57, 54, 51, 47, 44, 50],
     'erase': [(13, 69), (24, 58), (39, 49), (52, 42), (68, 37), (88, 34), (110, 31),
               (130, 28), (135, 43), (126, 58), (110, 64), (89, 72), (66, 77), (42, 79), (20, 78)]},
]


def smooth(a: float, b: float, value: np.ndarray | float) -> np.ndarray:
    amount = np.clip((value - a) / (b - a), 0, 1)
    return amount * amount * (3 - 2 * amount)


def align_candidate(original: np.ndarray, candidate_path: Path) -> tuple[np.ndarray, dict]:
    candidate = cv2.imread(str(candidate_path), cv2.IMREAD_COLOR)
    if candidate is None:
        raise FileNotFoundError(candidate_path)
    candidate = cv2.resize(candidate, (570, 570), interpolation=cv2.INTER_AREA)
    ref = cv2.cvtColor(original, cv2.COLOR_RGB2BGR)
    sift = cv2.SIFT_create(nfeatures=1800, contrastThreshold=0.01)
    source_points, source_desc = sift.detectAndCompute(cv2.cvtColor(candidate, cv2.COLOR_BGR2GRAY), None)
    target_points, target_desc = sift.detectAndCompute(cv2.cvtColor(ref, cv2.COLOR_BGR2GRAY), None)
    pairs = cv2.BFMatcher().knnMatch(source_desc, target_desc, k=2)
    good = [m for m, n in pairs if m.distance < 0.72 * n.distance]
    if len(good) < 30:
        raise ValueError('Eye candidate does not match the original crop closely enough')
    src = np.float32([source_points[m.queryIdx].pt for m in good])
    dst = np.float32([target_points[m.trainIdx].pt for m in good])
    cv2.setRNGSeed(17)
    matrix, inliers = cv2.estimateAffinePartial2D(src, dst, method=cv2.RANSAC, ransacReprojThreshold=3)
    if matrix is None or int(inliers.sum()) < 30:
        raise ValueError('Eye candidate alignment failed')
    aligned = cv2.warpAffine(candidate, matrix, (570, 570), flags=cv2.INTER_CUBIC,
                             borderMode=cv2.BORDER_REPLICATE)
    return cv2.cvtColor(aligned, cv2.COLOR_BGR2RGB), {
        'matrix': matrix.round(7).tolist(), 'matches': len(good), 'inliers': int(inliers.sum())}


def prepare_strand(full: np.ndarray, strand: dict) -> dict:
    x0, y0, x1, y1 = strand['box']
    crop = full[y0:y1, x0:x1].copy()
    height, width = crop.shape[:2]
    corridor = np.zeros((height, width), dtype=np.uint8)
    points = np.array([[(x - x0, y - y0) for x, y in strand['path']]], dtype=np.int32)
    cv2.polylines(corridor, points, False, 255, 12)
    red = crop[:, :, 0].astype(np.float32)
    blue = crop[:, :, 2].astype(np.float32)
    mask = ((red > 52) & (red - blue > 3) & (corridor > 0)).astype(np.uint8) * 255
    mask = cv2.dilate(mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))
    background = cv2.inpaint(crop, mask, 4, cv2.INPAINT_TELEA)

    # Estimate an RGBA matte against the inpainted background. At rest the
    # composite reconstructs the original rather than replacing it with new art.
    original = crop.astype(np.float32)
    base = background.astype(np.float32)
    delta = original - base
    minimum = np.maximum(np.max(np.where(delta > 0, delta / np.maximum(255 - base, 1),
                                          -delta / np.maximum(base, 1)), axis=2), 0)
    difference = np.max(np.abs(delta), axis=2)
    alpha = np.clip(np.maximum(minimum + 0.005, np.clip(difference / 90, 0, 1)), 0, 1) * (mask / 255)
    foreground = np.where(alpha[:, :, None] > 1e-3,
                          (original - (1 - alpha[:, :, None]) * base) / np.maximum(alpha[:, :, None], 1e-3), 0)
    foreground = np.uint8(np.clip(np.rint(foreground), 0, 255))
    alpha8 = np.uint8(np.clip(np.rint(alpha * 255), 0, 255))
    restore = np.dstack([background, mask])
    isolated = np.dstack([foreground, alpha8])
    Image.fromarray(restore).save(OUT / f"hair_{strand['name']}_restore.png")
    Image.fromarray(isolated).save(OUT / f"hair_{strand['name']}_strand.png")
    actual_alpha = alpha8.astype(np.float32) / 255
    restored = base * (1 - actual_alpha[:, :, None]) + foreground * actual_alpha[:, :, None]
    error = np.abs(restored - original)
    return {k: strand[k] for k in ('name', 'box', 'anchors', 'amplitude')} | {
        'restored_pixels': int(np.count_nonzero(mask)),
        'neutral_mean_error': round(float(error.mean()), 6),
        'neutral_max_error': round(float(error.max()), 4),
    }


def flow_pair(a: np.ndarray, b: np.ndarray) -> tuple:
    height, width = a.shape[:2]
    size = (width * 3, height * 3)
    a = cv2.resize(a, size, interpolation=cv2.INTER_CUBIC)
    b = cv2.resize(b, size, interpolation=cv2.INTER_CUBIC)
    aa, bb = cv2.cvtColor(a, cv2.COLOR_RGB2GRAY), cv2.cvtColor(b, cv2.COLOR_RGB2GRAY)
    def flow(first, second):
        return cv2.calcOpticalFlowFarneback(first, second, None, 0.5, 4, 29, 5, 7, 1.5, 0)
    return a, b, flow(aa, bb), flow(bb, aa), (width, height)


def interpolate(pair: tuple, time: float) -> np.ndarray:
    a, b, forward, backward, (width, height) = pair
    x, y = np.meshgrid(np.arange(width * 3, dtype=np.float32), np.arange(height * 3, dtype=np.float32))
    first = -(1 - time) * time * forward + time * time * backward
    second = (1 - time) ** 2 * forward - time * (1 - time) * backward
    wa = cv2.remap(a, x + first[:, :, 0], y + first[:, :, 1], cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
    wb = cv2.remap(b, x + second[:, :, 0], y + second[:, :, 1], cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
    return cv2.resize(cv2.addWeighted(wa, 1 - time, wb, time, 0), (width, height), interpolation=cv2.INTER_AREA)


def prepare_blink(eye: dict, near: np.ndarray) -> dict:
    name = eye['name']
    x0, y0, x1, y1 = eye['box']
    original = np.asarray(Image.open(OUT / f'eye_{name}_open.png').convert('RGBA')).astype(np.float32)
    closed = np.asarray(Image.open(OUT / f'eye_{name}_closed.png').convert('RGBA')).astype(np.float32)
    height, width = original.shape[:2]
    mask = np.zeros((height, width), dtype=np.uint8)
    cv2.fillPoly(mask, [np.array(eye['erase'], dtype=np.int32)], 255)
    mask = cv2.dilate(mask, np.ones((5, 5), dtype=np.uint8))
    skin = cv2.inpaint(np.uint8(closed[:, :, :3]), mask, 7, cv2.INPAINT_TELEA).astype(np.float32)
    half_closed = near[y0-CROP[1]:y1-CROP[1], x0-CROP[0]:x1-CROP[0]].astype(np.float32)
    x, y = np.meshgrid(np.arange(width, dtype=np.float32), np.arange(height, dtype=np.float32))
    upper = np.interp(x, eye['xs'], eye['upper']).astype(np.float32)
    lower = np.interp(x, eye['xs'], eye['closed']).astype(np.float32)

    def wipe(amount: float) -> np.ndarray:
        # The iris pixels are not scaled: the lid covers them as it descends.
        shift = min(1, amount / 0.8) * 1.55 * (lower - upper)
        eye_visible = smooth(-2, 2, y - (upper + shift + 4))[:, :, None]
        result = skin * (1 - eye_visible) + original[:, :, :3] * eye_visible
        source_y = (y - shift).astype(np.float32)
        lash_alpha = smooth(-9, -5, source_y - upper) * (1 - smooth(5, 9, source_y - upper))
        lash_alpha *= smooth(8, 25, x) * (1 - smooth(width - 25, width - 7, x))
        lash = cv2.remap(original[:, :, :3], x, source_y, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
        result = result * (1 - lash_alpha[:, :, None]) + lash * lash_alpha[:, :, None]
        fade = float(smooth(0, 0.11, amount))
        return np.uint8(np.clip(np.rint(original[:, :, :3] * (1 - fade) + result * fade), 0, 255))

    # Images differ only in the tiny eye regions. Optical-flow-assisted local
    # in-betweens soften the approach to the near-closed/closed studies.
    transition = flow_pair(wipe(0.68), np.uint8(half_closed))
    finish = flow_pair(np.uint8(half_closed), np.uint8(closed[:, :, :3]))
    alpha = original[:, :, 3].copy()
    if name == 'left':
        # Keep the overlapping hair strand in the approved image, not the study.
        alpha *= smooth(29, 43, x)
    cell_width, cell_height = width + PAD * 2, height + PAD * 2
    rows = (FRAMES + COLUMNS - 1) // COLUMNS
    atlas = Image.new('RGBA', (COLUMNS * cell_width, rows * cell_height), (0, 0, 0, 0))
    for frame in range(FRAMES):
        amount = frame / (FRAMES - 1)
        if amount <= 0.68:
            rgb = wipe(amount)
        elif amount <= 0.85:
            rgb = interpolate(transition, (amount - 0.68) / 0.17)
        else:
            rgb = interpolate(finish, (amount - 0.85) / 0.15)
        rgba = np.dstack([rgb, np.uint8(np.clip(np.rint(alpha), 0, 255))])
        atlas.paste(Image.fromarray(rgba), ((frame % COLUMNS) * cell_width + PAD,
                                            (frame // COLUMNS) * cell_height + PAD))
    atlas.save(OUT / f'blink_{name}_atlas.png', optimize=True)
    return {'name': name, 'box': eye['box'], 'frames': FRAMES, 'columns': COLUMNS,
            'padding': PAD, 'cell': [cell_width, cell_height]}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    before = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
    if before != EXPECTED:
        raise ValueError('Approved source hash differs from the locked V1 source')
    full = np.asarray(Image.open(SOURCE).convert('RGB'))
    if full.shape != (3488, 1184, 3):
        raise ValueError(f'Unexpected source image dimensions: {full.shape}')
    original = full[CROP[1]:CROP[3], CROP[0]:CROP[2]]
    near, alignment = align_candidate(original, ROOT / 'artifacts/nearly_closed_candidate.png')
    strands = [prepare_strand(full, strand) for strand in STRANDS]
    eyes = [prepare_blink(eye, near) for eye in EYES]
    metadata = {'source_sha256': before, 'mesh_step': 16, 'near_eye_alignment': alignment,
                'strands': strands, 'eyes': eyes}
    (OUT / 'rig-v2.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + '\n')
    if hashlib.sha256(SOURCE.read_bytes()).hexdigest() != before:
        raise RuntimeError('Approved artwork unexpectedly changed')
    print(f"Prepared 2 strands and {FRAMES} local eye frames per eye. Alignment: {alignment}")
    print(f"Neutral strand reconstruction: {[(s['name'], s['neutral_mean_error'], s['neutral_max_error']) for s in strands]}")
    print(f'Approved source SHA-256 unchanged: {before}')


if __name__ == '__main__':
    main()
