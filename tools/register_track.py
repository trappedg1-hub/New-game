"""Register independent sporty outfit components; eye-only immutable blink."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFilter
import numpy as np,json
S=Path('assets/characters/candidates/keyed/track');D=Path('assets/characters/costume_track');D.mkdir(exist_ok=True)
size=(688,1556)
def source(n):
 im=Image.open(S/(n+'.png')).convert('RGBA');return im.crop(im.getbbox())
def place(im,box):
 out=Image.new('RGBA',size);out.alpha_composite(im.resize((box[2]-box[0],box[3]-box[1]),Image.Resampling.LANCZOS),box[:2]);return out
body=Image.open(S/'body_base.png').convert('RGBA')
a=np.array(body);a[:250,:,3]=0;a[:295,:250,3]=0;a[:295,340:,3]=0;body=Image.fromarray(a)
op=source('face_open');cl=source('face_closed').resize(op.size,Image.Resampling.LANCZOS)
m=Image.new('L',op.size)
for box in [(10,51,72,96),(79,63,139,108)]:ImageDraw.Draw(m).rounded_rectangle(box,5,fill=255)
m=m.filter(ImageFilter.GaussianBlur(.6));blink=Image.composite(cl,op,m);blink.putalpha(op.getchannel('A'))
faces=[place(im,(217,78,388,295)) for im in (op,blink)]
back=place(source('hair_back'),(168,28,414,452))
front=place(source('hair_front'),(199,61,417,432))
for name,im in zip(('body_base','hair_back','face_open','face_closed','hair_front'),(body,back,*faces,front)):im.save(D/(name+'.png'),optimize=True)
for label,face in zip(('open','closed'),faces):
 im=Image.new('RGBA',size)
 for layer in (back,body,face,front):im.alpha_composite(layer)
 im.save('/home/user/track-'+label+'.png');im.crop((140,15,450,450)).save('/home/user/track-head-'+label+'.png')
a,b=map(np.array,faces);diff=np.any(a!=b,axis=2);yy,xx=np.where(diff)
assert np.array_equal(a[:,:,3],b[:,:,3]);assert yy.max()<230
(D/'registration.json').write_text(json.dumps({'status':'candidate','canvas':size,'blinkChangeBounds':[int(xx.min()),int(yy.min()),int(xx.max()+1),int(yy.max()+1)],'identicalAlpha':True,'nonEyePixelsLocked':True},indent=2)+'\n')
