import base64, io, json
from PIL import Image
from pathlib import Path
W=Path('/workspace/yutu_demo/v2b/work')
OUT=Path('/workspace/yutu_demo/v2b')
base=Image.open(W/'tex_base.png')
CW,CH=base.size
# tight bbox of the texture, used as the mesh canvas
a=base.split()[3].point(lambda v:255 if v>8 else 0)
x0,y0,x1,y1=a.getbbox()
x0,y0,x1,y1=max(0,x0-8),max(0,y0-8),min(CW,x1+8),min(CH,y1+8)
# Landmarks are in tex_base pixel space; TEX is the region we packed into the GPU texture.
# Rest-pose vertices still use tex_base coordinates (x0..).
TEX=dict(x0=x0,y0=y0,w=x1-x0,h=y1-y0)
S=0.35
FEET=(195.0, 656.0)
# feet / center in tex_base space
FOOT_SRC=(301.0, 1105.0)
OX=FEET[0]-FOOT_SRC[0]*S
OY=FEET[1]-FOOT_SRC[1]*S
def uri(p):
    im=Image.open(p).crop((x0,y0,x1,y1))
    buf=io.BytesIO(); im.save(buf,'WEBP',quality=92,method=6,alpha_quality=100)
    return 'data:image/webp;base64,'+base64.b64encode(buf.getvalue()).decode()
t=(W/'template.html').read_text()
bg=Path('/workspace/yutu_demo/work/bg_from_koi_jump_demo.jpeg').read_bytes()
rep={'TEX':json.dumps(TEX),'S':str(S),'OX':str(round(OX,3)),'OY':str(round(OY,3)),
 'TEX_BASE':uri(W/'tex_base.png'),'TEX_CLOSED':uri(W/'tex_closed.png'),'TEX_DOZE':uri(W/'tex_doze.png'),
 'BG':'data:image/jpeg;base64,'+base64.b64encode(bg).decode(),
 'SH_SOFT_X':f'{FEET[0]+12}','SH_SOFT_Y':f'{FEET[1]-5}','SH_CON_X':f'{FEET[0]+3}','SH_CON_Y':f'{FEET[1]+1}'}
for k,v in rep.items():
    t=t.replace(f'%%{k}%%', v)
assert '%%' not in t, [s for s in t.split('%%')[1::2][:8]]
out=OUT/'yutu_mesh_demo.html'
out.write_text(t, encoding='utf-8')
print('wrote', out, out.stat().st_size, 'TEX', TEX, 'canvas', (CW,CH), 'OXOY', OX, OY, 'disp', CW*S, CH*S)
# belly means for the report
import numpy as np
arr=np.array(base)
by,bx,br=880,301,28
# 880,360 was in earlier patch - center is 301
bx=301
patch=arr[by-br:by+br, bx-br:bx+br]
opa=patch[:,:,3]>200
print('texture belly mean', patch[:,:,:3][opa].mean(0).round(2), 'n', int(opa.sum()))
