"""Pixel-level safety invariants; not a replacement for visual review."""
import sys,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import numpy as np
from PIL import Image
from tools.clean_layer_content import original,head_mask,suspect_skin
m=json.load(open('assets/characters/animation-manifest.json'))
assert m['tiers']['2']['status']=='fallback'
assert m['tiers']['2']['contentAudit']['status']=='quarantined'
assert not m['tiers']['2']['layers']
assert len(m['tiers']['2']['candidateLayers'])==5
for tier in range(1,6):
 root=Path(f'assets/characters/tier{tier}')
 mask,box=head_mask(tier);weight=np.array(mask)/255
 a=np.array(Image.open(root/'body_base.png'));before=np.array(original(tier,'body_base'))
 assert a.shape==(1323,420,4)
 assert np.array_equal(a[:,:,3],before[:,:,3]),tier
 assert np.array_equal(a[weight==0],before[weight==0]),tier
 x,y,r,b=box
 forehead=before[y+int((b-y)*.12):y+int((b-y)*.30),x+int((r-x)*.35):x+int((r-x)*.65),:3]
 tone=np.median(forehead.reshape(-1,3),axis=0)
 yy,xx=np.mgrid[:1323,:420]
 shade=5-8*np.clip((yy-y)/max(b-y,1),0,1)-3*np.clip((xx-x)/max(r-x,1),0,1)
 expected=np.clip(tone[None,None,:]+shade[:,:,None],0,255).astype('uint8')
 assert np.array_equal(a[:,:,:3][weight==1],expected[weight==1]),tier
 zone=np.zeros((1323,420),bool);zone[max(0,y-15):min(1323,b+30),max(0,x-45):min(420,r+45)]=True
 for n in ['hair_front','hair_back']:
  hair=np.array(Image.open(root/f'{n}.png'))
  assert hair.shape==(1323,420,4)
  assert not np.any(suspect_skin(hair[:,:,:3])&zone&(hair[:,:,3]>0)),(tier,n)
  prior=np.array(original(tier,n));assert np.array_equal(hair[~zone],prior[~zone]),(tier,n)
 print('PASS blank head gradient, silhouette, hair-zone color guard; tier',tier)
print('PASS Tier 2 is quarantined with no runtime component paths')
