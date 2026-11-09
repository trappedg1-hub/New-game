"""Regression for only-eye changes and exact open/closed silhouette registration."""
import json
import numpy as np
from PIL import Image
m=json.load(open('assets/characters/animation-manifest.json'))
for tier in map(str,range(1,6)):
 cfg=m['tiers'][tier]
 paths=cfg.get('candidateLayers') or cfg['layers']
 a=np.array(Image.open(paths['face']).convert('RGBA'))
 b=np.array(Image.open(paths['face_blink']).convert('RGBA'))
 assert a.shape==b.shape==(1323,420,4)
 assert np.array_equal(a[:,:,3],b[:,:,3]),tier
 allowed=np.zeros((1323,420),dtype=bool)
 for x,y,r,bt in cfg['blinkRegions']:allowed[y:bt,x:r]=True
 assert np.array_equal(a[~allowed],b[~allowed]),tier
 assert np.any(a!=b),tier
 assert Image.fromarray(a).getbbox()==Image.fromarray(b).getbbox(),tier
 print('PASS pixel-identical non-eye regions and alpha/head position',tier)
