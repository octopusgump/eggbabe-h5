
export const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const palettes=[['#c9dcd6','#edf1df','#8eaf9d','#e3b7a7'],['#ccd9e7','#eee9e0','#9babcb','#f1cfb5'],['#dfd8e5','#f3e9dd','#aaa5c3','#edb8a7'],['#d4e3cd','#f4efd5','#a6bc8d','#e5c3a2']];
const iso=(x,y,w,h,c)=>`<path d="M${x} ${y}l${w} ${-w/2} ${w} ${w/2}-${w} ${w/2}Z" fill="#f5f0d9"/><path d="M${x} ${y}l${w} ${w/2}v${h}l-${w}-${w/2}Z" fill="${c}"/><path d="M${x+w} ${y+w/2}l${w}-${w/2}v${h}l-${w} ${w/2}Z" fill="#b5c5ae"/>`;
function motif(scene,c){
  switch(scene){
    case 'steps':return Array.from({length:5},(_,i)=>iso(113+i*22,270-i*18,35,19,c)).join('');
    case 'bridge':return `<path d="M90 275Q200 145 310 275" fill="none" stroke="#eee8d3" stroke-width="27"/><path d="M90 267Q200 137 310 267" fill="none" stroke="#fff6e1" stroke-width="7"/>`;
    case 'arch':return `<path d="M166 267V185a34 34 0 0 1 68 0v82" stroke="#efe9d4" stroke-width="25" fill="none"/><path d="M200 178v65" stroke="#fff8de" stroke-width="4" opacity=".8"/>`;
    case 'islands':return iso(90,228,33,25,c)+iso(230,210,38,35,c)+iso(175,166,23,20,c);
    case 'bloom':case 'embrace':return `<path d="M200 272v-65" stroke="${c}" stroke-width="7"/><ellipse cx="183" cy="243" rx="22" ry="10" fill="${c}" transform="rotate(30 183 243)"/>${[0,60,120,180,240,300].map(a=>`<ellipse cx="200" cy="186" rx="14" ry="25" fill="#eebcb0" transform="rotate(${a} 200 208)"/>`).join('')}<circle cx="200" cy="208" r="13" fill="#ffedb7"/>`;
    case 'paths':return `<path d="M200 298V258Q200 240 150 212M200 258Q200 240 250 212" fill="none" stroke="#f8efd7" stroke-width="17"/>`;
    case 'echo':return `<path d="M136 262V202q0-12 12-12h104q12 0 12 12v60" fill="none" stroke="#f1ecd8" stroke-width="14"/>${[166,200,234].map((x,i)=>`<path d="M${x} 194v${25+i*8}" stroke="${c}" stroke-width="2"/><path d="M${x-8} ${222+i*8}q8-12 16 0v12h-16Z" fill="#e6c29f"/>`).join('')}`;
    case 'glow':return `<path d="M200 266V198" stroke="${c}" stroke-width="6"/><path d="M179 218l21-34 21 34-21 32Z" fill="#ffedb7"/><circle cx="200" cy="216" r="44" fill="#fff0b5" opacity=".2"/>`;
    case 'horizon':return `<circle cx="200" cy="195" r="38" fill="#fff1c6"/><path d="M125 245h150M145 258h110" stroke="#faf3dd" stroke-width="7" stroke-linecap="round"/>`;
    default:return `<ellipse cx="200" cy="258" rx="66" ry="25" fill="#a8cccb"/><ellipse cx="200" cy="256" rx="42" ry="15" fill="none" stroke="#f5f2df" stroke-width="2"/><path d="M184 243q16-32 32 0Z" fill="#f4edd7"/>`;
  }
}
export function illustration(f,stamp='',pet='bunny',night=false){
 if(f.image)return photoIllustration(f,stamp,pet,night);
 const seed=f.artSeed,[sky,light,green,pink]=palettes[seed%4],offset=seed%17;
 return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400" role="img" aria-label="${escape(f.theme)}主题治愈插画"><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="${night?'#59647f':sky}"/><stop offset="1" stop-color="${night?'#9aa6b4':light}"/></linearGradient><radialGradient id="halo"><stop stop-color="#fff9df" stop-opacity=".8"/><stop offset="1" stop-color="#fff9df" stop-opacity="0"/></radialGradient></defs><rect width="400" height="400" fill="url(#sky)"/><circle cx="${295-offset}" cy="85" r="80" fill="url(#halo)"/><circle cx="${295-offset}" cy="85" r="29" fill="#fff1c9"/><path d="M-30 158Q75 113 140 158T420 149V165H-30Z" fill="#fffdf0" opacity=".35"/><path d="M0 312Q90 265 170 306T400 290V380H0Z" fill="${green}" opacity=".22"/><ellipse cx="200" cy="335" rx="133" ry="18" fill="${green}" opacity=".15"/>${iso(70,275,130,32,green)}${motif(f.scene,green)}<path d="M98 266v-40M300 269v-36" stroke="${green}" stroke-width="4"/><ellipse cx="98" cy="221" rx="13" ry="27" fill="${green}"/><ellipse cx="300" cy="227" rx="12" ry="23" fill="${green}"/>${Array.from({length:9},(_,i)=>`<circle cx="${25+(seed*13+i*43)%350}" cy="${40+(seed*7+i*29)%260}" r="${i%2+1}" fill="#fff8d8" opacity=".8"/>`).join('')}</svg>`;
}
function legacyCylinder(){return `<svg viewBox="0 0 280 330" aria-hidden="true"><defs><linearGradient id="wood"><stop stop-color="#8caa88"/><stop offset=".45" stop-color="#c0d0a1"/><stop offset="1" stop-color="#819f79"/></linearGradient><linearGradient id="stick"><stop stop-color="#ede1bc"/><stop offset=".55" stop-color="#fff3cf"/><stop offset="1" stop-color="#d6bd89"/></linearGradient></defs><ellipse cx="140" cy="297" rx="81" ry="14" fill="#64836d" opacity=".15"/><ellipse cx="140" cy="137" rx="69" ry="20" fill="#566f52"/><ellipse cx="140" cy="139" rx="61" ry="15" fill="#627c59"/><path d="M71 137a69 20 0 0 1 138 0" fill="none" stroke="#adc397" stroke-width="5"/><g class="sticks">${[-3,-2,-1,0,1,2,3].map((v,i)=>`<g transform="rotate(${v*6} 140 190)"><rect x="${126+v*11}" y="${34+((i*17)%33)}" width="17" height="190" rx="6" fill="url(#stick)"/><path d="M${134+v*11} ${49+((i*17)%33)}v21" stroke="#bb8f72" stroke-width="2" stroke-linecap="round"/></g>`).join('')}</g><path d="M71 136l9 132q60 37 120 0l9-132q-69 35-138 0" fill="url(#wood)"/><path d="M71 136q69 35 138 0" fill="none" stroke="#d1ddb2" stroke-width="5" stroke-linecap="round"/><path d="M87 158l7 101M193 157l-7 102" stroke="#e3e8c3" stroke-opacity=".45" stroke-width="2"/><path d="M77 173q63 26 126 0M79 252q61 29 122 0" stroke="#d8dfb5" stroke-width="9" fill="none"/><rect x="113" y="181" width="54" height="60" rx="15" fill="#f3eed8"/><text x="140" y="222" text-anchor="middle" fill="#6d855d" font-size="29" font-family="serif">签</text><path d="M167 195q19 8 15 39" stroke="#d7a994" stroke-width="3" fill="none"/><circle cx="182" cy="237" r="5" fill="#d7a994"/></svg>`;}

// Preserve the full supplied image and reuse the same in-picture date/pet stamp.
function photoIllustration(f,stamp,pet,night){
 const overlay='';
 return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400" role="img" aria-label="${escape(f.theme)}主题配图"><image href="${escape(f.image)}" width="400" height="400" preserveAspectRatio="xMidYMid meet"/>${overlay}</svg>`;
}

export function cylinder(){return '<img class="cylinder-art" src="./assets/theme/fortune-cylinder.png" alt="" draggable="false">';}
