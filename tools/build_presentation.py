"""Build ground metadata for full-art fallback costumes only. No warp/eye masks."""
from pathlib import Path
from PIL import Image
import json
root=Path(__file__).resolve().parents[1]
result={}
for path in (root/'assets/characters').glob('*.png'):
 if not (path.stem.startswith('tier') or path.stem.startswith('costume_')):continue
 im=Image.open(path).convert('RGBA');w,h=im.size;a=im.getchannel('A');floor=a.getbbox()[3]-1
 xs=[x for x in range(w) if any(a.getpixel((x,y))>200 for y in range(max(0,floor-int(h*.008)),floor+1))];groups=[]
 for x in xs:
  if not groups or x>groups[-1][-1]+2:groups.append([x])
  else:groups[-1].append(x)
 result[path.stem]={'size':[w,h],'floor':floor/h,'contacts':[{'x':(g[0]+g[-1])/2/w,'width':max(12,g[-1]-g[0])/w} for g in groups if len(g)>3]}
(root/'data/character-presentation.js').write_text('/* Ground contacts only. */\nwindow.CHARACTER_PRESENTATION = '+json.dumps(result,indent=2)+';\n')
