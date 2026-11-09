"""Build real per-rig tan / gloss / dishevel art from the rig's own pixels.

For every layered rig this derives, on the shared 420x1323 canvas:
  tan/skin_mask.png     skin-only alpha (body + face skin; eyes/hair/clothes excluded)
  tan/tone_*.png        skin pixels re-graded to Sun-Kissed / Golden / Bronze
                        (shading preserved, SSS warm highlights baked in)
  tan/tanline_*.png     tanned skin + crisp pale #ffedd8 untanned shapes
                        (bikini bands / crossed straps / heart on left hip),
                        clipped strictly to the skin mask
  tan/gloss_specular.png  specular streaks from the art's own bright skin
  tan/slip_stage*.png   dishevel overlays: the rig's own shoulder/thigh
                        clothing bands shifted down (4/7/10px), feathered
Nothing outside the skin mask is ever painted, so clothing, hair and eyes
stay 100% untinted. Deterministic; no AI generation.
"""
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path('assets/characters')
m = json.loads((ROOT / 'animation-manifest.json').read_text())
TONES = {  # name: (target RGB, blend, sss strength)
    'sunkissed': ((230, 171, 126), .35, .10),
    'golden':    ((194, 130, 81),  .55, .22),
    'bronze':    ((148, 85, 43),   .70, .30),
}
PALE = (255, 237, 216)

def hsv_arrays(rgb):
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    mx, mn = rgb.max(axis=2), rgb.min(axis=2)
    lum = (0.2126 * r + 0.7152 * g + 0.0722 * b)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0)
    d = np.maximum(mx - mn, 1e-6)
    hue = np.where(mx == r, (60 * ((g - b) / d) + 360) % 360,
          np.where(mx == g, 60 * ((b - r) / d) + 120,
          np.where(mx == b, 60 * ((r - g) / d) + 240, 0)))
    return hue, sat, lum

def skin_classify(rgb):
    """Tight anime-skin palette; excludes cream knit, pink fabric, amber eyes."""
    hue, sat, lum = hsv_arrays(rgb)
    pinkness = rgb[:, :, 0] - 2 * rgb[:, :, 1] + rgb[:, :, 2]  # skin >> cream knit
    return (hue >= 10) & (hue <= 38) & (sat >= .07) & (sat <= .60) & (lum >= 95) & (pinkness >= 6)

def face_skin_mask(frgb, falpha):
    """Complete face silhouette minus features (dark brows/lashes, lips)."""
    hue, sat, lum = hsv_arrays(frgb)
    sil = falpha > 32
    dark = sil & (lum < 85)
    dark_im = Image.fromarray((dark * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(7))
    lips = sil & (((hue <= 8) | (hue >= 330)) & (sat > .26))
    return sil & ~(np.array(dark_im) > 0) & ~lips

def grade(rgb, alpha, mask, tone_rgb, blend, sss):
    lum = (0.2126 * rgb[:, :, 0] + 0.7152 * rgb[:, :, 1] + 0.0722 * rgb[:, :, 2]) / 255.0
    tone = np.array(tone_rgb, float)
    shaded = np.clip(tone[None, None, :] * (0.30 + 0.95 * lum[:, :, None]), 0, 255)
    out = rgb * (1 - blend) + shaded * blend
    hot = np.clip((lum - .72) / .28, 0, 1) * sss  # SSS warm pink on lit skin
    out = out * (1 - hot[:, :, None]) + np.array((255, 158, 122), float) * hot[:, :, None]
    res = np.zeros((*mask.shape, 4), np.uint8)
    res[:, :, :3] = np.clip(out, 0, 255)
    res[:, :, 3] = np.where(mask, alpha, 0)
    return Image.fromarray(res)

def heart(draw, cx, cy, s, fill):
    pts = []
    for t in np.linspace(0, 2 * np.pi, 60):
        x = 16 * np.sin(t) ** 3
        y = 13 * np.cos(t) - 5 * np.cos(2 * t) - 2 * np.cos(3 * t) - np.cos(4 * t)
        pts.append((cx + x * s / 16, cy - y * s / 16))
    draw.polygon(pts, fill=fill)


def label_components(mask, ds=3):
    """Connected components on a downsampled grid (fast BFS). Returns list of
    dicts with full-res approx stats and a boolean keep-mask per component."""
    small = np.array(Image.fromarray((mask * 255).astype(np.uint8)).resize(
        (mask.shape[1] // ds, mask.shape[0] // ds), Image.Resampling.BOX)) > 64
    H, W = small.shape
    lab = -np.ones((H, W), int)
    comps = []
    from collections import deque
    for y0 in range(H):
        for x0 in range(W):
            if not small[y0, x0] or lab[y0, x0] >= 0:
                continue
            cid = len(comps); q = deque([(y0, x0)]); lab[y0, x0] = cid; pts = []
            while q:
                y, x = q.popleft(); pts.append((y, x))
                for ny, nx in ((y+1,x),(y-1,x),(y,x+1),(y,x-1)):
                    if 0 <= ny < H and 0 <= nx < W and small[ny, nx] and lab[ny, nx] < 0:
                        lab[ny, nx] = cid; q.append((ny, nx))
            ys = np.array([p[0] for p in pts]) * ds; xs = np.array([p[1] for p in pts]) * ds
            comps.append({'area': len(pts) * ds * ds, 'miny': ys.min(), 'maxy': ys.max(),
                          'cy': ys.mean(), 'minx': xs.min(), 'maxx': xs.max(), 'cx': xs.mean()})
    return lab, comps, ds

for group in ('tiers', 'costumes'):
    for key, c in m[group].items():
        if c.get('type') != 'layered':
            continue
        rig_dir = Path(c['layers']['body_base']).parent
        out_dir = rig_dir / 'tan'; out_dir.mkdir(exist_ok=True)
        body = np.array(Image.open(c['layers']['body_base']).convert('RGBA'))
        face = np.array(Image.open(c['layers']['face_open']).convert('RGBA'))
        brgb, balpha = body[:, :, :3].astype(float), body[:, :, 3]
        frgb, falpha = face[:, :, :3].astype(float), face[:, :, 3]
        body_mask = skin_classify(brgb) & (balpha > 32)
        # Anatomical segmentation: erode to break thin bridges where warm
        # clothing shading touches real skin, label components, keep only
        # masses anchored to the neck, reaching the legs, or running from the
        # shoulders down the arms. Isolated clothing patches are dropped.
        _ys, _xs = np.where(balpha > 32)
        _by0, _by1 = _ys.min(), _ys.max(); _bh = _by1 - _by0
        _top = balpha[_by0:_by0 + 30] > 32
        _neck_cx = int(np.where(_top)[1].mean()) if _top.any() else 210
        eroded = np.array(Image.fromarray((body_mask * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(5))) > 0
        lab, comps, ds = label_components(eroded)
        neck_lab = lab[min(eroded.shape[0] - 1, (_by0 + 8) // ds), min(eroded.shape[1] - 1, _neck_cx // ds)] if len(comps) else -1
        keep = np.zeros(len(comps), bool)
        for i, cp in enumerate(comps):
            keep[i] = (i == neck_lab) or (cp['maxy'] >= _by0 + .52 * _bh) or ((cp['maxy'] - cp['miny']) >= .30 * _bh and cp['miny'] <= _by0 + .10 * _bh) or (cp['miny'] <= _by0 + .05 * _bh and cp['area'] >= 300)
        if len(comps):
            small_keep = keep[np.clip(lab, 0, len(comps) - 1)] & (lab >= 0)
            kept_full = np.array(Image.fromarray((small_keep * 255).astype(np.uint8)).resize((420, 1323), Image.Resampling.NEAREST)) > 0
            kept_full = np.array(Image.fromarray((kept_full * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(7))) > 0
            body_mask &= kept_full
        mask = body_mask | face_skin_mask(frgb, falpha)
        mask_im = Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(5))
        mask = np.array(mask_im) > 0
        if c.get('eyes'):  # never tint eyes
            yy, xx = np.mgrid[0:mask.shape[0], 0:mask.shape[1]]
            for ex, ey in c['eyes']:
                mask &= ((xx - ex) ** 2 + (yy - ey) ** 2) > 13 ** 2
        base_rgb = np.where((skin_classify(brgb) & (balpha > 32))[:, :, None], brgb, frgb)
        base_rgb = np.where(face_skin_mask(frgb, falpha)[:, :, None], frgb, base_rgb)
        base_alpha = np.maximum(balpha, falpha)
        Image.fromarray(np.dstack([np.full(mask.shape, 255, np.uint8)] * 3 + [np.where(mask, 255, 0).astype(np.uint8)])).save(out_dir / 'skin_mask.png', optimize=True)

        tones = {}
        for name, (rgb_t, blend, sss) in TONES.items():
            tones[name] = grade(base_rgb, base_alpha, mask, rgb_t, blend, sss)
            tones[name].save(out_dir / f'tone_{name}.png', optimize=True)

        ys, xs = np.where(balpha > 32)
        bx0, by0, bx1, by1 = xs.min(), ys.min(), xs.max(), ys.max()
        bw, bh, cx = bx1 - bx0, by1 - by0, (bx0 + bx1) / 2
        # pale untanned shapes, clipped to skin
        for pattern in ('bikini', 'straps', 'heart'):
            layer = Image.new('RGBA', (420, 1323), (0, 0, 0, 0))
            dr = ImageDraw.Draw(layer)
            if pattern == 'bikini':
                dr.ellipse([cx - .30 * bw, by0 + .10 * bh, cx + .30 * bw, by0 + .20 * bh], fill=PALE + (255,))
                dr.ellipse([cx - .33 * bw, by0 + .38 * bh, cx + .33 * bw, by0 + .50 * bh], fill=PALE + (255,))
                dr.ellipse([cx - .24 * bw, by0 + .52 * bh, cx + .24 * bw, by0 + .62 * bh], fill=PALE + (255,))
            elif pattern == 'straps':
                w2 = 9
                dr.polygon([(bx0 + .10 * bw, by0 + .02 * bh), (bx0 + .24 * bw, by0 + .02 * bh),
                            (cx + .20 * bw, by0 + .30 * bh), (cx + .02 * bw, by0 + .30 * bh)], fill=PALE + (255,))
                dr.polygon([(bx1 - .10 * bw, by0 + .02 * bh), (bx1 - .24 * bw, by0 + .02 * bh),
                            (cx - .20 * bw, by0 + .30 * bh), (cx - .02 * bw, by0 + .30 * bh)], fill=PALE + (255,))
            else:
                heart(dr, bx0 + .20 * bw, by0 + .46 * bh, 30, PALE + (255,))
            layer = layer.filter(ImageFilter.GaussianBlur(1.1))
            la = np.array(layer).astype(float)
            tan = np.array(tones['golden']).astype(float)
            pale_a = (la[:, :, 3:4] / 255.0)
            rgb = tan[:, :, :3] * (1 - pale_a) + la[:, :, :3] * pale_a
            res = np.zeros((1323, 420, 4), np.uint8)
            res[:, :, :3] = np.clip(rgb, 0, 255)
            res[:, :, 3] = np.where(mask, np.maximum(tan[:, :, 3], la[:, :, 3]), 0)
            Image.fromarray(res).save(out_dir / f'tanline_{pattern}.png', optimize=True)

        # specular gloss from the art's own bright skin
        lum = (0.2126 * base_rgb[:, :, 0] + 0.7152 * base_rgb[:, :, 1] + 0.0722 * base_rgb[:, :, 2]) / 255.0
        spec = np.clip((lum - .70) / .30, 0, 1)
        gloss = np.zeros((1323, 420, 4), np.uint8)
        gloss[:, :, :3] = 255
        gloss[:, :, 3] = np.where(mask, spec * 235, 0).astype(np.uint8)
        gloss_im = Image.fromarray(gloss).filter(ImageFilter.GaussianBlur(.7))
        ga = np.array(gloss_im); ga[:, :, 3] = np.where(mask, ga[:, :, 3], 0)
        Image.fromarray(ga).save(out_dir / 'gloss_specular.png', optimize=True)

        # dishevel overlays: own clothing bands shifted down, feathered
        body_im = Image.open(c['layers']['body_base']).convert('RGBA')
        for stage, (torso_dy, thigh_dy) in enumerate(((4, 0), (7, 5), (10, 8)), 1):
            ov = Image.new('RGBA', (420, 1323), (0, 0, 0, 0))
            bands = [(by0 + int(.01 * bh), by0 + int(.21 * bh), torso_dy)]
            if thigh_dy:
                bands.append((by0 + int(.52 * bh), by0 + int(.78 * bh), thigh_dy))
            for (y0, y1, dy) in bands:
                band = body_im.crop((int(cx - .36 * bw), y0, int(cx + .36 * bw), y1))
                arr = np.array(band).astype(float)
                ramp = np.linspace(0, 1, 23)
                fm = np.ones(arr.shape[:2], float)
                fm[:23] *= ramp[:, None]; fm[-23:] *= ramp[::-1][:, None]
                arr[:, :, 3] *= fm
                band_im = Image.fromarray(arr.astype(np.uint8))
                ov.paste(band_im, (int(cx - .36 * bw), y0 + dy), band_im)
            if stage == 3:  # unbuttoned accent: pale skin wedge at chest centre
                skin_px = brgb[mask & (balpha > 32)]
                sc = tuple(int(v) for v in np.median(skin_px, axis=0)) if len(skin_px) else (246, 205, 180)
                dr = ImageDraw.Draw(ov)
                top = by0 + int(.10 * bh)
                sc = tuple(int(v * .85) for v in sc)
                dr.polygon([(cx - 6, top), (cx + 6, top), (cx + 2, top + 64), (cx - 2, top + 64)], fill=sc + (220,))
            ov.save(out_dir / f'slip_stage{stage}.png', optimize=True)

        rel = rig_dir.as_posix()
        c['tanAssets'] = {
            'mask': f'{rel}/tan/skin_mask.png',
            'tone': {n: f'{rel}/tan/tone_{n}.png' for n in TONES},
            'pattern': {n: f'{rel}/tan/tanline_{n}.png' for n in ('bikini', 'straps', 'heart')},
            'gloss': f'{rel}/tan/gloss_specular.png',
            'slip': [f'{rel}/tan/slip_stage{i}.png' for i in (1, 2, 3)],
        }
        cov = 100 * mask.sum() / max(1, (balpha > 32).sum())
        print(key, 'skin coverage %.1f%% of body alpha' % cov)

m['version'] = 23
(ROOT / 'animation-manifest.json').write_text(json.dumps(m, indent=2) + '\n')
print('tan assets built for all layered rigs; manifest v23')
