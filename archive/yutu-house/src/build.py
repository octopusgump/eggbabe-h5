import base64,json
b=lambda f:base64.b64encode(open(f,'rb').read()).decode()
g=json.load(open('geom_full.json'))
occ=''.join(f'<img class="occ" id="oc{i}" style="left:{o["box"][0]}px;top:{o["box"][1]}px;width:{o["box"][2]-o["box"][0]}px;height:{o["box"][3]-o["box"][1]}px" src="data:image/webp;base64,{b(o["img"])}" alt="">' for i,o in enumerate(g['occ']))
for o in g['occ']: o.pop('img');o.pop('poly');o.pop('hole',None)
h=open('template.html').read()
h=h.replace('__HOUSES__',b('house_s.webp')).replace('__HOUSE__',b('house.webp')).replace('__OCCS__',occ).replace('__FRONT__',b('front.webp')).replace('__CLOSED__',b('closed.webp')).replace('__SIDE__',b('side.webp')).replace('__GEOM__',json.dumps(g,ensure_ascii=False,separators=(',',':')))
open('../yutu_house_demo.html','w').write(h); print(len(h))
