"""Resample existing clean whole PNGs to 4096px high. No slicing or invented detail."""
from pathlib import Path
import json
from PIL import Image
root=Path(__file__).resolve().parents[1]
folder=root/'assets/characters'
manifest={'version':7,'renderer':'single','tiers':{},'costumes':{},'notes':'Whole original illustrations only. 4096px-high PNGs are Lanczos upscales of native originals, not newly generated native 4K detail.'}
for source in sorted(folder.glob('*.png')):
    if not (source.stem.startswith('tier') or source.stem.startswith('costume_')): continue
    with Image.open(source) as im:
        native=list(im.size)
        im=im.convert('RGBA')
        # Tier 3's native whole illustration has a bright green key fringe.
        # Remove only strongly green pixels; do not cut out or reassemble any parts.
        if source.stem == 'tier3':
            pixels=im.load()
            for y in range(im.height):
                for x in range(im.width):
                    r,g,b,a=pixels[x,y]
                    if g > r+30 and g > b+10 and g > 90:
                        pixels[x,y]=(r,g,b,0)
        size=(round(im.width*4096/im.height),4096)
        im=im.resize(size,Image.Resampling.LANCZOS)
        dest=folder/'single'/source.name
        im.save(dest,optimize=True)
    entry={'type':'single','status':'single','source':str(dest.relative_to(root)),'canvas':list(size),'original':str(source.relative_to(root)),'nativeCanvas':native,'upscaled':True}
    group,key=('tiers',source.stem[4:]) if source.stem.startswith('tier') else ('costumes',source.stem[8:])
    manifest[group][key]=entry
(folder/'animation-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
