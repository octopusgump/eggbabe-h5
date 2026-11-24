export const MAX_CLICKS=100;
export function tap(state,now=Date.now()){
  if(state && (state.phase!=='shaking'||now>=state.deadline||state.clicks>=MAX_CLICKS))return state;
  const clicks=(state?.clicks||0)+1,startedAt=state?.startedAt??now;
  return {...state,phase:'shaking',clicks,startedAt,deadline:startedAt+3000+clicks*300};
}
export const dateKey=(date=new Date())=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
export function pick(library,recent=[],random=Math.random){const available=library.filter(x=>!recent.includes(x.id));const pool=available.length?available:library;return pool[Math.floor(random()*pool.length)];}
