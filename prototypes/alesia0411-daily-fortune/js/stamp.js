export const stampAsset='./assets/stamps/rabbit-seal.png';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// A separate vertical signature keeps the illustration and fortune unobstructed.
export function stampSvg(value,asset=stampAsset){
 const [date,...time]=String(value).trim().split(/\s+/);
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 116 98" width="116" height="98" role="img" aria-label="${esc(value)}"><image href="${esc(asset)}" x="27" y="0" width="62" height="62"/><g text-anchor="middle" fill="#796250" font-family="'Kaiti SC','STKaiti','KaiTi',serif"><text x="58" y="76" font-size="15" letter-spacing=".4">${esc(date)}</text><text x="58" y="94" font-size="14" letter-spacing="1">${esc(time.join(' '))}</text></g></svg>`;
}

export const stampForPet=pet=>pet==='fish'?'./assets/stamps/fish-seal.png':stampAsset;
