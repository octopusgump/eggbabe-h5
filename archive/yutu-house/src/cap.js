const puppeteer = require('/tmp/koi-pw/node_modules/puppeteer-core'); const fs = require('fs');
const MODE=process.env.MODE||'shots';
const OUT='/workspace/yutu_demo/house/frames'; fs.mkdirSync(OUT,{recursive:true});
(async()=>{
  const browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--allow-file-access-from-files']});
  const page=await browser.newPage(); await page.setViewport({width:390,height:844,deviceScaleFactor:2});
  page.on('pageerror',e=>console.error('PAGEERROR',e.message)); page.on('console',m=>console.error('CONSOLE',m.text()));
  await page.evaluateOnNewDocument(()=>{let vt=0,seed=7;const cbs=[];Math.random=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};
    performance.now=()=>vt;window.requestAnimationFrame=cb=>{cbs.push(cb);return cbs.length;};
    window.__adv=ms=>{const steps=Math.ceil(ms/16.67);for(let i=0;i<steps;i++){vt+=ms/steps;const l=cbs.splice(0);l.forEach(cb=>cb(vt));}};});
  await page.goto('file:///workspace/yutu_demo/yutu_house_demo.html',{waitUntil:'load'});
  await page.waitForFunction(()=>window.__ready===true);
  await new Promise(r=>setTimeout(r,300));
  const tapWorld=async(x,y)=>{const s=await page.evaluate((x,y)=>window.__walk.toScreen([x,y]),x,y); await page.mouse.click(s[0],s[1]); return s;};
  const TAPS=JSON.parse(process.env.TAPS||'[[800,440,[445,405]],[5600,[790,450]]]');
  const SHOTS=JSON.parse(process.env.SHOTS||'[]');
  const END=+(process.env.END||12000), FPS=+(process.env.FPS||30);
  let ti=0,f=0,drag=null;
  for(let t=0;t<=END;t+=1000/FPS,f++){
    while(ti<TAPS.length&&t>=TAPS[ti][0]){const ev=TAPS[ti];ti++;
      if(ev[1]==='drag'){const [x0,y0,x1,y1,dur]=ev[2];const n=Math.round(dur/(1000/FPS));drag={x0,y0,x1,y1,n,i:0};await page.mouse.move(x0,y0);await page.mouse.down();continue;}
      if(ev[1]==='screen'){await page.mouse.click(ev[2][0],ev[2][1]);console.log('stap',ev[2]);continue;}
      const p=ev[1];const s=await tapWorld(p[0],p[1]);console.log('tap',t|0,p,s.map(v=>v|0));}
    if(drag){drag.i++;const k=Math.min(1,drag.i/drag.n);await page.mouse.move(drag.x0+(drag.x1-drag.x0)*k,drag.y0+(drag.y1-drag.y0)*k);if(k>=1){await page.mouse.up();drag=null;}}
    await page.evaluate(ms=>window.__adv(ms),1000/FPS);
    if(MODE==='video'||SHOTS.some(s=>Math.abs(s-t)<1000/FPS/2)){await page.screenshot({path:`${OUT}/f${String(f).padStart(4,'0')}.png`});if(MODE!=='video')console.log('shot',f,JSON.stringify(await page.evaluate(()=>{const W=window.__walk;return [W.toScreen(W.st.p).map(Math.round),W.st.p.map(Math.round)]})));}
  }
  console.log('end',await page.evaluate(()=>JSON.stringify({p:window.__walk.st.p,room:window.__walk.st.room})));
  await browser.close();
})();
