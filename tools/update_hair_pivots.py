"""Measure head attachment in registered canvas coordinates, not canvas edges.
Stores pixels so viewport rigs (kneeling tier4) retain the correct coordinate space.
"""
import json
from pathlib import Path
from PIL import Image
p=Path('assets/characters/animation-manifest.json');m=json.loads(p.read_text())
for c in [*m['tiers'].values(),*m['costumes'].values()]:
 if c.get('type')!='layered':continue
 im=Image.open(c['layers']['face_open']).convert('RGBA');x,y,r,b=im.getbbox()
 c['hairPivot']=[round((x+r)/2,2),y]
m['version']=max(18,m['version'])
p.write_text(json.dumps(m,indent=2)+'\n')
