"""Conservative cleanup of independently generated components, never whole-art slices.
Color heuristics are NOT semantic face detection. Tier 2 remains runtime fallback
until a separate visual registration review can clear it. Run after registration.
"""
from io import BytesIO
from pathlib import Path
import json, subprocess
import numpy as np
from PIL import Image, ImageFilter, ImageDraw
BASE='ee756bdfc89a153699fabf22f03fed98e8f555e1'

def original(tier,name):
    path=f'assets/characters/tier{tier}/{name}.png'
    return Image.open(BytesIO(subprocess.check_output(['git','show',f'{BASE}:{path}']))).convert('RGBA')

def head_mask(tier):
    face=original(tier,'face')
    polygons={
      1:[(175,14),(341,14),(341,149),(310,214),(265,239),(203,195),(163,162)],
      2:[(150,20),(300,20),(300,160),(270,192),(250,219),(211,226),(169,174)],
      3:[(100,22),(254,22),(254,160),(222,200),(180,220),(127,189)],
      4:[(138,625),(260,625),(260,718),(226,764),(202,779),(162,735)],
      5:[(89,22),(241,22),(241,159),(210,194),(174,218),(120,180)],
    }
    mask=Image.new('L',face.size)
    ImageDraw.Draw(mask).polygon(polygons[tier],fill=255)
    return mask.filter(ImageFilter.GaussianBlur(2)),face.getbbox()

def suspect_skin(rgb):
    r,g,b=[rgb[:,:,i].astype(float) for i in range(3)]
    return (r>105)&(((r>g+10)&(g>b+10))|((r>g+50)&(r>b+50)))

def clean_all():
    report={}
    for tier in range(1,6):
        root=Path(f'assets/characters/tier{tier}')
        mask,box=head_mask(tier);x,y,r,b=box
        body=original(tier,'body_base');a=np.array(body)
        # Sample plain forehead skin; generate a broad featureless lighting gradient.
        forehead=a[y+int((b-y)*.12):y+int((b-y)*.30),x+int((r-x)*.35):x+int((r-x)*.65),:3]
        tone=np.median(forehead.reshape(-1,3),axis=0)
        yy,xx=np.mgrid[:a.shape[0],:a.shape[1]]
        shade=5-8*np.clip((yy-y)/max(b-y,1),0,1)-3*np.clip((xx-x)/max(r-x,1),0,1)
        fill=np.clip(tone[None,None,:]+shade[:,:,None],0,255).astype(np.uint8)
        weight=np.array(mask)/255
        a[:,:,:3]=np.rint(a[:,:,:3]*(1-weight[:,:,None])+fill*weight[:,:,None]).astype(np.uint8)
        # Preserve the original silhouette exactly; no new head or opaque rectangle.
        Image.fromarray(a).save(root/'body_base.png',optimize=True)
        # Audit head plus margins, never clothing/legs or distant strand highlights.
        zone=np.zeros(a.shape[:2],bool)
        zone[max(0,y-15):min(a.shape[0],b+30),max(0,x-45):min(a.shape[1],r+45)]=True
        changes={'bodyHeadPixelsRepainted':int(np.count_nonzero(weight)), 'sampledSkinTone':tone.tolist()}
        for name in ('hair_front','hair_back'):
            hair=original(tier,name);h=np.array(hair)
            skin=suspect_skin(h[:,:,:3])&zone&(h[:,:,3]>0)
            # Remove warm skin/amber/blush plus its immediate antialiased edge.
            expanded=skin  # do not carve legitimate pink strand highlights/edges
            erase=expanded&zone
            h[erase]=0
            Image.fromarray(h).save(root/f'{name}.png',optimize=True)
            changes[name+'RemovedPixels']=int(np.count_nonzero(erase&(np.array(hair)[:,:,3]>0)))
        report[str(tier)]=changes
    Path('assets/characters/layer-content-audit.json').write_text(json.dumps({'sourceRevision':BASE,'method':'Smooth blank head repaint plus conservative warm-pixel removal inside head zones. Color tests are not semantic certification.','tiers':report},indent=2)+'\n')
    print(json.dumps(report,indent=2))

if __name__ == "__main__":
    clean_all()
