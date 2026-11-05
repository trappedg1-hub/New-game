"""Build *experimental V3-only* mouth/blush overlays; never alters approved art.

Uses aligned local studies, extracts only a protected mouth patch, and builds
short optical-flow-assisted transitions.  Eye and fingertip pixels are never
sourced from the studies.  Run with the dependencies in requirements.txt.
"""
from pathlib import Path
import json

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
FACE = ROOT / "artifacts/approved_face_crop.png"
OUTPUT = ROOT / "public/derived/expressions"
STUDIES = {
    "happy": "happy_candidate.png",
    "surprised": "surprised_candidate2.png",
    "shy": "shy_candidate.png",
    "playful": "playful_candidate.png",
    "sad": "sad_candidate.png",
}
# Coordinates relative to the exact approved crop at original-image (300,40).
X0, Y0, X1, Y1 = 225, 380, 355, 455
FRAMES, COLUMNS = 25, 5


def smoothstep(a, b, values):
    t = np.clip((values - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def align(study, reference):
    target = cv2.resize(cv2.imread(str(study)), (570, 570), interpolation=cv2.INTER_AREA)
    ref_bgr = cv2.cvtColor(reference, cv2.COLOR_RGB2BGR)
    sift = cv2.SIFT_create(nfeatures=1800, contrastThreshold=0.01)
    ka, da = sift.detectAndCompute(cv2.cvtColor(target, cv2.COLOR_BGR2GRAY), None)
    kb, db = sift.detectAndCompute(cv2.cvtColor(ref_bgr, cv2.COLOR_BGR2GRAY), None)
    matches = [a for a, b in cv2.BFMatcher().knnMatch(da, db, k=2) if a.distance < 0.72 * b.distance]
    if len(matches) < 30:
        raise RuntimeError(f"Insufficient alignment matches for {study}")
    source = np.float32([ka[m.queryIdx].pt for m in matches])
    destination = np.float32([kb[m.trainIdx].pt for m in matches])
    cv2.setRNGSeed(17)
    transform, inliers = cv2.estimateAffinePartial2D(source, destination, method=cv2.RANSAC, ransacReprojThreshold=3)
    if transform is None or int(inliers.sum()) < 25:
        raise RuntimeError(f"Unreliable alignment for {study}")
    warped = cv2.warpAffine(target, transform, (570, 570), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
    aligned = cv2.cvtColor(warped, cv2.COLOR_BGR2RGB)
    # Color-correct with surrounding clean skin, not eyes, mouth or fingertip.
    ring = np.zeros((570, 570), dtype=bool)
    ring[382:402, 238:351] = True
    ring[435:450, 240:351] = True
    yy, xx = np.mgrid[:570, :570]
    ring &= ~((yy >= 400) & (yy < 446) & (xx > 245) & (xx < 336))
    ring &= ~((yy > 440) & (xx > 280) & (xx < 345))
    difference = np.median(reference.astype(float)[ring] - aligned.astype(float)[ring], axis=0)
    aligned = np.uint8(np.clip(aligned.astype(float) + difference, 0, 255))
    return aligned, len(matches), int(inliers.sum())


def mouth_alpha():
    yy, xx = np.mgrid[Y0:Y1, X0:X1]
    alpha = smoothstep(231, 245, xx) * (1 - smoothstep(336, 350, xx))
    alpha *= smoothstep(383, 399, yy) * (1 - smoothstep(445, 452, yy))
    # The raised fingertip below the mouth is always the approved original.
    alpha *= 1 - smoothstep(444, 450, yy) * smoothstep(280, 295, xx) * (1 - smoothstep(338, 350, xx))
    return np.uint8(np.clip(alpha * 255, 0, 255))


def atlas_for(reference, target):
    neutral = reference[Y0:Y1, X0:X1]
    goal = target[Y0:Y1, X0:X1]
    h, w = neutral.shape[:2]
    # Interpolate tiny local changes at 3x to limit visible step artifacts.
    size = (w * 3, h * 3)
    a = cv2.resize(neutral, size, interpolation=cv2.INTER_CUBIC)
    b = cv2.resize(goal, size, interpolation=cv2.INTER_CUBIC)
    gray_a, gray_b = cv2.cvtColor(a, cv2.COLOR_RGB2GRAY), cv2.cvtColor(b, cv2.COLOR_RGB2GRAY)
    forward = cv2.calcOpticalFlowFarneback(gray_a, gray_b, None, 0.5, 4, 29, 5, 7, 1.5, 0)
    backward = cv2.calcOpticalFlowFarneback(gray_b, gray_a, None, 0.5, 4, 29, 5, 7, 1.5, 0)
    x, y = np.meshgrid(np.arange(size[0], dtype=np.float32), np.arange(size[1], dtype=np.float32))
    atlas = Image.new("RGBA", (w * COLUMNS, h * ((FRAMES + COLUMNS - 1) // COLUMNS)))
    alpha = mouth_alpha()
    for index in range(FRAMES):
        t = index / (FRAMES - 1)
        if index == 0:
            rgb = neutral
        elif index == FRAMES - 1:
            rgb = goal
        else:
            map_a = -(1 - t) * t * forward + t * t * backward
            map_b = (1 - t) * (1 - t) * forward - t * (1 - t) * backward
            warped_a = cv2.remap(a, x + map_a[:, :, 0], y + map_a[:, :, 1], cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
            warped_b = cv2.remap(b, x + map_b[:, :, 0], y + map_b[:, :, 1], cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
            rgb = cv2.resize(cv2.addWeighted(warped_a, 1 - t, warped_b, t, 0), (w, h), interpolation=cv2.INTER_AREA)
        frame = Image.fromarray(np.dstack((rgb, alpha)))
        atlas.paste(frame, ((index % COLUMNS) * w, (index // COLUMNS) * h))
    return atlas


def create_blush():
    # Translucent color only: existing skin, eyes, and texture remain visible.
    # Full-source coordinates for two cheeks below the V1 eye sprites.
    x0, y0, w, h = 415, 355, 300, 115
    yy, xx = np.mgrid[y0:y0 + h, x0:x0 + w]
    left = np.exp(-0.5 * (((xx - 475) / 33) ** 2 + ((yy - 418) / 15) ** 2))
    right = np.exp(-0.5 * (((xx - 643) / 33) ** 2 + ((yy - 377) / 15) ** 2))
    opacity = np.minimum(1, left + right) * 70
    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    rgba[:, :, :3] = (212, 82, 101)
    rgba[:, :, 3] = np.uint8(opacity)
    Image.fromarray(rgba).save(OUTPUT / "blush.png", optimize=True)
    return [x0, y0, w, h]


def create_sleepy(reference):
    aligned, matches, inliers = align(ROOT / "artifacts/sleepy_candidate.png", reference)
    eyes = json.loads((ROOT / "public/derived/rig.json").read_text())["eyes"]
    for eye in eyes:
        x0, y0, x1, y1 = eye["box"]
        # Reuse V1's feathered eye boundaries so no hair or eyebrow changes.
        alpha = np.array(Image.open(ROOT / f"public/derived/eye_{eye['name']}_open.png"))[:, :, 3]
        rgb = aligned[y0 - 40:y1 - 40, x0 - 300:x1 - 300]
        Image.fromarray(np.dstack((rgb, alpha))).save(OUTPUT / f"eye_{eye['name']}_sleepy.png", optimize=True)
    return {"file": "sleepy_candidate.png", "matches": matches, "inliers": inliers}


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    reference = np.array(Image.open(FACE).convert("RGB"))
    metadata = {
        "sourceCropOffset": [300, 40],
        "mouthRect": [300 + X0, 40 + Y0, X1 - X0, Y1 - Y0],
        "frames": FRAMES,
        "columns": COLUMNS,
        "studies": {},
    }
    for name, filename in STUDIES.items():
        aligned, matches, inliers = align(ROOT / "artifacts" / filename, reference)
        atlas_for(reference, aligned).save(OUTPUT / f"mouth_{name}.png", optimize=True)
        metadata["studies"][name] = {"file": filename, "matches": matches, "inliers": inliers}
    metadata["sleepyEyes"] = create_sleepy(reference)
    metadata["blushRect"] = create_blush()
    (OUTPUT / "expressions.json").write_text(json.dumps(metadata, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps(metadata, indent=2))


if __name__ == "__main__":
    main()
