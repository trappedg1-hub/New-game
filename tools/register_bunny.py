"""Register independent bunny layers. Headpiece exists only in front hair."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFilter
import numpy as np,json
S=Path('assets/characters/candidates/keyed/bunny');D=Path('assets/characters/costume_bunny');D.mkdir(exist_ok=True)
size=(512,2033)
def source(n):
 im=Image.open(S/(n+'.png')).convert('RGBA');return im.crop(im.getbbox())
def place(im,box):
 out=Image.new('RGBA',size);out.alpha_composite(im.resize((box[2]-box[0],box[3]-box[1]),Image.Resampling.LANCZOS),box[:2]);return out
body=Image.open(S/'body_base.png').convert('RGBA');a=np.array(body)
# Remove original ears and blank skull, leaving original neck under face.
a[:480,:,3]=0;a[480:510,:200,3]=0;a[480:510,314:,3]=0;body=Image.fromarray(a)
op=source('face_open');cl=source('face_closed').resize(op.size,Image.Resampling.LANCZOS)
m=Image.new('L',op.size)
for box in [(24,113,102,173),(115,124,200,183)]:ImageDraw.Draw(m).rounded_rectangle(box,5,fill=255)
m=m.filter(ImageFilter.GaussianBlur(.7));blink=Image.composite(cl,op,m);blink.putalpha(op.getchannel('A'))
faces=[place(im,(152,235,369,510)) for im in (op,blink)]
back=place(source('hair_back'),(100,224,430,753))
front=place(source('hair_front'),(126,9,505,650))
for name,im in zip(('body_base','hair_back','face_open','face_closed','hair_front'),(body,back,*faces,front)):im.save(D/(name+'.png'),optimize=True)
for label,face in zip(('open','closed'),faces):
 im=Image.new('RGBA',size)
 for layer in (back,body,face,front):im.alpha_composite(layer)
 im.save('/home/user/bunny-'+label+'.png');im.crop((90,200,512,650)).save('/home/user/bunny-head-'+label+'.png')
a,b=map(np.array,faces);yy,xx=np.where(np.any(a!=b,axis=2))
assert np.array_equal(a[:,:,3],b[:,:,3]);assert yy.max()<450
(D/'registration.json').write_text(json.dumps({'status':'candidate','canvas':size,'blinkChangeBounds':[int(xx.min()),int(yy.min()),int(xx.max()+1),int(yy.max()+1)],'identicalAlpha':True,'nonEyePixelsLocked':True},indent=2)+'\n')
