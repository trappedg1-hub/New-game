#!/usr/bin/env python3
"""Reproduce the local hem adjustment for the Stage 4 evening-outfit v2.

Requires Pillow 13.0.0 and NumPy 2.4.6. Operates only on the experiment;
never writes to Generated/Approved/. The feet and shoes remain untouched;
the nearby edge of the lace band may be resampled.
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "Generated/Experiments/outfit03_evening_fishnet_v2.png"
TARGET = ROOT / "Generated/Experiments/outfit03_evening_fishnet_v2_adjusted.png"


def smooth(value):
    value = np.clip(value, 0, 1)
    return value * value * (3 - 2 * value)


def main():
    if TARGET.exists():
        raise FileExistsError(f"Refusing to overwrite {TARGET}")
    image = Image.open(SOURCE).convert("RGB")
    width, height = image.size
    if (width, height) != (608, 1775):
        raise ValueError(f"Unexpected source dimensions: {image.size}")
    original = np.asarray(image)
    x = np.arange(width, dtype=np.float32)[None, :]
    y = np.arange(height, dtype=np.float32)[:, None]

    # Approximate the existing curved hem and raise it by up to 35 px. The
    # transition compresses the lower dress and stretches existing thigh skin,
    # gradually returning to the original coordinates near the lace band.
    hem = np.polyval(np.polyfit([110, 260, 420], [945, 925, 970], 2), x)
    lift = 35.0
    relative_y = y - (hem - lift)
    displacement = np.where(
        relative_y < 0,
        lift * np.clip((relative_y + 95) / 95, 0, 1),
        lift * np.clip(1 - relative_y / (35 + 48), 0, 1),
    )

    # Track the left body contour so the nearby hand remains in place.
    contour_y = np.array(
        [0, 800, 820, 840, 860, 880, 900, 910, 920, 925, 930, 935,
         940, 945, 950, 955, 960, 965, 970, 975, 980, 985, 990,
         995, 1000, 1010, 1020, 1040, 1774], dtype=np.float32
    )
    contour_x = np.array(
        [108, 108, 104, 102, 101, 101, 102, 103, 104, 104, 105, 106,
         106, 107, 109, 110, 111, 112, 113, 115, 116, 117, 118,
         119, 121, 125, 129, 137, 137], dtype=np.float32
    )
    left_edge = np.interp(y[:, 0], contour_y, contour_x)[:, None]
    alpha = smooth((x - (left_edge - 0.7)) / 1.4) * smooth((470 - x) / 30)
    displacement *= alpha
    source_y = np.clip(y + displacement, 0, height - 1)
    source_edge = np.interp(source_y, contour_y, contour_x)
    dx = (source_edge - left_edge) * smooth((left_edge + 22 - x) / 16) * alpha
    source_x = np.clip(x + dx, 0, width - 1)

    # Bilinear sampling; pixels with zero displacement are unchanged.
    y0 = np.floor(source_y).astype(np.int32)
    y1 = np.minimum(y0 + 1, height - 1)
    x0 = np.floor(source_x).astype(np.int32)
    x1 = np.minimum(x0 + 1, width - 1)
    fy = (source_y - y0)[..., None]
    fx = (source_x - x0)[..., None]
    pixels = np.rint(
        (1 - fy) * ((1 - fx) * original[y0, x0].astype(np.float32)
                    + fx * original[y0, x1].astype(np.float32))
        + fy * ((1 - fx) * original[y1, x0].astype(np.float32)
                + fx * original[y1, x1].astype(np.float32))
    ).clip(0, 255).astype(np.uint8)
    result = Image.fromarray(pixels)

    # Redraw a narrow antialiased section of the side contour where the
    # changed hem meets the protected hand; this is a local manual retouch.
    stroke_y = np.array(
        [900, 910, 920, 925, 930, 935, 940, 945, 950, 955, 960, 965, 970, 975, 980],
        dtype=np.float32,
    )
    stroke_x = np.array(
        [102, 103, 104, 104, 105, 106, 106, 107, 109, 110, 111, 112, 113, 115, 116],
        dtype=np.float32,
    )
    scale = 4
    mask = Image.new("L", (width * scale, height * scale))
    draw = ImageDraw.Draw(mask)
    points = [(round(np.interp(yy, stroke_y, stroke_x) * scale), yy * scale)
              for yy in range(909, 972)]
    draw.line(points, fill=255, width=7, joint="curve")
    mask = mask.resize((width, height), Image.Resampling.LANCZOS)
    result = Image.composite(Image.new("RGB", image.size, (32, 13, 10)), result, mask)

    changed = np.any(np.asarray(result) != original, axis=2)
    changed_y, changed_x = np.where(changed)
    bbox = (int(changed_x.min()), int(changed_y.min()),
            int(changed_x.max()), int(changed_y.max()))
    if bbox[0] < 100 or bbox[1] < 790 or bbox[2] > 470 or bbox[3] > 1040:
        raise RuntimeError(f"Unexpected changes outside the hem area: {bbox}")
    result.save(TARGET)
    print(f"Saved {TARGET}; changed {int(changed.sum())} pixels, bounds {bbox}.")


if __name__ == "__main__":
    main()
