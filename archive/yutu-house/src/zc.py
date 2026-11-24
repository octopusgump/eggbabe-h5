import sys
from PIL import Image
args=sys.argv[2:]; n=len(args)//3
W=Image.new('RGB',(300*n,300))
for i in range(n):
  k,x,y=map(int,args[3*i:3*i+3]); x*=2;y*=2
  W.paste(Image.open('frames/f%04d.png'%k).crop((x-150,y-200,x+150,y+100)),(300*i,0))
W.save(sys.argv[1],quality=90)
