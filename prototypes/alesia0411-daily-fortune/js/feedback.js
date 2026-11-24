// Cosmetic feedback only: the draw module remains the owner of clicks and time.
export function playShakeFeedback(root,clicks){
 const cylinder=root.querySelector('.cylinder');
 if(!cylinder)return;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const artwork=cylinder.querySelector('.cylinder-art');
 if(artwork){
  artwork.getAnimations().forEach(animation=>animation.cancel());
  artwork.animate(reduced?[{filter:'brightness(1.16)'},{filter:'brightness(1)'}]:[
   {transform:'translateY(0) rotate(0) scale(1)'},
   {transform:'translateY(5px) rotate(-5deg) scale(.96)',offset:.2},
   {transform:'translateY(-7px) rotate(6deg) scale(1.035)',offset:.5},
   {transform:'translateY(-2px) rotate(-2deg)',offset:.78},
   {transform:'translateY(0) rotate(0) scale(1)'}
  ],{duration:reduced?180:330,easing:'ease-out'});
 }
 const count=root.querySelector('#click-count');
 if(count){count.getAnimations().forEach(a=>a.cancel());count.animate([{color:'#b7852f',transform:reduced?'none':'scale(1.08)'},{color:'#254723',transform:'scale(1)'}],{duration:260});}
 const scene=cylinder.closest('.drawing-scene');
 if(!scene)return;
 const old=scene.querySelectorAll('.tap-feedback');
 if(old.length>=5)old[0].remove();
 const burst=document.createElement('div');burst.className='tap-feedback';burst.setAttribute('aria-hidden','true');
 const milestone=clicks%10===0;
 burst.innerHTML=`<i class="tap-ring"></i><span class="tap-time">${milestone?'✦ '+clicks+' 次 · +0.3 秒':'+0.3 秒'}</span>`;
 if(!reduced){for(let i=0;i<(milestone?12:7);i++){
  const particle=document.createElement('i');particle.className='tap-particle';
  const angle=(i/ (milestone?12:7))*Math.PI*2;const distance=40+Math.random()*38;
  particle.style.setProperty('--dx',`${Math.cos(angle)*distance}px`);
  particle.style.setProperty('--dy',`${Math.sin(angle)*distance-25}px`);
  burst.append(particle);
 }}
 if(milestone)burst.classList.add('milestone-burst');
 scene.append(burst);setTimeout(()=>burst.remove(),800);
 if(!reduced&&typeof navigator.vibrate==='function'){try{navigator.vibrate(milestone?[12,30,12]:8);}catch{}}
}
