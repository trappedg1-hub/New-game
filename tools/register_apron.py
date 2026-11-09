"""Register independent apron PNG components and lock finite eye-only blink."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFilter
import numpy as np,json
S=Path('assets/characters/candidates/keyed/apron');D=Path('assets/characters/costume_apron');D.mkdir(exist_ok=True)
size=(624,1721)
def source(n):
 im=Image.open(S/(n+'.png')).convert('RGBA');return im.crop(im.getbbox())
def place(im,box):
 out=Image.new('RGBA',size);out.alpha_composite(im.resize((box[2]-box[0],box[3]-box[1]),Image.Resampling.LANCZOS),box[:2]);return out
body=Image.open(S/'body_base.png').convert('RGBA')
op=source('face_open');cl=source('face_closed').resize(op.size,Image.Resampling.LANCZOS)
m=Image.new('L',op.size)
for box in [(8,120,84,162),(98,101,171,145)]:ImageDraw.Draw(m).rounded_rectangle(box,5,fill=255)
m=m.filter(ImageFilter.GaussianBlur(.7));blink=Image.composite(cl,op,m);blink.putalpha(op.getchannel('A'))
faces=[place(im,(155,59,337,304)) for im in (op,blink)]
back=place(source('hair_back'),(100,34,450,559))
front=place(source('hair_front'),(75,30,405,650))
# Generated front layer includes an unwanted dark bridge under the face opening.
erase=Image.new('L',size)
ImageDraw.Draw(erase).polygon([(197,248),(220,252),(272,262),(280,294),(240,311),(198,280)],fill=255)
erase=erase.filter(ImageFilter.GaussianBlur(1.5))
fa=np.array(front);fa[:,:,3]=(fa[:,:,3]*(1-np.array(erase)/255)).astype('uint8');front=Image.fromarray(fa)
ba=np.array(body);ba[:270,:345,3]=0;ba[270:295,:240,3]=0;ba[270:295,315:345,3]=0;body=Image.fromarray(ba)
for name,im in zip(('body_base','hair_back','face_open','face_closed','hair_front'),(body,back,*faces,front)):im.save(D/(name+'.png'),optimize=True)
for label,face in zip(('open','closed'),faces):
 im=Image.new('RGBA',size)
 for layer in (back,body,face,front):im.alpha_composite(layer)
 im.save('/home/user/apron-'+label+'.png');im.crop((85,25,460,440)).save('/home/user/apron-head-'+label+'.png')
a,b=map(np.array,faces);diff=np.any(a!=b,axis=2);yy,xx=np.where(diff)
assert np.array_equal(a[:,:,3],b[:,:,3]);assert yy.max()<250
(D/'registration.json').write_text(json.dumps({'status':'candidate','canvas':size,'blinkChangeBounds':[int(xx.min()),int(yy.min()),int(xx.max()+1),int(yy.max()+1)],'identicalAlpha':True,'nonEyePixelsLocked':True},indent=2)+'\n')
