import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const REPO = path.resolve(import.meta.dirname, "../..");
const Voice = require(path.join(REPO, "living-room-dress/voice-bank.js"));
const Store = require(path.join(REPO, "living-room-dress/cross-end-store.js"));
const SettingsPanel = require(path.join(REPO, "living-room-dress/settings-panel.js"));

test("EggBabeVoice defines 6 swappable personality archetypes, all passing anti-fluff validation", () => {
  assert.equal(Voice.PERSONA_LIST.length, 6, "must expose 6 swappable personality archetypes");
  const check = Voice.validateAllLines();
  assert.equal(check.ok, true, `voice bank anti-fluff check failed: ${check.issues.join("; ")}`);

  const requiredScenes = [
    "hungry",
    "dirty",
    "hungry_and_dirty",
    "feed_recover",
    "bath_recover",
    "petted",
    "sleep_blocked",
    "wake_pat",
    "wake_done",
    "lamp_on",
    "lamp_off",
    "outfit_done"
  ];
  for (const p of Voice.PERSONA_LIST) {
    const bank = Voice.PERSONA_LINES[p.id];
    assert.ok(bank, `missing line bank for ${p.id}`);
    for (const sc of requiredScenes) {
      assert.ok(Array.isArray(bank[sc]) && bank[sc].length >= 2, `${p.id}.${sc} must have >= 2 lines`);
    }
    assert.ok(Voice.getDirtyCueText(p.id).length > 0, `${p.id} must have a dirty cue text`);
  }
});

test("EggBabeVoice decouples species tokens from personality and avoids consecutive duplicates", () => {
  const yutuSample = Voice.getSampleLine("yutu", "tsundere_boss", "feed_recover");
  const koiSample = Voice.getSampleLine("koi", "tsundere_boss", "feed_recover");
  assert.ok(yutuSample.includes("胡萝卜"), `expected yutu favSnack token in: ${yutuSample}`);
  assert.ok(koiSample.includes("小鱼干"), `expected koi favSnack token in: ${koiSample}`);

  const a = Voice.pick("yutu", "dry_wit", "hungry");
  const b = Voice.pick("yutu", "dry_wit", "hungry");
  assert.notEqual(a, b, "consecutive picks from a multi-line pool must not repeat immediately");
});

test("cross-end-store defaults personaId for yutu & koi, and settings-panel persona view exists", () => {
  const store = Store.createDefaultState({ now: Date.parse("2026-11-25T04:00:00Z") });
  assert.equal(store.pets.yutu.personaId, "dry_wit");
  assert.equal(store.pets.koi.personaId, "chill_daze");
  assert.equal(SettingsPanel.VIEW_TITLES.persona, "伙伴人格类型");
});
