import {stampForPet,stampSvg} from './stamp.js';
import {illustration} from './art.js';
function load(src){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=src;});}
export async function makeCard(f,stamp,pet,night){
  await document.fonts.ready;
  const sealResponse=await fetch(stampForPet(pet));if(!sealResponse.ok)throw new Error('印章加载失败，请重试');
  const sealBlob=await sealResponse.blob();
  const seal=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(sealBlob);});
  f={...f,stampImage:seal};
  if(f.image){const response=await fetch(f.image);if(!response.ok)throw new Error('配图加载失败，请重试');const blob=await response.blob();const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(blob);});f={...f,image:data};}
  const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=1600;
  const ctx=canvas.getContext('2d');ctx.scale(2,2);ctx.fillStyle='#faf8ef';ctx.fillRect(0,0,500,800);
  ctx.drawImage(await load('./assets/theme/fortune-parchment.png'),0,0,500,800);
  const svg=new Blob([illustration(f,stamp,pet,night)],{type:'image/svg+xml'}),url=URL.createObjectURL(svg);
  try{ctx.drawImage(await load(url),38,60,424,424);}finally{URL.revokeObjectURL(url);}
  ctx.textAlign='center';ctx.fillStyle='#6b7a63';ctx.font='17px "KaiTi", "STKaiti", serif';ctx.fillText(`今日一签 · ${f.theme}`,250,522);
  ctx.fillStyle='#284631';ctx.font='24px "KaiTi", "STKaiti", serif';
  const lines=[];const clauses=f.text.length>16?(f.text.match(/[^，；]+[，；]?/g)||[f.text]):[f.text];for(const clause of clauses){let line='';for(const char of clause){if(line&&ctx.measureText(line+char).width>386){if(/[，。！？；]/.test(char)){const last=line.slice(-1);lines.push(line.slice(0,-1));line=last+char;}else{lines.push(line);line=char;}}else line+=char;}if(line)lines.push(line);}
  lines.forEach((s,i)=>ctx.fillText(s,250,561+i*32));
  const sealUrl=URL.createObjectURL(new Blob([stampSvg(stamp,seal)],{type:'image/svg+xml'}));
  try{ctx.drawImage(await load(sealUrl),366,666,116,98);}finally{URL.revokeObjectURL(sealUrl);}
  return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('未能生成图片，请再试一次。')),'image/png'));
}
export function download(blob,name){const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),60000);}
