import sys
from PIL import Image, ImageDraw, ImageFont
im=Image.open('house.jpg').convert('RGB')
x0,y0,x1,y1=map(int,sys.argv[1:5]);S=3
c=im.crop((x0,y0,x1,y1)).resize(((x1-x0)*S,(y1-y0)*S),Image.LANCZOS);d=ImageDraw.Draw(c);f=ImageFont.load_default(15)
for x in range((x0//10+1)*10,x1,10):
  X=(x-x0)*S;d.line([(X,0),(X,c.height)],fill=(255,0,0) if x%50==0 else (255,255,255),width=1)
  if x%20==0:d.text((X+2,2),str(x),fill=(255,255,0),font=f)
for y in range((y0//10+1)*10,y1,10):
  Y=(y-y0)*S;d.line([(0,Y),(c.width,Y)],fill=(255,0,0) if y%50==0 else (255,255,255),width=1)
  if y%20==0:d.text((2,Y+2),str(y),fill=(0,255,255),font=f)
c.convert('RGB').save(sys.argv[5],quality=92)
