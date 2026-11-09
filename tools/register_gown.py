"""Register independent nightgown layers and eye-only immutable blink pair."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFilter
import numpy as np,json
S=Path('assets/characters/candidates/keyed/gown');D=Path('assets/characters/costume_gown');D.mkdir(exist_ok=True)
size=(560,1841)
def source(n):
 im=Image.open(S/(n+'.png')).convert('RGBA');return im.crop(im.getbbox())
def place(im,box):
 out=Image.new('RGBA',size);out.alpha_composite(im.resize((box[2]-box[0],box[3]-box[1]),Image.Resampling.LANCZOS),box[:2]);return out
body=Image.open(S/'body_base.png').convert('RGBA');a=np.array(body)
a[:275,:,3]=0;a[275:305,:277,3]=0;a[275:305,354:,3]=0;body=Image.fromarray(a)
op=source('face_open');cl=source('face_closed').resize(op.size,Image.Resampling.LANCZOS)
m=Image.new('L',op.size)
for box in [(8,154,85,209),(111,138,212,199)]:ImageDraw.Draw(m).rounded_rectangle(box,6,fill=255)
m=m.filter(ImageFilter.GaussianBlur(.8));blink=Image.composite(cl,op,m);blink.putalpha(op.getchannel('A'))
faces=[place(im,(182,31,396,305)) for im in (op,blink)]
back=place(source('hair_back'),(120,10,475,636))
raw=source('hair_front');e=Image.new('L',raw.size)
ImageDraw.Draw(e).polygon([(85,275),(119,285),(180,310),(180,360),(110,360),(85,310)],fill=255)
e=e.filter(ImageFilter.GaussianBlur(1));a=np.array(raw);a[:,:,3]=(a[:,:,3]*(1-np.array(e)/255)).astype('uint8');raw=Image.fromarray(a)
front=place(raw,(147,5,440,448))
for name,im in zip(('body_base','hair_back','face_open','face_closed','hair_front'),(body,back,*faces,front)):im.save(D/(name+'.png'),optimize=True)
for label,face in zip(('open','closed'),faces):
 im=Image.new('RGBA',size)
 for layer in (back,body,face,front):im.alpha_composite(layer)
 im.save('/home/user/gown-'+label+'.png');im.crop((110,0,490,430)).save('/home/user/gown-head-'+label+'.png')
a,b=map(np.array,faces);yy,xx=np.where(np.any(a!=b,axis=2))
assert np.array_equal(a[:,:,3],b[:,:,3]);assert yy.max()<240
(D/'registration.json').write_text(json.dumps({'status':'candidate','canvas':size,'blinkChangeBounds':[int(xx.min()),int(yy.min()),int(xx.max()+1),int(yy.max()+1)],'identicalAlpha':True,'nonEyePixelsLocked':True},indent=2)+'\n')
