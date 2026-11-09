"""Register independently generated Midnight Cat layers on the canonical
420x1323 canvas. Blink is eye-locked (closed face = open face with only the
eye regions replaced). The red rubber bone is a separate prop layer placed
under the raised foot: on tap the synced rig stomps and the prop squashes.
Ground, contacts, viewport and hair pivot are measured from the placed art.
"""
from pathlib import Path
import json
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SRC = Path('assets/characters/candidates/keyed/cat')
D = Path('assets/characters/costume_cat'); D.mkdir(parents=True, exist_ok=True)
W, H = 420, 1323
PROP_BOX = (45, 830, 255, 935)  # x, y, right, bottom on the shared canvas

def cropped(name):
    im = Image.open(SRC / (name + '.png')).convert('RGBA')
    return im.crop(im.getbbox())

def place(im, box):
    out = Image.new('RGBA', (W, H))
    out.alpha_composite(im.resize((box[2] - box[0], box[3] - box[1]), Image.Resampling.LANCZOS), box[:2])
    return out

def despill(im):
    pix = np.array(im).astype(int)
    edge = (np.array(im.getchannel('A').filter(ImageFilter.MinFilter(5))) < 255) & (pix[:, :, 3] > 0)
    green = edge & (pix[:, :, 1] > pix[:, :, 0] + 4) & (pix[:, :, 1] > pix[:, :, 2] + 4)
    pix[:, :, 1][green] = np.maximum(pix[:, :, 0], pix[:, :, 2])[green]
    return Image.fromarray(pix.clip(0, 255).astype('uint8'))

# ---- faces: lock everything except the eye regions ----
op = cropped('face_open')
cl = cropped('face_closed').resize(op.size, Image.Resampling.LANCZOS)
mask = Image.new('L', op.size)
draw = ImageDraw.Draw(mask)
for box in [(68, 272, 272, 362), (328, 266, 548, 356)]:
    draw.rounded_rectangle(box, 14, fill=255)
mask = mask.filter(ImageFilter.GaussianBlur(1.2))
blink = Image.composite(cl, op, mask)
blink.putalpha(op.getchannel('A'))
FACE_BOX = (144, 88, 276, 267)
faces = [place(im, FACE_BOX) for im in (op, blink)]

# ---- body: align measured neck centre (crop x~276/504) to face centre 210 ----
body_src = cropped('body_base')
bw = 310
scale = bw / body_src.width
bh = round(body_src.height * scale)
body_left = round(210 - 276 * scale)
body = place(body_src.resize((bw, bh), Image.Resampling.LANCZOS), (body_left, 195, body_left + bw, 195 + bh))

back = place(cropped('hair_back'), (70, 18, 350, 434))
front_src = cropped('hair_front')
fpix = np.array(front_src)
# Erase the thin jaw/neck outline arcs drawn inside the face hollow.
fpix[520:620, 180:450, 3] = 0
front = place(Image.fromarray(fpix), (85, 10, 335, 457))

# ---- prop: rubber bone under the raised foot ----
bone = despill(cropped('prop_bone'))
bone.save(D / 'prop_bone.png', optimize=True)
prop_canvas = place(bone, PROP_BOX)

layers = {'body_base': body, 'hair_back': back, 'face_open': faces[0],
          'face_closed': faces[1], 'hair_front': front}
for name, im in layers.items():
    despill(im).save(D / (name + '.png'), optimize=True)

# ---- composite previews / wardrobe art (prop included, behind the foot) ----
comp = Image.new('RGBA', (W, H))
for im in (despill(layers['hair_back']), prop_canvas, despill(layers['body_base']),
           despill(layers['face_open']), despill(layers['hair_front'])):
    comp.alpha_composite(im)
comp.save('assets/characters/single/costume_cat.png', optimize=True)
comp.save('assets/characters/costume_cat.png', optimize=True)
comp.save('assets/characters/costume_cat.webp', save_all=False)
comp.convert('RGBA').save('/home/user/cat-open.png')
comp.crop((70, 0, 360, 300)).save('/home/user/cat-head.png')

# ---- measured ground / viewport / pivot ----
a, b = (np.array(faces[0]), np.array(faces[1]))
yy, xx = np.where(np.any(a != b, axis=2))
assert np.array_equal(a[:, :, 3], b[:, :, 3]) and len(yy) and yy.max() < FACE_BOX[1] + (FACE_BOX[3] - FACE_BOX[1]) * .85
alpha = np.array(despill(body))[:, :, 3]
ys, xs = np.where(alpha > 32)
union = comp.getbbox()
ox, oy, ow, oh = union[0], union[1], union[2] - union[0], union[3] - union[1]
band = alpha[max(0, ys.max() - max(3, round(oh * .008))):ys.max() + 1] > 32
runs = []
for x in np.where(band.any(axis=0))[0]:
    if not runs or x - runs[-1][-1] > 5:
        runs.append([])
    runs[-1].append(int(x))
ground = {'size': [ow, oh], 'floor': float((ys.max() + 1 - oy) / oh),
          'contacts': [{'x': round(((r[0] + r[-1]) / 2 - ox) / ow, 5),
                        'width': round(max(.04, min(.22, (r[-1] - r[0] + 1) / ow)), 5)} for r in runs]}
entry = {
    'status': 'layered', 'canvas': [W, H],
    'source': 'assets/characters/single/costume_cat.png',
    'original': 'assets/characters/costume_cat.png',
    'layers': {k: f'assets/characters/costume_cat/{k}.png' for k in
               ('body_base', 'hair_back', 'face_open', 'face_closed', 'hair_front')},
    'prop': {'src': 'assets/characters/costume_cat/prop_bone.png',
             'box': [PROP_BOX[0], PROP_BOX[1], PROP_BOX[2] - PROP_BOX[0], PROP_BOX[3] - PROP_BOX[1]],
             'animation': 'tap-stomp-squash'},
    'registration': 'Independent generated components placed once on the shared 420x1323 canvas; eye-locked blink; rubber-bone prop under raised foot; measured ground/viewport/pivot.',
    'contentAudit': {'status': 'faceless-head-repaint-and-visual-review',
                     'report': 'assets/characters/costume_cat/registration.json'},
    'type': 'layered', 'environment': 'bedroom',
    'viewport': [ox, oy, ow, oh], 'ground': ground,
    'hairPivot': [(FACE_BOX[0] + FACE_BOX[2]) / 2, FACE_BOX[1]],
}
(D / 'registration.json').write_text(json.dumps({
    'status': 'registered', 'canvas': [W, H],
    'blinkChangeBounds': [int(xx.min()), int(yy.min()), int(xx.max() + 1), int(yy.max() + 1)],
    'identicalAlpha': True, 'nonEyePixelsLocked': True,
    'style': 'glossy anime game rendering, black form-fitting catsuit, cat-ear headband, bare feet with black pedicure, sole toward viewer, tsundere smug face, red rubber bone prop',
}, indent=2) + '\n')
mpath = Path('assets/characters/animation-manifest.json')
m = json.loads(mpath.read_text())
m['costumes']['cat'] = entry
m['version'] = 21
mpath.write_text(json.dumps(m, indent=2) + '\n')
print('cat registered', entry['viewport'], ground)
