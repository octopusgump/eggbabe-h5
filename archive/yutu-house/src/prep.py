import json
from PIL import Image, ImageDraw, ImageFilter
import numpy as np
g=json.load(open('geom.json'))
im=Image.open('house.jpg').convert('RGB')
SS=4
for i,o in enumerate(g['occ']):
    xs=[p[0] for p in o['poly']]; ys=[p[1] for p in o['poly']]
    x0,y0,x1,y1=int(min(xs))-2,int(min(ys))-2,int(max(xs))+3,int(max(ys))+3
    m=Image.new('L',((x1-x0)*SS,(y1-y0)*SS),0); d=ImageDraw.Draw(m)
    d.polygon([((p[0]-x0)*SS,(p[1]-y0)*SS) for p in o['poly']],fill=255)
    if 'hole' in o: d.polygon([((p[0]-x0)*SS,(p[1]-y0)*SS) for p in o['hole']],fill=0)
    m=m.filter(ImageFilter.GaussianBlur(2)).resize((x1-x0,y1-y0),Image.LANCZOS)
    c=im.crop((x0,y0,x1,y1)).convert('RGBA'); c.putalpha(m)
    c.save(f'occ{i}.webp',quality=90,method=6,exact=True); o['img']=f'occ{i}.webp'; o['box']=[x0,y0,x1,y1]
b=np.asarray(im.filter(ImageFilter.GaussianBlur(22)).resize((27,36),Image.BILINEAR),float)
g['light']={'w':27,'h':36,'cell':32,'rgb':b.astype(int).tolist()}
json.dump(g,open('geom_full.json','w'),ensure_ascii=False)
