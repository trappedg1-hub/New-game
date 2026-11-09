"""Register independent maid PNG layers; discard detached front-hair scraps."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFilter
import numpy as np,json
S=Path('assets/characters/candidates/keyed/maid');D=Path('assets/characters/costume_maid');D.mkdir(exist_ok=True)
size=(592,1760)
def source(n):
 im=Image.open(S/(n+'.png')).convert('RGBA');return im.crop(im.getbbox())
def place(im,box):
 out=Image.new('RGBA',size);out.alpha_composite(im.resize((box[2]-box[0],box[3]-box[1]),Image.Resampling.LANCZOS),box[:2]);return out
body=Image.open(S/'body_base.png').convert('RGBA');ba=np.array(body)
ba[:280,:,3]=0;ba[280:307,:280,3]=0;ba[280:307,359:,3]=0;body=Image.fromarray(ba)
op=source('face_open');cl=source('face_closed').resize(op.size,Image.Resampling.LANCZOS)
m=Image.new('L',op.size)
for box in [(35,172,151,262),(202,172,319,262)]:ImageDraw.Draw(m).rounded_rectangle(box,7,fill=255)
m=m.filter(ImageFilter.GaussianBlur(.8));blink=Image.composite(cl,op,m);blink.putalpha(op.getchannel('A'))
faces=[place(im,(191,46,394,307)) for im in (op,blink)]
back=place(source('hair_back'),(120,20,490,1140))
raw=Image.open(S/'hair_front.png').convert('RGBA').crop((145,10,470,450))
# Remove the spurious bridge protruding into the cheek opening, not side locks.
e=Image.new('L',raw.size);ImageDraw.Draw(e).polygon([(70,265),(100,276),(150,297),(150,335),(100,339),(70,300)],fill=255)
e=e.filter(ImageFilter.GaussianBlur(1));a=np.array(raw);a[:,:,3]=(a[:,:,3]*(1-np.array(e)/255)).astype('uint8');raw=Image.fromarray(a)
front=place(raw,(145,4,445,410))
for name,im in zip(('body_base','hair_back','face_open','face_closed','hair_front'),(body,back,*faces,front)):im.save(D/(name+'.png'),optimize=True)
for label,face in zip(('open','closed'),faces):
 im=Image.new('RGBA',size)
 for layer in (back,body,face,front):im.alpha_composite(layer)
 im.save('/home/user/maid-'+label+'.png');im.crop((115,0,505,440)).save('/home/user/maid-head-'+label+'.png')
a,b=map(np.array,faces);yy,xx=np.where(np.any(a!=b,axis=2))
assert np.array_equal(a[:,:,3],b[:,:,3]);assert yy.max()<240
(D/'registration.json').write_text(json.dumps({'status':'candidate','canvas':size,'blinkChangeBounds':[int(xx.min()),int(yy.min()),int(xx.max()+1),int(yy.max()+1)],'identicalAlpha':True,'nonEyePixelsLocked':True},indent=2)+'\n')
