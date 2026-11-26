import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const REPO = path.resolve(import.meta.dirname, "../..");
const Sound = require(path.join(REPO, "living-room-dress/sound-engine.js"));
const P5Data = require(path.join(REPO, "living-room-dress/p5-rooms-and-games.js"));

test("every recipe in EggBabeSound.RECIPES renders click-free, bounded, non-silent PCM with distinct seeded takes", () => {
  const keys = Object.keys(Sound.RECIPES);
  assert.ok(keys.length >= 40, `expected rich recipe catalog, got ${keys.length}`);

  for (const key of keys) {
    const r = Sound.RECIPES[key];
    const pcm0 = Sound.renderSamples(r, { sampleRate: 22050, seed: 0 });
    const pcm1 = Sound.renderSamples(r, { sampleRate: 22050, seed: 1 });
    assert.ok(pcm0.length > 64, `${key} rendered too few samples`);

    let maxAbs = 0;
    let energy = 0;
    for (let i = 0; i < pcm0.length; i++) {
      const v = pcm0[i];
      assert.equal(Number.isFinite(v), true, `${key} produced NaN/Infinity at sample ${i}`);
      const av = Math.abs(v);
      if (av > maxAbs) maxAbs = av;
      energy += v * v;
    }
    assert.ok(energy > 1e-5, `${key} rendered silence`);
    assert.ok(maxAbs <= 0.8501, `${key} exceeded peak ceiling: ${maxAbs}`);
    assert.ok(Math.abs(pcm0[0]) < 0.005, `${key} has start click: ${pcm0[0]}`);
    assert.ok(Math.abs(pcm0[pcm0.length - 1]) < 0.005, `${key} has end click: ${pcm0[pcm0.length - 1]}`);

    // Determinism & seeded variation check
    const pcm0Again = Sound.renderSamples(r, { sampleRate: 22050, seed: 0 });
    assert.deepEqual(pcm0, pcm0Again, `${key} seed=0 render must be deterministic`);

    let diffSum = 0;
    const minLen = Math.min(pcm0.length, pcm1.length);
    for (let i = 0; i < minLen; i++) diffSum += Math.abs(pcm0[i] - pcm1[i]);
    assert.ok(diffSum > 0.01, `${key} seed=0 and seed=1 takes should vary`);
  }
});

test("all 8 snacks map to dedicated material profiles and produce distinct Yutu vs Koi chewing sequences", () => {
  const allSnackIds = [
    "carrot",
    "osmanthus_cake",
    "cream_berry",
    "dried_fish",
    "berry_mochi",
    "star_candy",
    ...P5Data.CRAFTED_SNACKS.map((s) => s.id)
  ];
  assert.equal(allSnackIds.length, 8);

  const seenCategories = new Set();
  for (const id of allSnackIds) {
    assert.ok(Sound.SNACK_SOUND_PROFILES[id], `missing sound profile for snack: ${id}`);
    const prof = Sound.resolveSnackProfile(id);
    seenCategories.add(prof.category);
    assert.ok(Sound.RECIPES[prof.recipeKey], `missing bite recipe ${prof.recipeKey} for ${id}`);
  }
  assert.ok(seenCategories.size >= 5, "snacks should span at least 5 distinct physical food textures");

  const events = [];
  const ctrl = Sound.createController({
    getSfxOn: () => true,
    getPetId: () => "yutu",
    onEvent: (e) => events.push(e)
  });

  ctrl.munch("carrot", "yutu");
  assert.equal(events.length, 5, "Yutu munch should fire 4 fast incisor nibbles + 1 plush sigh");
  assert.equal(events[0].recipeKey, "bite_carrot");
  assert.equal(events[4].recipeKey, "emote_cute_yutu");

  events.length = 0;
  ctrl.munch("berry_mochi", "koi");
  assert.equal(events.length, 4, "Koi munch should fire 3 round chomps + 1 happy bubble hop");
  assert.equal(events[0].recipeKey, "bite_mochi");
  assert.equal(events[3].recipeKey, "hop_koi");
});

test("Yutu and Koi strictly differentiate across motion, jump, bounce, bath, sleep-pat, and 4 emotes, and respect mute guard", () => {
  let sfxOn = true;
  const events = [];
  const ctrl = Sound.createController({
    getSfxOn: () => sfxOn,
    getPetId: () => "koi",
    onEvent: (e) => events.push(e)
  });

  const pairs = [
    () => [ctrl.step("yutu", true), ctrl.step("koi", true)],
    () => [ctrl.jump("yutu"), ctrl.jump("koi")],
    () => [ctrl.minihop("yutu"), ctrl.minihop("koi")],
    () => [ctrl.bounce("yutu", 1), ctrl.bounce("koi", 1)],
    () => [ctrl.emoteVoice("yutu", "laugh"), ctrl.emoteVoice("koi", "laugh")],
    () => [ctrl.emoteVoice("yutu", "sad"), ctrl.emoteVoice("koi", "sad")],
    () => [ctrl.emoteVoice("yutu", "think"), ctrl.emoteVoice("koi", "think")],
    () => [ctrl.emoteVoice("yutu", "cute"), ctrl.emoteVoice("koi", "cute")],
    () => [ctrl.sleepPat("yutu"), ctrl.sleepPat("koi")],
    () => [ctrl.hungryRumble("yutu"), ctrl.hungryRumble("koi")],
    () => [ctrl.bathScrub("yutu", 0.6, 40), ctrl.bathScrub("koi", 0.6, 40)],
    () => [ctrl.bathRinse("yutu"), ctrl.bathRinse("koi")]
  ];

  for (const runPair of pairs) {
    events.length = 0;
    runPair();
    assert.ok(events.length >= 2);
    assert.notEqual(events[0].recipeKey, events[events.length - 1].recipeKey, "Yutu and Koi must trigger distinct recipes");
  }

  // Mute guard check
  sfxOn = false;
  events.length = 0;
  ctrl.tap();
  ctrl.clockOpen();
  ctrl.clockFlip(true);
  ctrl.clockWindStepBurst(0.5);
  ctrl.jump("yutu");
  ctrl.munch("star_candy", "koi");
  ctrl.bathScrub("yutu", 0.8, 50);
  assert.equal(events.length, 0, "when sfxOn is false, zero sound events may fire");
});

test("bath scrubbing velocity effort & dual-pet efficiency curves differentiate plush Yutu vs sleek Koi", () => {
  const slowEffort = Sound.computeScrubEffort(4, 32);
  const fastEffort = Sound.computeScrubEffort(42, 16);
  assert.ok(fastEffort > slowEffort, `fast scrub effort (${fastEffort}) must exceed slow effort (${slowEffort})`);

  // Early stage (progress = 10%): Koi glides faster while Yutu plush coat absorbs water
  const earlyYutu = Sound.computeBathStepDelta("yutu", 10, 20, 16);
  const earlyKoi = Sound.computeBathStepDelta("koi", 10, 20, 16);
  assert.ok(earlyKoi > earlyYutu, "Koi should lather faster than Yutu in initial 0-30% phase");

  // Warmed-up rich foam stage (progress = 55%): Yutu dense coat foams faster than Koi
  const midYutu = Sound.computeBathStepDelta("yutu", 55, 20, 16);
  const midKoi = Sound.computeBathStepDelta("koi", 55, 20, 16);
  assert.ok(midYutu > midKoi, "Yutu dense plush foam should accelerate past Koi after 30%");
});

test("index.html and app.js mount sound-engine.js and tactile brass #ip-clock-fidget-key without countdown UI", () => {
  const html = fs.readFileSync(path.join(REPO, "index.html"), "utf8");
  const appJs = fs.readFileSync(path.join(REPO, "living-room-dress/app.js"), "utf8");

  assert.ok(html.includes('./living-room-dress/sound-engine.js'), "index.html must load sound-engine.js");
  assert.ok(html.includes('id="ip-clock-fidget-key"'), "Black Cat clock backplate must mount #ip-clock-fidget-key");
  assert.ok(html.includes('id="ip-clock-fidget-svg"'), "fidget key must render brass sheriff-star SVG");
  assert.equal(html.includes('id="btn-clock-windup"'), false, "legacy 25m focus countdown button must stay absent");

  assert.ok(appJs.includes("sfx.clockOpen()"), "clock modal open must play welcome tick foley");
  assert.ok(appJs.includes("sfx.clockFlip(target)"), "clock flip must play front/back 3D foley");
  assert.ok(appJs.includes("sfx.clockWindTick("), "continuous windup drag must play speed/tension ratchet ticks");
  assert.ok(appJs.includes("sfx.clockWindRelease()"), "releasing wound key must play pawl snapback");
  assert.ok(appJs.includes("sfx.munch(snack.id, state.petId)"), "snack consumption must pass snackId and petId");
  assert.ok(appJs.includes("sfx.bathScrub(state.petId, effort, bathProgress)"), "bath scrubbing must couple hand velocity & petId");
});
