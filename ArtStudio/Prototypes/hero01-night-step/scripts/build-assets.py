#!/usr/bin/env python3
"""Build source-derived, isolated 2D skins for the approved night-step image.

The approved PNG is read, never rewritten. Invisible areas are approximated
from the dark background; they are not presented as original layers.
"""
from pathlib import Path
import hashlib
import json
import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent.parent / 'Generated/Approved/HERO-01_outfit10_night_lingerie_step_pose.png'
OUT = ROOT / 'public/derived'
EXPECTED = 'bfa845260fdaecdb44d4e01fb57f608c193910d1db98f8ed7b6d3340262729f7'
W = H = 1024
# Coordinates are in the actual approved source image, not a re-drawn figure.
POLYGONS = {
    'arm_left': [(423,165),(454,165),(452,195),(444,226),(433,261),(422,295),(405,325),
                 (380,354),(355,380),(342,397),(336,420),(327,447),(309,448),(293,434),
                 (289,416),(291,397),(312,380),(331,370),(348,347),(366,315),(383,282),
                 (397,245),(405,211),(407,186)],
    'arm_right': [(590,165),(620,162),(636,181),(645,213),(651,252),(660,291),(672,320),
                  (690,352),(705,378),(722,391),(728,404),(730,424),(718,449),(701,454),
                  (687,442),(684,428),(680,415),(672,401),(665,386),(657,369),(645,350),
                  (634,323),(621,296),(609,263),(602,230),(590,205)],
    'leg_left': [(391,354),(410,333),(459,325),(493,333),(513,352),(520,384),(524,420),
                 (518,464),(505,496),(495,525),(487,560),(487,589),(506,598),(518,618),
                 (521,650),(519,697),(518,758),(511,813),(500,864),(481,925),(458,960),
                 (432,973),(392,974),(364,965),(347,947),(338,919),(333,881),(326,843),
                 (320,803),(318,756),(320,716),(324,683),(345,653),(359,628),(358,598),
                 (359,568),(368,536),(382,507),(394,484),(388,456),(381,425),(380,389)],
    'leg_right': [(535,365),(565,351),(611,365),(637,387),(650,419),(649,455),(641,502),
                  (631,552),(629,598),(635,653),(633,702),(627,759),(619,813),(611,865),
                  (607,900),(613,938),(625,974),(626,1002),(622,1022),(526,1023),(522,1000),
                  (527,970),(531,940),(536,900),(538,862),(541,819),(546,769),(549,718),
                  (548,672),(544,632),(539,591),(535,548),(533,504),(529,459),(529,413)],
}
RANGES = {'arm_left': (197,250), 'arm_right': (198,250),
          'leg_left': (400,447), 'leg_right': (382,442)}
# Hand-traced arm contours prevent adjacent hair/thigh pixels from being
# separated with the limbs. Bounds are [y, left, right] in source space.
ARM_EXTENTS = {
    'arm_left': [(190,420,455),(220,410,444),(250,400,435),(280,386,428),(290,380,422),
                 (300,374,415),(310,368,409),(320,362,404),(330,356,398),(340,350,393),
                 (350,340,386),(360,333,379),(370,325,370),(380,313,361),(390,302,354),
                 (400,294,350),(410,287,345),(430,289,340),(455,297,340)],
    'arm_right':[(190,592,623),(220,595,625),(250,596,633),(280,608,647),(290,612,653),
                 (300,621,658),(310,627,663),(320,633,668),(330,638,672),(340,642,676),
                 (350,646,682),(360,650,687),(370,655,694),(380,659,702),(390,663,710),
                 (400,668,724),(410,673,731),(420,679,733),(430,680,733),(455,684,733)]
}


def smooth(a, b, v):
    t = np.clip((v - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def occupancy(alpha, box):
    cols = rows = 65
    dx = W / (cols - 1); dy = H / (rows - 1)
    x0, y0, w, h = box
    first_col = max(0, int(np.floor(x0 / dx))); last_col = min(cols - 1, int(np.ceil((x0 + w) / dx)))
    first_row = max(0, int(np.floor(y0 / dy))); last_row = min(rows - 1, int(np.ceil((y0 + h) / dy)))
    lc = last_col - first_col + 1; lr = last_row - first_row + 1
    cells = []
    for row in range(lr - 1):
        for col in range(lc - 1):
            left = max(0, int(np.floor((first_col + col) * dx - x0)) - 12)
            right = min(w, int(np.ceil((first_col + col + 1) * dx - x0)) + 12)
            top = max(0, int(np.floor((first_row + row) * dy - y0)) - 12)
            bottom = min(h, int(np.ceil((first_row + row + 1) * dy - y0)) + 12)
            if left < right and top < bottom and np.any(alpha[top:bottom, left:right]):
                cells.append(row * (lc - 1) + col)
    return {'grid': [cols, rows], 'size': [lc, lr], 'halo': 12, 'active_cells': cells}


def make_layers(rgb):
    # Sample the empty left/right margins by row. The scene is a dark backdrop;
    # these estimates replace hidden pixels only where a separated limb moves.
    left = np.median(rgb[:, 30:245].astype(np.float32), axis=1)
    right = np.median(rgb[:, 780:995].astype(np.float32), axis=1)
    left = cv2.GaussianBlur(left[:, None, :], (1, 0), 0, sigmaY=6)[:, 0, :]
    right = cv2.GaussianBlur(right[:, None, :], (1, 0), 0, sigmaY=6)[:, 0, :]
    xx = np.linspace(0, 1, W, dtype=np.float32)[None, :, None]
    bg = left[:, None, :] * (1 - xx) + right[:, None, :] * xx
    difference = np.max(np.abs(rgb.astype(np.float32) - bg), axis=2)
    rows = np.arange(H, dtype=np.float32)[:, None]
    alphas, supports = {}, {}
    for name, points in POLYGONS.items():
        area = np.zeros((H, W), np.uint8)
        cv2.fillPoly(area, [np.asarray(points, np.int32)], 255)
        area = cv2.GaussianBlur(area, (5, 5), 1.0).astype(np.float32) / 255
        if name.startswith('arm_'):
            # The source has golden hair behind the upper arms. Skin has a
            # warmer red/green-to-green/blue ratio than those hair strands;
            # use it only inside the hand-traced arm domain, then close small
            # highlight holes and collect the dark anti-aliased outline.
            values = rgb.astype(np.int16)
            r, g, b = values[:,:,0], values[:,:,1], values[:,:,2]
            skin = ((r > 68) & (r - g > 17) & (r - b > 34) &
                    ((r - g) * 10 > (g - b) * 13)).astype(np.uint8) * 255
            skin = cv2.morphologyEx(skin, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
            skin = cv2.dilate(skin, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
            foreground = skin.astype(np.float32) / 255
        else:
            foreground = smooth(4, 22, difference)
        # Keep anti-aliased dark contours but not the empty dark background.
        alpha = area * foreground
        alpha = cv2.morphologyEx(alpha, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
        alpha = cv2.GaussianBlur(alpha, (5, 5), 0.8)
        root = smooth(*RANGES[name], rows)
        alpha *= root
        binary = (alpha > 0.025).astype(np.uint8) * 255
        radius = 9 if name.startswith('arm_') else 17
        support = cv2.dilate(binary, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (radius, radius)))
        support = cv2.GaussianBlur(support, (11, 11), 2.3).astype(np.float32) / 255 * root
        if name in ARM_EXTENTS:
            points = np.array(ARM_EXTENTS[name], np.float32)
            lo = np.interp(rows[:,0], points[:,0], points[:,1])[:,None]
            hi = np.interp(rows[:,0], points[:,0], points[:,2])[:,None]
            columns = np.arange(W, dtype=np.float32)[None,:]
            # The inner contour runs directly against the bright edge of the
            # thigh. Keep that edge on the body, rather than dragging a pale
            # strip with the moving arm. The outer contour retains a soft edge.
            if name == 'arm_left':
                window = smooth(-3, 1, columns - lo) * (1 - smooth(-1, .5, columns - hi))
            else:
                window = smooth(-.5, 1, columns - lo) * (1 - smooth(-1, 3, columns - hi))
            alpha *= window
            support *= window
        if name == 'leg_left':
            alpha[:, 523:] = 0; support[:, 523:] = 0
        elif name == 'leg_right':
            alpha[:, :523] = 0; support[:, :523] = 0
            # The planted toe is an immutable floor anchor at the canvas edge.
            edge = 1 - smooth(1005, 1023, rows)
            alpha *= edge; support *= edge
        alphas[name] = alpha
        supports[name] = support
    overlap = sum((s > .001).astype(np.uint8) for s in supports.values())
    if int(overlap.max()) > 1:
        for left_name in supports:
            for right_name in supports:
                if left_name >= right_name: continue
                yy, xx = np.nonzero((supports[left_name] > .001) & (supports[right_name] > .001))
                if len(xx): print('Overlap', left_name, right_name, 'pixels', len(xx), 'range', (int(xx.min()), int(yy.min()), int(xx.max()), int(yy.max())))
        raise RuntimeError('Limb supports overlap; neutral alpha reconstruction would be ambiguous.')
    support_all = np.maximum.reduce(list(supports.values()))
    # Hidden pixels are approximated from the dark backdrop. Hair is kept on
    # the body when the skin classifier excludes it from the arm masks.
    body = np.uint8(np.clip(np.rint(rgb * (1 - support_all[:, :, None]) + bg * support_all[:, :, None]), 0, 255))
    OUT.joinpath('jointed').mkdir(parents=True, exist_ok=True)
    Image.fromarray(body).save(OUT / 'jointed/body.png', optimize=True)
    layers = {}; composited = Image.fromarray(body).convert('RGBA')
    for name in ['leg_right', 'leg_left', 'arm_left', 'arm_right']:
        s = supports[name]; yy, xxp = np.nonzero(s > 0)
        if not len(yy): raise RuntimeError(f'Empty layer {name}')
        x0, x1 = max(0, int(xxp.min()) - 3), min(W, int(xxp.max()) + 4)
        y0, y1 = max(0, int(yy.min()) - 3), min(H, int(yy.max()) + 4)
        src = rgb[y0:y1, x0:x1].astype(np.float32)
        back = body[y0:y1, x0:x1].astype(np.float32)
        a = alphas[name][y0:y1, x0:x1].copy()
        support = s[y0:y1, x0:x1]
        delta = src - back
        required = np.where(delta >= 0, delta / np.maximum(255 - back, 1), -delta / np.maximum(back, 1)).max(axis=2)
        a = np.maximum(a, required)
        # Tiny alpha with 8-bit inverse compositing creates saturated RGB
        # speckles in outlines. A low, dark matte floor keeps moving edges
        # neutral while still reconstructing the source exactly at rest.
        a = np.maximum(a, np.where(support > 0, 0.18, 0))
        a[support == 0] = 0
        a8 = np.ceil(np.clip(a, 0, 1) * 255).astype(np.uint8)
        unit = a8.astype(np.float32) / 255
        color = np.zeros_like(src); visible = unit > 0
        color[visible] = (src[visible] - (1 - unit[visible, None]) * back[visible]) / unit[visible, None]
        rgba = np.dstack([np.uint8(np.clip(np.rint(color), 0, 255)), a8])
        img = Image.fromarray(rgba)
        img.save(OUT / f'jointed/{name}.png', optimize=True)
        composited.alpha_composite(img, (x0, y0))
        box = [x0, y0, x1 - x0, y1 - y0]
        layers[name] = {'file': f'{name}.png', 'box': box, 'mesh': occupancy(a8, box)}
    diff = np.abs(np.asarray(composited.convert('RGB')).astype(np.int16) - rgb.astype(np.int16))
    mean, maxdiff = float(diff.mean()), int(diff.max())
    print('Neutral RGB composite: mean', mean, 'max', maxdiff)
    if maxdiff > 2: raise RuntimeError('Neutral composite differs from approved source by more than 2 levels')
    meta = {'source_sha256': EXPECTED, 'size': [W, H], 'body': 'body.png', 'layers': layers,
            'neutral_mean_difference': mean, 'neutral_max_difference': maxdiff,
            'hidden_pixels': 'approximated from dark backdrop; not recovered source artwork'}
    (OUT / 'jointed/jointed.json').write_text(json.dumps(meta, ensure_ascii=False, indent=2) + '\n')
    print('Layer boxes:', json.dumps({k: v['box'] for k, v in layers.items()}))


def make_blinks(rgb):
    # Construct small local eye-closed overlays from the source itself. These
    # are approximate inpainted eyelids, not a separately approved artwork.
    specs = [
        {'name':'left', 'box':[461, 86, 494, 109],
         'remove':[(465,102),(469,96),(475,92),(482,90),(490,91),(491,98),(484,102),(476,105),(468,106)],
         'line':[(466,101),(472,98),(479,96),(485,94),(490,93)]},
        {'name':'right', 'box':[503, 72, 541, 95],
         'remove':[(507,86),(512,81),(518,77),(525,75),(533,76),(537,79),(536,85),(529,88),(520,90),(511,91)],
         'line':[(508,86),(513,83),(520,80),(528,78),(536,79)]},
    ]
    OUT.mkdir(parents=True, exist_ok=True)
    result=[]
    for eye in specs:
        x0,y0,x1,y1=eye['box']
        remove=np.zeros((H,W),np.uint8)
        cv2.fillPoly(remove,[np.asarray(eye['remove'],np.int32)],255)
        remove=cv2.dilate(remove,np.ones((3,3),np.uint8))
        filled=cv2.inpaint(cv2.cvtColor(rgb,cv2.COLOR_RGB2BGR),remove,5,cv2.INPAINT_TELEA)
        closed=cv2.cvtColor(filled,cv2.COLOR_BGR2RGB)
        cv2.polylines(closed,[np.asarray(eye['line'],np.int32)],False,(74,44,44),1,cv2.LINE_AA)
        alpha=np.zeros((H,W),np.uint8)
        cv2.fillPoly(alpha,[np.asarray(eye['remove'],np.int32)],255)
        alpha=cv2.dilate(alpha,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(5,5)))
        alpha=cv2.GaussianBlur(alpha,(7,7),1.4)
        rgba=np.dstack([closed[y0:y1,x0:x1],alpha[y0:y1,x0:x1]])
        name=f'eye_{eye["name"]}_closed.png'
        Image.fromarray(rgba).save(OUT/name,optimize=True)
        result.append({'name':eye['name'],'file':name,'box':eye['box']})
    (OUT/'rig.json').write_text(json.dumps({'source_sha256':EXPECTED,'size':[W,H],'eyes':result},ensure_ascii=False,indent=2)+'\n')


def main():
    if hashlib.sha256(SOURCE.read_bytes()).hexdigest() != EXPECTED:
        raise RuntimeError('Approved source does not match the recorded SHA-256')
    image=Image.open(SOURCE).convert('RGB')
    if image.size != (W,H): raise RuntimeError('Unexpected approved source size')
    rgb=np.asarray(image)
    make_layers(rgb); make_blinks(rgb)
    print('Built derivatives without changing', SOURCE)

if __name__ == '__main__': main()
