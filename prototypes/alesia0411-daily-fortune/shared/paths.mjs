export const imageThemes={"渐进":"progress","舒缓":"calm","相知":"connection","自信":"confidence","新意":"novelty","专注":"focus","悦纳":"acceptance","选择":"choice","欣喜":"joy","生长":"growth","坦诚":"openness","期待":"hope"};
import {byId} from './fortunes.mjs';
import {pick} from './draw.mjs';
export const DEMO_ID='F155';
export const DEMO_IMAGE='./assets/fortunes/focus-demo.png';
export const sessionKey=demo=>demo?'session:focus-demo':'session';
export function selectFortune(demo,library,recent,random=Math.random){return demo?byId(DEMO_ID):pick(library,recent,random);}
export const randomImageIndex=(random=Math.random)=>Math.min(5,Math.max(1,Math.floor(random()*5)+1));
export const validImageIndex=index=>Number.isInteger(index)&&index>=1&&index<=5;
export function displayedFortune(session){
 const f=byId(session.fortuneId);
 if(session.path==='focus-demo')return {...f,image:DEMO_IMAGE};
 const index=validImageIndex(session.imageIndex)?session.imageIndex:1;
 return {...f,image:`./assets/fortunes/library/${imageThemes[f.theme]}/${imageThemes[f.theme]}-${String(index).padStart(2,'0')}.png`};
}
