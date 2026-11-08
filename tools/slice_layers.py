#!/usr/bin/env python3
"""Slice character PNGs into head/torso/lower bands for layered idle animation.
Emits WebP band crops + manifest.json. Falls back to whole-PNG per art."""
import numpy as np
from PIL import Image
import json, os, sys

CHARS = ['tier1','tier2','tier3','tier4','tier5',
         'costume_cardigan','costume_track','costume_apron',
         'costume_maid','costume_pool','costume_gown','costume_bunny']
SRC = 'assets/characters'
OUT = 'assets/layers'
FADE_PX = 34          # soft mask fade width (in px at native res)
OVERLAP = 26          # band crop overlap

def row_widths(a):
    al = (a[...,3] > 100)
    xs = np.where(al.any(axis=1), al.argmax(axis=1), -1)
    xe = np.where(al.any(axis=1), al.shape[1]-1-np.flip(al,1).argmax(axis=1), -1)
    w = np.where(xs>=0, xe-xs+1, 0)
    return w

def find_cut(w, y0, y1, H):
    """pronounced local minimum of width profile; returns y or None"""
    seg = w[int(y0*H):int(y1*H)]
    if len(seg) < 30: return None
    i = int(np.argmin(seg))
    peak = float(np.max(seg))
    val = float(seg[i])
    if peak <= 0: return None
    if val < 0.86*peak and val > 0.14*peak:
        return int(y0*H) + i
    return None

def slice_art(name):
    p = f'{SRC}/{name}.png'
    if not os.path.exists(p): return None
    im = Image.open(p).convert('RGBA')
    a = np.array(im); H, W = a.shape[:2]
    w = row_widths(a)
    # smooth profile
    k = max(5, H//120)
    ker = np.ones(k)/k
    ws = np.convolve(w, ker, mode='same')
    neck = find_cut(ws, 0.14, 0.42, H)
    waist = find_cut(ws, 0.40, 0.66, H) if neck else None
    if waist is not None and neck is not None and waist < neck + int(0.08*H):
        waist = None
    os.makedirs(f'{OUT}/{name}', exist_ok=True)
    bands = []
    def emit(key, y0, y1, anim):
        y0 = max(0, y0); y1 = min(H, y1)
        crop = im.crop((0, y0, W, y1))
        fn = f'{OUT}/{name}/{key}.webp'
        crop.save(fn, 'WEBP', quality=84, method=6)
        bands.append({'file': f'assets/layers/{name}/{key}.webp',
                      'top': round(y0/H, 5), 'height': round((y1-y0)/H, 5),
                      'anim': anim})
    if neck is None:
        # fallback: whole png band
        emit('body', 0, H, 'breathe')
        return {'fallback': True, 'bands': bands, 'w': W, 'h': H}
    if waist is None:
        emit('head', 0, neck+OVERLAP, 'hair')
        emit('body', max(0, neck-OVERLAP), H, 'breathe')
    else:
        emit('head', 0, neck+OVERLAP, 'hair')
        emit('torso', max(0, neck-OVERLAP), waist+OVERLAP, 'breathe')
        emit('lower', max(0, waist-OVERLAP), H, 'flutter')
    return {'fallback': False, 'bands': bands, 'w': W, 'h': H,
            'neck': neck, 'waist': waist}

def webp_convert():
    """originals -> webp (game art + backgrounds) for weight savings"""
    made = []
    for d, q in [('assets/characters', 82), ('assets/backgrounds', 76)]:
        for f in sorted(os.listdir(d)):
            if not f.endswith('.png'): continue
            src = f'{d}/{f}'
            dst = src[:-4] + '.webp'
            if os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src):
                continue
            Image.open(src).save(dst, 'WEBP', quality=q, method=6)
            made.append(dst)
    return made

def icons():
    os.makedirs('assets/icons', exist_ok=True)
    im = Image.open('assets/characters/tier1.png').convert('RGBA')
    a = np.array(im); al = a[...,3]>100
    ys, xs = np.where(al)
    # head box: top18% of bbox, square centered on head x
    y0, y1 = ys.min(), ys.min() + int((ys.max()-ys.min())*0.20)
    band = xs[(ys>=y0)&(ys<y1)]
    cx = int((band.min()+band.max())/2)
    side = int((y1-y0)*1.05)
    x0 = max(0, cx-side//2); x1 = min(im.width, x0+side)
    y0b = max(0, y0-int(side*0.06)); y1b = min(im.height, y0b+side)
    head = im.crop((x0, y0b, x1, y1b))
    for size in (192, 512):
        h = head.resize((size, size), Image.LANCZOS)
        bg = Image.new('RGBA', (size, size), (18,18,40,255))
        # circle mask
        mask = Image.new('L', (size, size), 0)
        from PIL import ImageDraw
        ImageDraw.Draw(mask).ellipse([2,2,size-3,size-3], fill=255)
        bg.paste(h, (0,0), mask)
        bg.save(f'assets/icons/icon-{size}.png')
    print('icons done')

if __name__ == '__main__':
    manifest = {}
    for n in CHARS:
        r = slice_art(n)
        if r: manifest[n] = r; print(n, 'fallback' if r['fallback'] else f"bands={len(r['bands'])} neck={r.get('neck')} waist={r.get('waist')}")
    os.makedirs(OUT, exist_ok=True)
    json.dump(manifest, open(f'{OUT}/manifest.json','w'), indent=1)
    made = webp_convert()
    print('webp new:', len(made))
    icons()
    print('manifest arts:', len(manifest))
