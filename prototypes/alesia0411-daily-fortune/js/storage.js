const prefix='daily-fortune-v1:';
let failed=false;
export function read(key,fallback){try{return JSON.parse(localStorage.getItem(prefix+key))??fallback;}catch{return fallback;}}
export function write(key,value){try{localStorage.setItem(prefix+key,JSON.stringify(value));}catch{failed=true;}}
export const storageFailed=()=>failed;
