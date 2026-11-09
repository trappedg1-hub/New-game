"""Remove explicit green production background, preserving generated source files.
Outputs remain candidates: registration and visual review required before runtime use.
"""
from pathlib import Path
from PIL import Image
import numpy as np
import json
import argparse
parser=argparse.ArgumentParser()
parser.add_argument("costumes",nargs="*",default=["apron","maid"])
parser.add_argument("--report",default="batch-02.json")
args=parser.parse_args()
report={}
for costume in args.costumes:
 for p in sorted(Path('assets/characters/candidates',costume).glob('*.png')):
  im=Image.open(p).convert('RGBA');a=np.array(im).astype(float)
  dominance=a[:,:,1]-np.maximum(a[:,:,0],a[:,:,2])
  alpha=np.clip(1-(dominance-20)/80,0,1)
  a[:,:,3]=np.minimum(a[:,:,3],alpha*255)
  edge=(alpha>0)&(alpha<1)
  a[:,:,1][edge]=np.minimum(a[:,:,1][edge],np.maximum(a[:,:,0],a[:,:,2])[edge]+20)
  out=Path('assets/characters/candidates/keyed',costume,p.name);out.parent.mkdir(parents=True,exist_ok=True)
  result=Image.fromarray(a.clip(0,255).astype('uint8'));result.save(out)
  report[str(out)]={'size':im.size,'alpha_bbox':result.getbbox(),'status':'unregistered_candidate'}
Path('assets/characters/candidates',args.report).write_text(json.dumps(report,indent=2)+'\n')
print('Keyed',len(report),'candidates; runtime unchanged')
