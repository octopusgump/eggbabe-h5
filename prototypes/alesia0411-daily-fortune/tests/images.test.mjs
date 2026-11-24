import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {fortunes} from '../shared/fortunes.mjs';
import {displayedFortune,randomImageIndex} from '../shared/paths.mjs';
test('each theme maps to five existing square PNG files',()=>{
 for(const theme of new Set(fortunes.map(f=>f.theme))){const f=fortunes.find(f=>f.theme===theme);
  for(let i=1;i<=5;i++){const session={fortuneId:f.id,imageIndex:i};const shown=displayedFortune(session);const path=new URL('../'+decodeURIComponent(shown.image),import.meta.url);assert.ok(existsSync(path));const bytes=readFileSync(path);assert.equal(bytes.readUInt32BE(16),bytes.readUInt32BE(20));assert.equal(displayedFortune(JSON.parse(JSON.stringify(session))).image,shown.image);}
 }
});
test('image random selection spans all five variants',()=>{assert.deepEqual([0,.2,.4,.6,.8,.999].map(n=>randomImageIndex(()=>n)),[1,2,3,4,5,5]);});
