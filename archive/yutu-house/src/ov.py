import json; from PIL import Image, ImageDraw
g=json.load(open('geom.json')); S=2
im=Image.open('house.jpg').convert('RGB').resize((864*S,1152*S)); d=ImageDraw.Draw(im)
d.polygon([(p[0]*S,p[1]*S) for p in g['outer']],outline=(255,0,255),width=3)
for o in g['obst']: d.polygon([(p[0]*S,p[1]*S) for p in o],outline=(0,255,255),width=2)
for o in g['occ']:
  d.polygon([(p[0]*S,p[1]*S) for p in o['poly']],outline=(255,255,0),width=2)
  if 'hole' in o: d.polygon([(p[0]*S,p[1]*S) for p in o['hole']],outline=(255,120,0),width=2)
for r in g['rooms']: t=r['target']; d.ellipse([t[0]*S-6,t[1]*S-6,t[0]*S+6,t[1]*S+6],fill=(255,0,0))
im.crop((100,950,1000,1850)).resize((750,750)).save('ov1.jpg',quality=90); im.crop((800,950,1700,1850)).resize((750,750)).save('ov2.jpg',quality=90)
