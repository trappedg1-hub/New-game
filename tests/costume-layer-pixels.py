"""Runtime wardrobe rigs: alpha registration and finite eye-only blink support."""
import json
from pathlib import Path
import numpy as np
from PIL import Image
m=json.loads(Path('assets/characters/animation-manifest.json').read_text())
for name,c in m['costumes'].items():
 if c['type']!='layered':continue
 images={k:Image.open(p).convert('RGBA') for k,p in c['layers'].items()}
 assert all(list(im.size)==c['canvas'] for im in images.values()),name
 a,b=[np.array(images[k]) for k in ('face_open','face_closed')]
 assert np.array_equal(a[:,:,3],b[:,:,3]),name
 r=json.loads(Path(c['contentAudit']['report']).read_text());x,y,right,bottom=r['blinkChangeBounds']
 allowed=np.zeros(a.shape[:2],bool);allowed[y:bottom,x:right]=True
 assert np.array_equal(a[~allowed],b[~allowed]),name
 assert np.any(a!=b),name
 assert c['canvas']==[420,1323],name
 head=images['face_open'].getbbox()
 assert bottom<head[1]+(head[3]-head[1])*.85,name
 print('PASS',name,'registered canvas, identical alpha and non-eye pixels')
