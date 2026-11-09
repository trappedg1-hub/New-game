from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
import clean_layer_content as cleanup
from PIL import Image
import numpy as np
regions={1:[(195,118,250,159),(278,119,330,156)],2:[(166,117,212,149),(234,110,282,143)],3:[(113,138,156,165),(171,122,223,154)],4:[(153,703,184,730),(190,690,235,721)],5:[(112,128,153,156),(169,116,216,147)]}
for t in range(1,6):
 root=Path(f'assets/characters/tier{t}')
 body=np.array(Image.open(root/'body_base.png').convert('RGBA'));old=np.array(cleanup.original(t,'body_base'));mask,_=cleanup.head_mask(t);m=np.array(mask)
 assert np.array_equal(body[:,:,3],old[:,:,3]),'Body silhouette changed'
 assert np.array_equal(body[m==0],old[m==0]),'Outside head edited'
 core=(m==255)&(body[:,:,3]>240)
 assert np.ptp(body[:,:,:3][core],axis=0).max()<20,'Non-smooth facial pixels in body'
 opened=np.array(Image.open(root/'face_open.png'));closed=np.array(Image.open(root/'face_closed.png'))
 assert np.array_equal(opened[:,:,3],closed[:,:,3]),'Face silhouettes differ'
 eye=np.zeros(opened.shape[:2],bool)
 for x,y,r,b in regions[t]:eye[y:b,x:r]=True
 assert np.array_equal(opened[~eye],closed[~eye]),'Non-eye face pixels differ'
 assert not np.array_equal(opened[eye],closed[eye]),'No actual closed frame'
 print(f'PASS tier {t}: blank smooth body head, preserved alpha/outside pixels, identical non-eye facial pixels')
