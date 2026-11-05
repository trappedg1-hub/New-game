#!/usr/bin/env python3
"""Build isolated YOGA GIRL derivatives using the approved V3 matte technique.

Reads the approved image and one closed-eye study, never changes either. The
four jointed limb textures are source-derived; hidden pixels are inpainted and
are not claimed to be recovered artwork. Requires numpy, OpenCV and Pillow.
"""
from pathlib import Path
import hashlib
import json

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent.parent / 'Generated/Approved/HERO-01_outfit05_yoga_girl.png'
STUDY = ROOT / 'artifacts/closed_eyes_study.png'
OUT = ROOT / 'public/derived'
EXPECTED = '5cd0f5faca1f86fa3f0dfca6429615a877cc98b60c5af542ccbb99a1ff16a317'
WIDTH, HEIGHT = 1534, 2733

# The visible parts of the left arm are partly occluded by hair and shorts;
# both pieces still use ONE continuous shoulder/elbow/wrist skinning chain.
DOMAINS = {
    'arm_left': [(410,920),(555,920),(560,1040),(550,1120),(530,1200),
                 (500,1260),(470,1360),(443,1460),(430,1500),(402,1550),
                 (370,1595),(285,1610),(205,1595),(195,1510),(270,1460),
                 (360,1440),(398,1390),(409,1250),(405,1100)],
    'arm_right': [(885,560),(1075,560),(1100,700),(1105,900),(1125,1100),
                  (1132,1280),(1140,1425),(1160,1480),(1240,1500),(1340,1540),
                  (1350,1610),(1270,1615),(1190,1585),(1125,1565),(1090,1515),
                  (1070,1400),(1030,1260),(995,1150),(970,1030),(950,900),(925,775)],
    'leg_left': [(360,1620),(750,1620),(760,1980),(700,2120),(580,2250),
                 (550,2730),(300,2730),(295,2200),(375,2010)],
    'leg_right': [(775,1620),(1175,1620),(1175,1990),(1250,2200),(1245,2730),
                  (970,2730),(950,2250),(820,2110),(775,1980)],
}
FADE = {'arm_left': (990,1110), 'arm_right': (600,790),
        'leg_left': (1650,1760), 'leg_right': (1650,1760)}
# Hand-traced shorts boundary, including the gap between the thighs. This
# stays over the limbs with the body mesh, preventing hands from pulling
# strips of the mat through the garment at an occlusion boundary.
SHORTS = [(570,1080),(660,1070),(870,1070),(940,1080),(990,1120),(1040,1170),
          (1085,1240),(1105,1300),(1117,1380),(1121,1480),(1115,1600),(1105,1650),
          (1075,1685),(1030,1705),(970,1718),(920,1718),(875,1707),(820,1685),
          (790,1660),(785,1600),(785,1520),(725,1520),(725,1600),(720,1660),
          (695,1685),(650,1705),(600,1718),(540,1718),(490,1708),(450,1695),
          (420,1670),(405,1630),(394,1550),(395,1450),(400,1370),(420,1290),
          (460,1210),(500,1160),(550,1100)]
EYES = [
    {'name':'left','box':[758,294,895,382],'pivot':[829,351],'angle':-0.12,
     'polygon':[(763,337),(777,321),(800,309),(820,306),(845,307),(872,315),
                (885,327),(879,346),(861,361),(839,369),(816,368),(793,361),(776,351)],
     'lash_removal':[(775,338),(800,337),(824,334),(847,334),(870,328),(882,330),
                     (871,350),(850,360),(825,364),(799,360),(777,353)]},
    {'name':'right','box':[919,270,1006,352],'pivot':[962,325],'angle':-0.23,
     'polygon':[(924,316),(933,299),(945,286),(960,276),(978,275),(994,281),
                (998,293),(991,315),(979,332),(963,341),(945,340),(932,332)],
     'lash_removal':[(932,310),(945,309),(960,307),(977,303),(994,296),(996,316),
                     (984,328),(964,336),(945,336),(934,328)]},
]


def smoothstep(a, b, x):
    t = np.clip((x-a)/(b-a), 0, 1)
    return t*t*(3-2*t)


def cell_occupancy(alpha, box):
    # Preserve the V3-style mesh density. Only wholly transparent cells are
    # omitted; a 32-source-pixel halo protects bilinear/mipmap sampling.
    cols,rows=65,117
    sx,sy=WIDTH/(cols-1),HEIGHT/(rows-1)
    x0,y0,w,h=box
    first_col=max(0,int(np.floor(x0/sx))); last_col=min(cols-1,int(np.ceil((x0+w)/sx)))
    first_row=max(0,int(np.floor(y0/sy))); last_row=min(rows-1,int(np.ceil((y0+h)/sy)))
    local_cols=last_col-first_col+1; local_rows=last_row-first_row+1
    cells=[]
    for row in range(local_rows-1):
        for col in range(local_cols-1):
            left=max(0,int(np.floor((first_col+col)*sx-x0))-32)
            right=min(w,int(np.ceil((first_col+col+1)*sx-x0))+32)
            top=max(0,int(np.floor((first_row+row)*sy-y0))-32)
            bottom=min(h,int(np.ceil((first_row+row+1)*sy-y0))+32)
            if left<right and top<bottom and np.any(alpha[top:bottom,left:right]):
                cells.append(row*(local_cols-1)+col)
    return {'grid':[cols,rows], 'size':[local_cols,local_rows], 'halo':32, 'active_cells':cells}

def masks_for(rgb):
    r,g,b = (rgb[:,:,i].astype(np.int16) for i in range(3))
    skin = ((r-g>11) & (g-b>3) & (r-b>19) & (r>90)).astype(np.uint8)*255
    masks = {}
    for name, polygon in DOMAINS.items():
        roi = np.zeros((HEIGHT, WIDTH), np.uint8)
        cv2.fillPoly(roi, [np.array(polygon, np.int32)], 255)
        raw = cv2.bitwise_and(skin, roi)
        raw = cv2.morphologyEx(raw, cv2.MORPH_CLOSE, np.ones((5,5), np.uint8))
        count, labels, stats, _ = cv2.connectedComponentsWithStats(raw, 8)
        selected = np.zeros_like(raw)
        for i in range(1, count):
            if stats[i, cv2.CC_STAT_AREA] > 200:
                selected[labels == i] = 255
        # Pick up dark antialiased outline and source shadow; feather rather
        # than dragging an opaque rectangular background with the limb.
        selected = cv2.dilate(selected, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7,7)))
        masks[name] = selected
    return masks


def build_limbs(rgb):
    OUT.joinpath('jointed').mkdir(parents=True, exist_ok=True)
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    raw = masks_for(rgb)
    shorts = np.zeros((HEIGHT,WIDTH),np.uint8)
    cv2.fillPoly(shorts,[np.array(SHORTS,np.int32)],255)
    values=rgb.astype(np.int16)
    neutral=(values.max(axis=2)<150)&((values.max(axis=2)-values.min(axis=2))<25)
    shorts=np.where((shorts>0)&neutral,255,0).astype(np.uint8)
    shorts=cv2.morphologyEx(shorts,cv2.MORPH_CLOSE,np.ones((5,5),np.uint8))
    # Recover the dark garment outline around the hand-traced boundary but
    # never include warm skin. This stops light mat showing as a white seam.
    expanded=cv2.dilate(shorts,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(19,19)))
    shorts=np.where((expanded>0)&neutral,255,0).astype(np.uint8)
    shorts=cv2.morphologyEx(shorts,cv2.MORPH_CLOSE,np.ones((3,3),np.uint8))
    rows = np.arange(HEIGHT, dtype=np.float32)[:,None]
    supports, alphas = {}, {}
    for name, mask in raw.items():
        root = smoothstep(*FADE[name], rows)
        alpha = cv2.GaussianBlur(mask, (7,7), 1.1).astype(np.float32)/255 * root
        # Include a wider feathered contact shadow so it does not stay behind
        # as a second dark contour during larger joint movements.
        radius = 95 if name.startswith('leg_') else 55
        support = cv2.dilate(mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(radius,radius)))
        support = cv2.GaussianBlur(support,(21,21),5).astype(np.float32)/255 * root
        alpha[shorts>0]=0; support[shorts>0]=0
        if name.startswith('leg_'):
            # Do not create a cropped texture with an opaque canvas-bottom edge.
            edge=1-smoothstep(HEIGHT-20,HEIGHT-6,rows)
            alpha*=edge; support*=edge
        if name == 'leg_left': alpha[:,767:]=0; support[:,767:]=0
        if name == 'leg_right': alpha[:,:767]=0; support[:,:767]=0
        alphas[name], supports[name] = alpha, support
    overlap = sum((mask > .01).astype(np.uint8) for mask in supports.values())
    if overlap.max() > 1:
        raise RuntimeError('Independent layer supports unexpectedly overlap')
    # The V3-style algebraic matte needs a plausible hidden background. For
    # this pose, most limbs lie against the original dark backdrop or yoga
    # mat. Sampling unobstructed rows avoids Telea propagating the shorts'
    # dark outlines through the missing legs (a visible stationary ghost).
    # These sampled surfaces are approximations, not recovered hidden art.
    row_mats = np.empty((HEIGHT,3), np.float32)
    for y in range(HEIGHT):
        row=bgr[y].astype(np.int16)
        good=(row.max(axis=1)-row.min(axis=1)<15) & (row.mean(axis=1)>115) & (row.mean(axis=1)<220)
        if y >= 1375 and np.count_nonzero(good)>35:
            row_mats[y]=np.median(row[good],axis=0)
        elif y:
            row_mats[y]=row_mats[y-1]
        else:
            row_mats[y]=(166,166,166)
    # Borrow the first real mat row for the small feathered top edge.
    first=next((y for y in range(1375,HEIGHT) if row_mats[y].mean()>110), 1400)
    row_mats[:first]=row_mats[first]
    row_mats=cv2.GaussianBlur(row_mats[:,None,:],(1,0),0,sigmaY=12)[:,0,:]
    left_dark=np.median(bgr[:,30:140,:],axis=1).astype(np.float32)
    right_dark=np.median(bgr[:,1390:1500,:],axis=1).astype(np.float32)
    left_dark=cv2.GaussianBlur(left_dark[:,None,:],(1,0),0,sigmaY=12)[:,0,:]
    right_dark=cv2.GaussianBlur(right_dark[:,None,:],(1,0),0,sigmaY=12)[:,0,:]
    mat_fade=smoothstep(1360,1385,rows)[:,:,None]
    background=bgr.astype(np.float32)
    for name in DOMAINS:
        dark=(left_dark if name.endswith('left') else right_dark)[:,None,:]
        estimated=dark*(1-mat_fade)+row_mats[:,None,:]*mat_fade
        s=supports[name][:,:,None]
        background=background*(1-s)+estimated*s
    background=np.uint8(np.clip(np.rint(background),0,255))
    cv2.imwrite(str(OUT/'jointed/body.png'), background)
    layers, saved = {}, {}
    for name in DOMAINS:
        # Crop prior to float arithmetic to limit build-time memory.
        yy,xx = np.nonzero(supports[name] > 0)
        x0,x1=max(0,int(xx.min())-3),min(WIDTH,int(xx.max())+4)
        y0,y1=max(0,int(yy.min())-3),min(HEIGHT,int(yy.max())+4)
        source = bgr[y0:y1,x0:x1].astype(np.float32)
        bg = background[y0:y1,x0:x1].astype(np.float32)
        alpha = alphas[name][y0:y1,x0:x1].copy()
        s = supports[name][y0:y1,x0:x1]
        delta = source-bg
        required = np.where(delta>=0, delta/np.maximum(255-bg,1), -delta/np.maximum(bg,1)).max(axis=2)
        alpha = np.maximum(alpha, required)
        alpha[s == 0] = 0
        alpha8 = np.ceil(np.clip(alpha,0,1)*255).astype(np.uint8)
        a = alpha8.astype(np.float32)/255
        rgb_part = np.zeros_like(source)
        visible = a>0
        rgb_part[visible] = (source[visible]-(1-a[visible,None])*bg[visible])/a[visible,None]
        bgra = np.dstack([np.uint8(np.clip(np.rint(rgb_part),0,255)),alpha8])
        cv2.imwrite(str(OUT/f'jointed/{name}.png'),bgra)
        box=[x0,y0,x1-x0,y1-y0]
        layers[name]={'file':f'{name}.png','box':box,'mesh':cell_occupancy(bgra[:,:,3],box)}
        saved[name]=(bgra,x0,y0)
    # The garment belongs above the planted hands and moving thighs. It follows
    # the body mesh, not a limb chain; all color comes from the approved art.
    overlay=cv2.GaussianBlur(shorts,(7,7),1.1)
    yy,xx=np.nonzero(overlay)
    x0,x1=max(0,int(xx.min())-3),min(WIDTH,int(xx.max())+4)
    y0,y1=max(0,int(yy.min())-3),min(HEIGHT,int(yy.max())+4)
    bgra=np.dstack([bgr[y0:y1,x0:x1],overlay[y0:y1,x0:x1]])
    cv2.imwrite(str(OUT/'jointed/shorts.png'),bgra)
    box=[x0,y0,x1-x0,y1-y0]
    layers['shorts']={'file':'shorts.png','box':box,'mesh':cell_occupancy(bgra[:,:,3],box)}
    saved['shorts']=(bgra,x0,y0)
    # Exact neutral compositing check, like V3. It does not prove seams in motion.
    image=Image.fromarray(cv2.cvtColor(background,cv2.COLOR_BGR2RGBA))
    for name in [*DOMAINS,'shorts']:
        bgra,x,y=saved[name]
        image.alpha_composite(Image.fromarray(cv2.cvtColor(bgra,cv2.COLOR_BGRA2RGBA)),(x,y))
    diff=np.abs(np.asarray(image.convert('RGB')).astype(np.int16)-rgb.astype(np.int16))
    print('Neutral composite mean/max:',float(diff.mean()),int(diff.max()),'pixels > 2:',int((diff.max(axis=2)>2).sum()))
    if diff.max() > 2:
        raise RuntimeError('Neutral composite does not reconstruct the approved source')
    metadata={'source_sha256':EXPECTED,'size':[WIDTH,HEIGHT],'body':'body.png','layers':layers,
              'neutral_mean_difference':float(diff.mean()),'neutral_max_difference':int(diff.max())}
    (OUT/'jointed/jointed.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+'\n')
    print('Skin layer boxes/cells:',json.dumps({name:{'box':item['box'],'active_cells':len(item['mesh']['active_cells'])} for name,item in layers.items()}))


def build_eyes(rgb):
    if not STUDY.exists(): raise FileNotFoundError(STUDY)
    crop=(500,50,1080,700)
    ref=cv2.cvtColor(rgb[crop[1]:crop[3],crop[0]:crop[2]],cv2.COLOR_RGB2BGR)
    candidate=cv2.imread(str(STUDY),cv2.IMREAD_COLOR)
    candidate=cv2.resize(candidate,(580,650),interpolation=cv2.INTER_AREA)
    sift=cv2.SIFT_create(nfeatures=1800,contrastThreshold=0.01)
    ka,da=sift.detectAndCompute(cv2.cvtColor(candidate,cv2.COLOR_BGR2GRAY),None)
    kb,db=sift.detectAndCompute(cv2.cvtColor(ref,cv2.COLOR_BGR2GRAY),None)
    pairs=cv2.BFMatcher().knnMatch(da,db,k=2)
    good=[a for a,b in pairs if a.distance<0.72*b.distance]
    if len(good)<30: raise RuntimeError('Closed-eye study has too few alignment matches')
    src=np.float32([ka[m.queryIdx].pt for m in good])
    dst=np.float32([kb[m.trainIdx].pt for m in good])
    cv2.setRNGSeed(17)
    matrix,inliers=cv2.estimateAffinePartial2D(src,dst,method=cv2.RANSAC,ransacReprojThreshold=3)
    if matrix is None or inliers is None or int(inliers.sum())<30: raise RuntimeError('Unreliable blink alignment')
    aligned=cv2.warpAffine(candidate,matrix,(580,650),flags=cv2.INTER_CUBIC,borderMode=cv2.BORDER_REPLICATE)
    def local(points): return np.array([(x-crop[0],y-crop[1]) for x,y in points],np.int32)
    removal=np.zeros((650,580),np.uint8)
    for eye in EYES: cv2.fillPoly(removal,[local(eye['lash_removal'])],255)
    removal=cv2.dilate(removal,np.ones((3,3),np.uint8))
    under=cv2.inpaint(aligned,removal,7,cv2.INPAINT_TELEA)
    aligned=cv2.cvtColor(aligned,cv2.COLOR_BGR2RGB)
    under=cv2.cvtColor(under,cv2.COLOR_BGR2RGB)
    for eye in EYES:
        mask=np.zeros((650,580),np.uint8)
        cv2.fillPoly(mask,[local(eye['polygon'])],255)
        mask=cv2.GaussianBlur(mask,(0,0),3)
        x0,y0,x1,y1=eye['box']
        m=mask[y0-crop[1]:y1-crop[1],x0-crop[0]:x1-crop[0]]
        sources={'open':rgb[y0:y1,x0:x1],
                 'underpaint':under[y0-crop[1]:y1-crop[1],x0-crop[0]:x1-crop[0]],
                 'closed':aligned[y0-crop[1]:y1-crop[1],x0-crop[0]:x1-crop[0]]}
        for name,pixels in sources.items():
            Image.fromarray(np.dstack((pixels,m))).save(OUT/f"eye_{eye['name']}_{name}.png",optimize=True)
    meta={'source_sha256':EXPECTED,'eyes':[{k:v for k,v in e.items() if k in ('name','box','pivot','angle')} for e in EYES],
          'study_matches':len(good),'study_inliers':int(inliers.sum()),'alignment_matrix':matrix.round(7).tolist()}
    (OUT/'rig.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
    print('Blink study SIFT:',len(good),'matches,',int(inliers.sum()),'inliers')


def main():
    if hashlib.sha256(SOURCE.read_bytes()).hexdigest()!=EXPECTED:
        raise RuntimeError('Approved source checksum mismatch; refusing to build')
    OUT.mkdir(parents=True,exist_ok=True)
    rgb=np.asarray(Image.open(SOURCE).convert('RGB'))
    if rgb.shape!=(HEIGHT,WIDTH,3): raise RuntimeError(f'Unexpected source shape {rgb.shape}')
    build_limbs(rgb)
    build_eyes(rgb)
    if hashlib.sha256(SOURCE.read_bytes()).hexdigest()!=EXPECTED:
        raise RuntimeError('Approved source unexpectedly changed')

if __name__=='__main__': main()
