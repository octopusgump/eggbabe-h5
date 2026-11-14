const puppeteer = require('/tmp/koi-pw/node_modules/puppeteer-core');
(async()=>{const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});const p=await b.newPage();await p.setViewport({width:390,height:844});
p.on('pageerror',e=>console.log('ERR',e.message));
await p.goto('file:///workspace/yutu_demo/yutu_house_demo.html');await p.waitForFunction(()=>window.__ready,{timeout:10000});
console.log(await p.evaluate(()=>{const W=window.__walk;const T=[[430,590],[160,738],[640,722],[380,776],[330,690],[520,880]];const out=['nodes '+W.nodes];
 for(const a of T)for(const c of T){if(a===c)continue;const t0=performance.now();const r=W.findPath(a,c);out.push(JSON.stringify(a)+'->'+JSON.stringify(c)+' '+(r?r.map(v=>v.map(Math.round).join(',')).join(' '):'NULL')+' '+(performance.now()-t0).toFixed(1)+'ms');}
 return out.join('\n');}));await b.close();})();
