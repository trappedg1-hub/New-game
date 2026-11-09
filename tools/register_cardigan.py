"""Deterministic registration of independent cardigan-v2 PNG components.
Only offline resize/translation and eye patch compositing; no runtime distortion.
"""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFilter
import numpy as np
S=Path('assets/characters/candidates/keyed/cardigan-v2')
D=Path('assets/characters/costume_cardigan');D.mkdir(exist_ok=True)
size=(560,1871)
def src(n):return Image.open(S/(n+'.png')).convert('RGBA')
def place(im,box):
 out=Image.new('RGBA',size);out.alpha_composite(im.resize((box[2]-box[0],box[3]-box[1]),Image.Resampling.LANCZOS),box[:2]);return out
body=src('body_base');a=np.array(body);mask=Image.new('L',size)
ImageDraw.Draw(mask).polygon([(145,70),(335,70),(344,160),(305,235),(248,295),(192,268),(150,203)],fill=255)
mask=mask.filter(ImageFilter.GaussianBlur(4));fill=Image.new('RGBA',size,(246,206,182,255));body=Image.composite(fill,body,mask);body.putalpha(Image.fromarray(a[:,:,3]))
# Remove the blank skull under the registered facial silhouette; retain neck below chin.
ba=np.array(body);ba[:303,:,3]=0;body=Image.fromarray(ba)
ImageDraw.Draw(body).polygon([(244,270),(310,240),(335,302),(283,340),(250,318)],fill=(235,184,163,255))
opened=src('face_open');opened=opened.crop(opened.getbbox())
closed=src('face_closed');closed=closed.crop(closed.getbbox()).resize(opened.size,Image.Resampling.LANCZOS)
# Eye-only finite patch masks measured on generated facial source. Outside
# these boxes the closed frame is exactly the open frame, including alpha.
m=Image.new('L',opened.size)
regions=[(38,148,176,239),(212,130,354,222)]
for box in regions:ImageDraw.Draw(m).rounded_rectangle(box,12,fill=255)
m=m.filter(ImageFilter.GaussianBlur(2));locked=Image.composite(closed,opened,m);locked.putalpha(opened.getchannel('A'))
box=(130,12,363,303)
faces=[place(im,box) for im in (opened,locked)]
back=src('hair_back');back=place(back.crop(back.getbbox()),(101,0,397,440))
front=src('hair_front');front=place(front.crop(front.getbbox()),(103,-8,426,426))
for n,im in zip(('body_base','hair_back','face_open','face_closed','hair_front'),(body,back,*faces,front)):im.save(D/(n+'.png'),optimize=True)
for label,face in zip(('open','closed'),faces):
 out=Image.new('RGBA',size)
 for im in (back,body,face,front):out.alpha_composite(im)
 out.save('/home/user/cardigan-'+label+'.png')
print('Registered cardigan candidates; manifest not modified')
