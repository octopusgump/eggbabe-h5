import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {interpret,validateInput} from './interpret.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'};
const rates=new Map(),pending=new Map();
http.createServer(async(req,res)=>{try{
  const url=new URL(req.url,`http://${req.headers.host}`);
  if(url.pathname==='/api/status')return json(res,200,{provider:'DeepSeek',configured:!!process.env.DEEPSEEK_API_KEY?.trim()});
  if(url.pathname==='/api/interpret'){
    if(req.method!=='POST')return json(res,405,{error:'请使用 POST 请求。'});
    if(req.headers.origin&&req.headers.origin!==url.origin)return json(res,403,{error:'请求来源无效。'});
    let raw='';for await(const chunk of req){raw+=chunk.toString();if(raw.length>5000)return json(res,413,{error:'请求过长。'});}
    const input=JSON.parse(raw);validateInput(input);
    const ip=req.socket.remoteAddress,now=Date.now();
    for(const [k,v] of rates)if(now-v.start>60000)rates.delete(k);
    const rate=rates.get(ip)||{start:now,count:0};rates.set(ip,rate);if(++rate.count>12)return json(res,429,{error:'操作有些频繁，稍等片刻再试。'});
    const key=ip+JSON.stringify(input);if(!pending.has(key))pending.set(key,interpret(input,process.env).finally(()=>pending.delete(key)));
    return json(res,200,await pending.get(key));
  }
  if(req.method!=='GET'&&req.method!=='HEAD')return json(res,405,{error:'请求方式无效。'});
  const base=url.pathname.startsWith('/shared/')?path.join(root,'shared'):root;
  const relative=url.pathname.startsWith('/shared/')?url.pathname.slice(8):url.pathname==='/'?'index.html':url.pathname.slice(1);
  const file=path.resolve(base,decodeURIComponent(relative));
  if(!file.startsWith(base+path.sep)||!['index.html','styles.css','theme.css'].includes(relative)&&!['assets/','js/'].some(prefix=>relative.startsWith(prefix))&&base===root)return json(res,403,{error:'不可访问。'});
  const data=await readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:data);
}catch(e){json(res,e.status|| (e.code==='ENOENT'?404:400),{error:e.code?'页面暂时无法访问。':e.message||'请稍后重试。'});}}).listen(Number(process.env.PORT||4181),'0.0.0.0',()=>console.log(`Local: http://127.0.0.1:${process.env.PORT||4181}`));
