#!/usr/bin/env python3
"""Prepare experimental blink patches, without ever writing to approved art.

The generated candidate is an aligned eyes-closed *study*, not an approved image.
This script makes just the small pieces used by the Pixi prototype. See README.md.
"""
from pathlib import Path
import hashlib
import json

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ART_STUDIO = ROOT.parents[1]
APPROVED = ART_STUDIO / 'Generated/Approved/HERO-01_outfit02_playful_maid.png'
CANDIDATE = ROOT / 'artifacts/closed_eyes_candidate.png'
OUTPUT = ROOT / 'public/derived'
OUTPUT.mkdir(parents=True, exist_ok=True)

# The candidate was generated from this exact crop of the approved image.
CROP = (300, 40, 870, 610)
EYES = [
    {
        'name': 'left',
        'box': [395, 340, 540, 430],
        'pivot': [468, 403],
        'angle': -0.085,
        'polygon': [(407, 386), (412, 366), (426, 352), (442, 349), (465, 349),
                    (489, 354), (508, 361), (525, 372), (528, 384), (524, 401),
                    (509, 409), (487, 418), (465, 421), (442, 418), (425, 410), (410, 400)],
        'lash_removal': [(411, 384), (424, 380), (437, 374), (453, 371), (478, 370),
                         (496, 369), (513, 371), (527, 376), (527, 389), (513, 391),
                         (494, 394), (474, 398), (454, 403), (438, 407), (422, 407), (408, 400)],
    },
    {
        'name': 'right',
        'box': [565, 280, 705, 375],
        'pivot': [638, 347],
        'angle': -0.21,
        'polygon': [(568, 342), (575, 322), (589, 306), (604, 297), (628, 289),
                    (659, 286), (682, 288), (699, 294), (699, 307), (690, 325),
                    (676, 340), (659, 351), (638, 358), (611, 364), (587, 362), (572, 354)],
        'lash_removal': [(574, 340), (585, 330), (598, 319), (619, 315), (640, 310),
                         (657, 309), (671, 310), (692, 307), (700, 304), (697, 327),
                         (681, 336), (660, 339), (639, 342), (619, 348), (597, 356), (580, 356)],
    },
]


def local(points):
    return np.array([(x - CROP[0], y - CROP[1]) for x, y in points], dtype=np.int32)


def main():
    before = hashlib.sha256(APPROVED.read_bytes()).hexdigest()
    full_rgb = np.array(Image.open(APPROVED).convert('RGB'))
    expected_size = (3488, 1184)
    if full_rgb.shape[:2] != expected_size:
        raise ValueError(f'Unexpected approved image dimensions: {full_rgb.shape}')
    original = cv2.cvtColor(full_rgb[CROP[1]:CROP[3], CROP[0]:CROP[2]], cv2.COLOR_RGB2BGR)
    candidate = cv2.imread(str(CANDIDATE), cv2.IMREAD_COLOR)
    if candidate is None:
        raise FileNotFoundError(CANDIDATE)
    candidate = cv2.resize(candidate, (570, 570), interpolation=cv2.INTER_AREA)

    # The candidate is visually very close, but align hair/skin features to the
    # reference rather than assuming that the image generator preserved placement.
    sift = cv2.SIFT_create(nfeatures=1500, contrastThreshold=0.01)
    kp_ref, desc_ref = sift.detectAndCompute(cv2.cvtColor(original, cv2.COLOR_BGR2GRAY), None)
    kp_candidate, desc_candidate = sift.detectAndCompute(cv2.cvtColor(candidate, cv2.COLOR_BGR2GRAY), None)
    pairs = cv2.BFMatcher().knnMatch(desc_candidate, desc_ref, k=2)
    good = [m for m, n in pairs if m.distance < 0.72 * n.distance]
    if len(good) < 20:
        raise ValueError('Not enough feature matches to align the eye study safely')
    src = np.float32([kp_candidate[m.queryIdx].pt for m in good])
    dst = np.float32([kp_ref[m.trainIdx].pt for m in good])
    matrix, inliers = cv2.estimateAffinePartial2D(src, dst, method=cv2.RANSAC, ransacReprojThreshold=3)
    if matrix is None or int(inliers.sum()) < 20:
        raise ValueError('Could not safely align the eye study')
    aligned = cv2.warpAffine(candidate, matrix, (570, 570), flags=cv2.INTER_CUBIC,
                             borderMode=cv2.BORDER_REPLICATE)

    # Remove the candidate's lashes only for the skin underneath an animated
    # open-eye patch; the intact closed-eye patch is used at the end of a blink.
    removal = np.zeros((570, 570), dtype=np.uint8)
    for eye in EYES:
        cv2.fillPoly(removal, [local(eye['lash_removal'])], 255)
    removal = cv2.dilate(removal, np.ones((3, 3), np.uint8), iterations=1)
    underpaint = cv2.inpaint(aligned, removal, 7, cv2.INPAINT_TELEA)
    aligned_rgb = cv2.cvtColor(aligned, cv2.COLOR_BGR2RGB)
    underpaint_rgb = cv2.cvtColor(underpaint, cv2.COLOR_BGR2RGB)

    for eye in EYES:
        mask = np.zeros((570, 570), dtype=np.uint8)
        cv2.fillPoly(mask, [local(eye['polygon'])], 255)
        mask = cv2.GaussianBlur(mask, (0, 0), 3)
        x0, y0, x1, y1 = eye['box']
        local_mask = mask[y0-CROP[1]:y1-CROP[1], x0-CROP[0]:x1-CROP[0]]
        layers = {
            'open': full_rgb[y0:y1, x0:x1],
            'underpaint': underpaint_rgb[y0-CROP[1]:y1-CROP[1], x0-CROP[0]:x1-CROP[0]],
            'closed': aligned_rgb[y0-CROP[1]:y1-CROP[1], x0-CROP[0]:x1-CROP[0]],
        }
        for layer, rgb in layers.items():
            Image.fromarray(np.dstack([rgb, local_mask])).save(OUTPUT / f"eye_{eye['name']}_{layer}.png")

    metadata = {
        'source': str(APPROVED.relative_to(ART_STUDIO)),
        'source_sha256': before,
        'crop_xyxy': CROP,
        'candidate': 'artifacts/closed_eyes_candidate.png (experimental, not approved)',
        'alignment_matrix': matrix.round(7).tolist(),
        'matching_features': len(good),
        'alignment_inliers': int(inliers.sum()),
        'eyes': [{k: v for k, v in eye.items() if k in ('name', 'box', 'pivot', 'angle')} for eye in EYES],
    }
    (OUTPUT / 'rig.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + '\n')
    after = hashlib.sha256(APPROVED.read_bytes()).hexdigest()
    if before != after:
        raise RuntimeError('Approved source unexpectedly changed')
    print(f"Prepared six experimental eye layers. Feature matches: {len(good)} / inliers: {int(inliers.sum())}")
    print(f'Approved source SHA-256 unchanged: {before}')


if __name__ == '__main__':
    main()
