import test from 'node:test';
import assert from 'node:assert/strict';
import {fortunes} from '../shared/fortunes.mjs';
import {sessionKey,selectFortune,displayedFortune,DEMO_IMAGE} from '../shared/paths.mjs';
import {illustration} from '../js/art.js';
import {validateInput} from '../server/interpret.mjs';
test('selected demo always returns exact specified lot, even in recent history',()=>{for(const n of [0,.3,.99])assert.equal(selectFortune(true,fortunes,['F155'],()=>n).text,'让注意力有所安放，让行动有所回应。');assert.equal(selectFortune(false,fortunes,[],()=>0).id,'F001');assert.notEqual(sessionKey(true),sessionKey(false));});
test('demo image scoped to demo path, full image without an overlaid stamp',()=>{const f=displayedFortune({path:'focus-demo',fortuneId:'F155'});assert.equal(f.image,DEMO_IMAGE);assert.match(displayedFortune({fortuneId:'F155'}).image,/library/);const svg=illustration(f,'2026.11.19 12:00','bunny');assert.match(svg,/viewBox="0 0 400 400"/);assert.match(svg,/focus-demo.png/);assert.doesNotMatch(svg,/今日有幸|2026.11.19/);assert.equal(validateInput({fortuneId:f.id,direction:'学业',question:'',pet:'bunny'}).fortune,f.text);});
