import {sessionKey,selectFortune,displayedFortune,randomImageIndex,validImageIndex} from '../shared/paths.mjs';
import {fortunes,directions,byId} from '../shared/fortunes.mjs';
import {tap,dateKey} from '../shared/draw.mjs';
import {read,write,storageFailed} from './storage.js';
import {illustration,cylinder,escape as esc} from './art.js';
import {makeCard,download} from './export.js';
import {playShakeFeedback} from './feedback.js';
import {stampSvg,stampForPet} from './stamp.js';
const app=document.querySelector('#app');
const demo=new URLSearchParams(location.search).get('path')==='focus-demo';
const activeSessionKey=sessionKey(demo);
function pathUrl(sample){const u=new URL(location.href);u.hash='';if(sample)u.searchParams.set('path','focus-demo');else u.searchParams.delete('path');return u.pathname+u.search;}
function pathPicker(){return `<nav class="path-picker" aria-label="选择体验路径"><a href="${esc(pathUrl(false))}" ${!demo?'aria-current="page"':''}>随机抽签</a><a href="${esc(pathUrl(true))}" ${demo?'aria-current="page"':''}>指定签文演示</a></nav>`;}
const pets={bunny:{name:'兔兔'},fish:{name:'小鱼'}};
let pet=read('pet','bunny');if(!Object.hasOwn(pets,pet))pet='bunny';
let session=read(activeSessionKey,null);if(session&&(!byId(session.fortuneId)||!['bunny','fish'].includes(session.pet)||!['shaking','dropped','result'].includes(session.phase)))session=null;
if(session?.day!==dateKey())session=null;
if(session){session.pet=pet;if(!validImageIndex(session.imageIndex)){session.imageIndex=randomImageIndex();write(activeSessionKey,session);}}
let stage=session?.phase||'home',direction=read('direction','生活'),question=read('question',''),busy=false,error='',reading=null,bubble='',remaining=0,exporting=false;
let readingPage=0;
let tickTimer,bubbleTimer,toastTimer;const queue=[];
const milestones=['不用着急，我会一直在这里。','你认真摇签的样子，有点可爱。','咚咚，听见今天的小期待了吗？','轻轻摇，把节奏交给自己。','已经五十下啦，手累了就歇一歇。','我替你守着这份小小期待。','摇多久都好，你喜欢的节奏就好。','想停下的时候，等它慢慢落下就好。','今天也有认真陪自己一会儿呢。','一百下啦，接下来一起等签落下吧。'];
const night=()=>session?.night??(new Date().getHours()<6||new Date().getHours()>=18);
const button=(action,label,cls='',disabled=false)=>`<button type="button" data-action="${action}" class="${cls}" ${disabled?'disabled':''}>${label}</button>`;
const avatar=()=>`<img src="./assets/pets/${pet}.png" alt="${pets[pet].name}" class="avatar">`;
const stamp=()=>new Date(session.drawnAt).toLocaleString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).replaceAll('/','.');
function persist(){write(activeSessionKey,session);}
function toast(t){clearTimeout(toastTimer);const el=document.querySelector('#toast');el.textContent=t;el.classList.add('show');toastTimer=setTimeout(()=>el.classList.remove('show'),2400);}
const friendly=text=>String(text).replace(/兔子|兔兔|小鱼/g,pets[pet].name);
function companion(text){return `<div class="companion">${avatar()}<div class="speech" role="status">${esc(friendly(text))}</div></div>`;}
function render(){
  app.className=`app ${night()?'night':'day'} stage-${stage}${stage==='interpret'&&reading?' reading-result':''}`;
  const f=session?displayedFortune(session):null;
  app.innerHTML=`<div class="ambient" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div><header><button class="icon" data-action="exit" aria-label="退出小游戏">${stage==='interpret'?'‹':'×'}</button><span>今日一签<span class="brand-dot"> · </span>与你慢慢来</span><button class="icon" data-action="help" aria-label="更多选项">☰</button></header><div class="screen"><div class="screen-content">${stage==='home'?home():stage==='shaking'?shaking():stage==='dropped'?dropped():stage==='result'?result(f):interpretView(f)}</div></div><footer>${button('restart','再体验一次','text-button')}</footer><dialog id="dialog"></dialog>`;
  if(stage==='shaking')updateCounter();
  requestAnimationFrame(fitPreview);
}
function home(){return `<section class="intro"><h1>轻轻一摇<br>遇见今日的心意</h1></section><div class="home-companion">${companion('想多摇一会儿，也可以继续点点签筒。')}</div><div class="drawing-scene"><div class="scene-rings"></div><button class="cylinder" data-action="shake" aria-label="点击签筒开始抽签">${cylinder()}</button><span class="tap-hint">轻触签筒 · 开始抽签</span></div>`;}
function shaking(){return `<section class="intro compact"><h1>把节奏交给自己</h1><p class="subtitle">继续轻点，或停下来等签落下。</p></section><div class="milestone" id="milestone">${bubble?companion(bubble):''}</div><div class="drawing-scene"><div class="scene-rings"></div><button class="cylinder is-shaking" data-action="shake" aria-label="继续摇签，每次延长零点三秒">${cylinder()}</button><span class="spark">✧</span></div><div class="draw-status"><span id="click-count"></span><span id="remaining"></span><div class="time-track"><i id="time-progress"></i></div><p>每次轻点延长 0.3 秒 · 最多 100 次</p></div>`;}
function dropped(){return `<section class="intro"><h1>你的签，来了</h1><p class="subtitle">轻轻展开，看看今天的提醒。</p></section><div class="reveal-scene"><button class="fallen-stick" data-action="unfold" aria-label="展开今日签文"><img src="./assets/theme/wooden-fortune.png" alt="今日一签" draggable="false"></button><div class="reveal-glow"></div></div><div class="result-companion">${companion('我也好奇，我们一起看看吧。')}</div>${button('unfold','展开我的签','primary')}`;}
function result(f){return `<article class="fortune-paper"><div class="paper-art">${illustration(f,stamp(),pet,night())}</div><div class="fortune-copy"><p class="fortune-theme"><span></span>${esc(f.theme)}<span></span></p><h2>${esc(f.text)}</h2><div class="fortune-stamp">${stampSvg(stamp(),stampForPet(pet))}</div></div></article><div class="result-actions">${button('interpret','解签','primary')}${button('save',exporting?'正在制作…':'保存签文','secondary',exporting)}${button('share','分享这份心意','secondary',exporting)}</div>`;}
function interpretView(f){if(reading)return readingView();return `<section class="interpret-title"><h1>你想听哪一方面？</h1></section><div class="quote"><span>${esc(f.theme)}</span><p>${esc(f.text)}</p></div><form id="interpret-form"><fieldset ${busy?'disabled':''}><legend>选择解读方向</legend><div class="directions">${directions.map(d=>`<button type="button" data-direction="${d}" aria-pressed="${direction===d}">${d}</button>`).join('')}</div><label for="question">还有想问的？<span>选填</span></label><textarea id="question" maxlength="200" rows="3" placeholder="也可以只选一个方向，让心意慢慢展开…">${esc(question)}</textarea><div class="input-note"><span id="question-count">${question.length}/200</span></div><button class="primary" type="submit">${busy?'<span class="loading-dot"></span> 正在读懂这份心意…':'请为我解读'}</button></fieldset></form>${error?`<div class="error" role="alert">${esc(error)} ${button('retry','重试','text-button')}</div>`:''}${reading?`<section class="reading" aria-live="polite"><p class="eyebrow">关于${esc(reading.direction)}的回信</p><h2>慢慢读，也慢慢感受</h2><p>${esc(friendly(reading.reading))}</p><div class="suggestion"><span>可以试着</span><p>${esc(friendly(reading.suggestion))}</p></div>${companion(reading.companion)}</section>`:busy?`<div class="waiting">${companion('签文还在这里，我陪你等回信。')}</div>`:''}${button('back-result','回到我的签','text-button back-result')}`;}
function readingView(){
 const chunks=String(reading.reading).match(/[\s\S]{1,180}/g)||[''];
 const long=reading.reading.length+reading.suggestion.length+reading.companion.length>310;
 const pages=long?[...chunks,null]:[reading.reading];
 readingPage=Math.min(readingPage,pages.length-1);
 const last=readingPage===pages.length-1;
 return `<section class="interpret-title"><p class="eyebrow">关于${esc(reading.direction)}的回信</p><h1>慢慢读，也慢慢感受</h1></section><section class="reading" aria-live="polite">${pages[readingPage]?`<p>${esc(friendly(pages[readingPage]))}</p>`:''}${last?`<div class="suggestion"><span>可以试着</span><p>${esc(friendly(reading.suggestion))}</p></div>${companion(reading.companion)}`:''}</section>${pages.length>1?`<nav class="reading-pages" aria-label="回信翻页">${button('reading-prev','上一页','secondary',readingPage===0)}<span>${readingPage+1} / ${pages.length}</span>${button('reading-next','下一页','secondary',last)}</nav>`:''}<div class="reading-actions">${button('edit-reading','换个方向问问','secondary')}${button('back-result','回到我的签','primary')}</div>`;
}
function showBubble(){if(stage!=='shaking'||!queue.length)return;bubble=queue.shift();const el=document.querySelector('#milestone');if(el)el.innerHTML=companion(bubble);clearTimeout(bubbleTimer);bubbleTimer=setTimeout(()=>{bubble='';if(queue.length)showBubble();else document.querySelector('#milestone')?.replaceChildren();},1800);}
function shake(){
  if(!session){const recent=read('history',[]).slice(-30).map(x=>x.fortuneId),f=selectFortune(demo,fortunes,recent),isNight=night();session={...tap(undefined),fortuneId:f.id,imageIndex:randomImageIndex(),path:demo?'focus-demo':'random',day:dateKey(),pet,night:isNight};stage='shaking';persist();render();startTimer();playShakeFeedback(app,session.clicks);return;}
  if(stage!=='shaking')return;
  if(Date.now()>=session.deadline){finishDraw();return;}
  const previous=session.clicks;session=tap(session);if(session.clicks===previous){toast('已经摇满 100 次，一起等签落下吧');return;}
  if(session.clicks%10===0){queue.push(milestones[session.clicks/10-1]);if(!bubble)showBubble();}
  persist();updateCounter();playShakeFeedback(app,session.clicks);
}
function updateCounter(){remaining=Math.max(0,session.deadline-Date.now());const count=document.querySelector('#click-count'),left=document.querySelector('#remaining'),bar=document.querySelector('#time-progress');if(count)count.textContent=`已轻摇 ${session.clicks} / 100 次`;if(left)left.textContent=`${(remaining/1000).toFixed(1)} 秒后落签`;if(bar)bar.style.width=`${Math.min(100,remaining/(session.deadline-session.startedAt)*100)}%`;}
function startTimer(){clearInterval(tickTimer);tickTimer=setInterval(()=>{if(stage==='shaking'){updateCounter();if(Date.now()>=session.deadline)finishDraw();}},70);}
function finishDraw(){if(session?.phase!=='shaking')return;clearInterval(tickTimer);clearTimeout(bubbleTimer);queue.length=0;bubble='';session.phase='dropped';session.drawnAt=new Date(session.deadline).toISOString();stage='dropped';persist();if(!demo){const history=read('history',[]);history.push({fortuneId:session.fortuneId,day:session.day});write('history',history.slice(-60));}render();}
function goInterpret(){stage='interpret';error='';reading=session.reading||null;readingPage=0;history.pushState({daily:'interpret'},'','#interpret');render();window.scrollTo({top:0,behavior:'smooth'});}
function backResult(){if(location.hash==='#interpret'&&history.state?.daily==='interpret'){history.back();}else{stage='result';render();}}
async function requestReading(){
  if(busy)return;busy=true;error='';reading=null;write('direction',direction);write('question',question);const chosen=direction,asked=question;render();
  try{const res=await fetch(new URL('api/interpret',document.baseURI),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fortuneId:session.fortuneId,direction:chosen,question:asked,pet}),signal:AbortSignal.timeout(95000)});const data=await res.json();if(!res.ok)throw new Error(data.error||'暂时没有收到回信');reading={...data,direction:chosen,question:asked};session.reading=reading;persist();}catch(e){error=e.name==='TimeoutError'?'回信比预计慢一些，请稍后重试。':e.message||'连接中断，请重试。';}finally{busy=false;readingPage=0;render();}
}
async function saveCard(share=false){if(exporting)return;exporting=true;render();try{const blob=await makeCard(displayedFortune(session),stamp(),pet,night()),name=`今日一签-${demo?'专注演示-':''}${session.day}.png`;const file=new File([blob],name,{type:'image/png'});if(share&&navigator.canShare?.({files:[file]})){try{await navigator.share({title:'今日一签',files:[file]});}catch(e){if(e.name!=='AbortError')showShare(blob,name);}}else if(share){showShare(blob,name);}else{download(blob,name);toast('签文图片已生成，请查看下载或保存提示');}}catch(e){if(e.name!=='AbortError')toast('暂时无法保存，请再试一次');}finally{exporting=false;if(!document.querySelector('#dialog')?.open)render();}}
function showShare(blob,name){const u=URL.createObjectURL(blob),dialog=document.querySelector('#dialog');dialog.innerHTML=`<div class="dialog-content"><h2>分享这份心意</h2><p>长按图片保存，或下载后发送给朋友。</p><img class="share-preview" src="${u}" alt="今日签文分享图片"><a class="primary download-link" href="${u}" download="${name}">下载签文图片</a>${button('copy-link','复制小游戏链接','secondary')}${button('close-dialog','完成','text-button')}</div>`;dialog.addEventListener('close',()=>{URL.revokeObjectURL(u);render();},{once:true});dialog.showModal();}
function exit(){if(stage==='interpret'){backResult();return;}if(typeof window.DailyFortuneHost?.exit==='function'){window.DailyFortuneHost.exit();return;}const returnTo=new URLSearchParams(location.search).get('returnTo');if(returnTo){try{const u=new URL(returnTo,location.origin);if(u.origin===location.origin&&u.pathname!==location.pathname){location.assign(u.href);return;}}catch{}}
  if(document.referrer){try{const ref=new URL(document.referrer);if(ref.origin===location.origin&&ref.pathname!==location.pathname&&history.length>1){history.back();return;}}catch{}}
  showDialog('本次心意已收好','你可以关闭此页，或继续查看今日签文。');
}
function showMenu(){const d=document.querySelector('#dialog');d.innerHTML=`<div class="dialog-content"><h2>更多选项</h2>${pathPicker()}${petPicker()}${button('rules','玩法说明','secondary')}${button('close-dialog','返回小游戏','text-button')}</div>`;d.showModal();}
function showDialog(title,copy){const d=document.querySelector('#dialog');d.innerHTML=`<div class="dialog-content"><h2>${esc(title)}</h2><p>${esc(copy)}</p>${button('close-dialog','知道了','primary')}</div>`;d.showModal();}
app.addEventListener('click',async e=>{const el=e.target.closest('button');if(!el||el.disabled)return;
 if(el.dataset.pet){if(busy||exporting){toast('请等当前操作完成后再切换');return;}pet=el.dataset.pet;write('pet',pet);if(session){session.pet=pet;persist();}render();showMenu();return;}
 if(el.dataset.direction){direction=el.dataset.direction;reading=null;error='';render();return;}
 switch(el.dataset.action){case 'edit-reading':reading=null;error='';readingPage=0;render();break;case 'reading-next':readingPage++;render();break;case 'reading-prev':readingPage=Math.max(0,readingPage-1);render();break;case 'shake':shake();break;case 'unfold':session.phase='result';stage='result';persist();render();break;case 'interpret':goInterpret();break;case 'back-result':backResult();break;case 'retry':requestReading();break;case 'save':saveCard();break;case 'share':saveCard(true);break;case 'exit':exit();break;case 'help':showMenu();break;case 'rules':showDialog('轻轻摇，慢慢读','第一次点击开始计时：3 秒基础时间，每次点击增加 0.3 秒（首下也计入），最多 100 次、33 秒。每摇 10 次宠物会说一句话。停止点击后等待落签。');break;case 'close-dialog':document.querySelector('#dialog').close();break;case 'copy-link':try{await navigator.clipboard.writeText(location.origin+pathUrl(demo));toast('小游戏链接已复制');}catch{toast('请复制浏览器地址分享小游戏');}break;case 'restart':if(busy){toast('请等回信结束后再开启新一签');return;}const d=document.querySelector('#dialog');d.innerHTML=`<div class="dialog-content"><h2>再体验一次？</h2><p>将开启新一签，喜欢这一签的话，可以先保存为图片。</p>${button('confirm-restart','开始新体验','primary')}${button('close-dialog','保留这一签','secondary')}</div>`;d.showModal();break;case 'confirm-restart':clearInterval(tickTimer);clearTimeout(bubbleTimer);session=null;stage='home';reading=null;error='';bubble='';queue.length=0;persist();history.replaceState(null,'',location.pathname+location.search);render();break;}
});
app.addEventListener('input',e=>{if(e.target.id==='question'){question=e.target.value;write('question',question);document.querySelector('#question-count').textContent=`${question.length}/200`;}});
app.addEventListener('submit',e=>{if(e.target.id==='interpret-form'){e.preventDefault();requestReading();}});
window.addEventListener('popstate',()=>{if(session?.phase==='result'){stage='result';render();}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&stage==='shaking'&&Date.now()>=session.deadline)finishDraw();});
if(stage==='shaking'){if(Date.now()>=session.deadline)finishDraw();else startTimer();}
if(location.hash==='#interpret'&&session?.phase==='result'){stage='interpret';reading=session.reading||null;history.replaceState({daily:'interpret'},'');}
render();if(storageFailed())toast('浏览器未允许存储，离开前请保存签文图片');


function fitPreview(){
 const desktop=innerWidth>=700;
 document.documentElement.style.setProperty('--preview-scale',String(Math.min(1,(innerHeight-32)/845,(innerWidth-32)/390)));
 const content=document.querySelector('.screen-content'),screen=document.querySelector('.screen');
 if(!content||!screen)return;
 content.style.transform='';
 screen.scrollTop=0;app.scrollTop=0;
 if(desktop&&!app.classList.contains('reading-result')){const ratio=Math.min(1,screen.clientHeight/content.scrollHeight);content.style.transform=`scale(${ratio})`;}
}
window.addEventListener('resize',fitPreview);


function petPicker(){return `<section class="companion-picker" aria-label="选择陪伴伙伴"><h3>陪伴伙伴</h3><div>${Object.entries(pets).map(([id,p])=>`<button type="button" data-pet="${id}" aria-pressed="${pet===id}" ${busy||exporting?'disabled':''}><img src="./assets/pets/${id}.png" alt=""><span>${p.name}</span></button>`).join('')}</div></section>`;}