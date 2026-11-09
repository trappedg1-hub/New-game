"""Keep open/closed faces pixel-identical except registered eyelid regions.
Uses the independent generated blink from the known pre-fix revision as source,
so re-running does not repeatedly blend or degrade the closed-eye patches.
No new images or full-character slices are created.
"""
from io import BytesIO
from pathlib import Path
import json, subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
BASE = '1b867902076cbd55f953cfb36c324ac75f5b7840'
REGIONS = {
    1: [(195, 118, 250, 159), (278, 119, 330, 156)],
    2: [(166, 117, 212, 149), (234, 110, 282, 143)],
    3: [(113, 138, 156, 165), (171, 122, 223, 154)],
    4: [(153, 703, 184, 730), (190, 690, 235, 721)],
    5: [(112, 128, 153, 156), (169, 116, 216, 147)],
}
SOURCE_SHIFT_Y = {1:9, 2:8, 3:0, 4:8, 5:5}
manifest_path = Path('assets/characters/animation-manifest.json')
manifest = json.loads(manifest_path.read_text())
for tier, regions in REGIONS.items():
    root = Path(f'assets/characters/tier{tier}')
    opened = Image.open(root / 'face.png').convert('RGBA')
    source = subprocess.check_output(['git', 'show', f'{BASE}:{root}/face_blink.png'])
    closed = Image.open(BytesIO(source)).convert('RGBA')
    assert opened.size == closed.size == (420,1323)
    # Finite support and feathering inside each box: no jaw/mouth/brow changes.
    mask = Image.new('L', opened.size)
    for box in regions:
        local = Image.new('L', (box[2]-box[0],box[3]-box[1]))
        ImageDraw.Draw(local).rounded_rectangle((2,2,local.width-3,local.height-3), 4, fill=255)
        local = local.filter(ImageFilter.GaussianBlur(1))
        mask.paste(local,(box[0],box[1]))
    # Register the generated closed eyelid line to the OPEN eye baseline, not
    # to a changed generated brow/cheek. Keep the original mouth/jaw intact.
    registered = Image.new('RGBA', opened.size)
    registered.alpha_composite(closed,(0,-SOURCE_SHIFT_Y[tier]))
    if tier == 1:
        # The old Tier 1 blink retained an open hidden eye. Use eyelids directly
        # from the independently generated closed face, not the old patch blend.
        raw = Image.open('tools/animation-reference/tier1-closed-eyes.png').convert('RGBA')
        for box, source_box in zip(regions, [(0,0,72,35),(92,4,151,36)]):
            patch = raw.crop(source_box).resize((box[2]-box[0],box[3]-box[1]),Image.Resampling.LANCZOS)
            registered.paste(patch,(box[0],box[1]))
    result = Image.composite(registered,opened,mask)
    result.putalpha(opened.getchannel('A'))  # exact same head silhouette/registration
    result.save(root / 'face_blink.png', optimize=True)
    a,b = np.array(opened),np.array(result)
    support = np.array(mask)>0
    assert np.array_equal(a[~support],b[~support])
    assert np.array_equal(a[:,:,3],b[:,:,3])
    assert np.any(a!=b), tier
    manifest['tiers'][str(tier)]['blinkRegions'] = regions
manifest['version'] = 5
manifest_path.write_text(json.dumps(manifest,indent=2)+'\n')
print('PASS five blink faces: identical canvas, silhouette and non-eye pixels')
