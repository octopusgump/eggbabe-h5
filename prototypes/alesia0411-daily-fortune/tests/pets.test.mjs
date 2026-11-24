import test from 'node:test';
import assert from 'node:assert/strict';
import {stampForPet,stampSvg} from '../js/stamp.js';
import {validateInput} from '../server/interpret.mjs';
test('pet selection chooses the matching seal and AI identity',()=>{
 assert.match(stampSvg('2026.11.22 16:00',stampForPet('fish')),/fish-seal.png/);
 assert.match(stampSvg('2026.11.22 16:00',stampForPet('bunny')),/rabbit-seal.png/);
 assert.equal(validateInput({fortuneId:'F001',direction:'生活',question:'',pet:'fish'}).pet,'小鱼');
});
