"""Repaint faceless heads, publish exact face pairs and build honest runtime rigs.
Never extract layers from a whole illustration. Costume rigs without complete
registered faces stay single-art fallbacks. Tier 4 uses its kneeling viewport.
"""
from pathlib import Path
from PIL import Image
import json,subprocess,shutil
root=Path(__file__).resolve().parents[1]
subprocess.run(['python','tools/clean_layer_content.py'],cwd=root,check=True)
old=json.loads(subprocess.check_output(['git','show','15f781f:assets/characters/animation-manifest.json'],cwd=root))
manifest=json.loads((root/'assets/characters/animation-manifest.json').read_text())
manifest.update(version=9,renderer='validated-layered-with-single-fallback',notes='No displacement/warp filters. Five cleaned tier rigs visually reviewed; seven costume rigs incomplete and remain single images, not simulated parts.')
for t in range(1,6):
 folder=root/f'assets/characters/tier{t}'
 shutil.copyfile(folder/'face.png',folder/'face_open.png');shutil.copyfile(folder/'face_blink.png',folder/'face_closed.png')
 config=old['tiers'][str(t)]
 paths=config.get('candidateLayers') or config['layers']
 paths={k:v for k,v in paths.items() if k not in ['face','face_blink']}
 paths.update(face_open=f'assets/characters/tier{t}/face_open.png',face_closed=f'assets/characters/tier{t}/face_closed.png')
 config.update(type='layered',status='layered',layers=paths,canvas=[420,1323],contentAudit={'status':'faceless-head-repaint-and-visual-review','report':'assets/characters/layer-content-audit.json'})
 for k in ['candidateLayers','candidateCanvas','reason','optionalCloth','blinkRegions']:config.pop(k,None)
 config['source']=manifest['tiers'][str(t)]['source'];config['environment']=manifest['tiers'][str(t)]['environment']
 config['registration']='Shared breath transform; body/head repainted; hair-only PNGs and complete composite inspected. Open/closed pairs have identical non-eye pixels.'
 view=config.get('viewport',[0,0,420,1323]);im=Image.open(folder/'body_base.png').convert('RGBA').crop((view[0],view[1],view[0]+view[2],view[1]+view[3]));a=im.getchannel('A');box=a.getbbox();w,h=im.size;floor=box[3]-1
 xs=[x for x in range(w) if any(a.getpixel((x,y))>200 for y in range(max(0,floor-int(h*.008)),floor+1))];groups=[]
 for x in xs:
  if not groups or x>groups[-1][-1]+2:groups.append([x])
  else:groups[-1].append(x)
 config['ground']={'size':[w,h],'floor':floor/h,'contacts':[{'x':(g[0]+g[-1])/2/w,'width':max(12,g[-1]-g[0])/w} for g in groups if len(g)>3]}
 manifest['tiers'][str(t)]=config
for c in manifest['costumes'].values():
 c.update(type='single',status='fallback',reason='No complete independently generated registered body/hair/open-face/closed-face set. No fake layers, warps or skin-oval blinking.')
(root/'assets/characters/animation-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
