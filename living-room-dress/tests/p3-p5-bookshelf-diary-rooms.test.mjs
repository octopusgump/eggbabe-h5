import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const REPO = path.resolve(import.meta.dirname, "../..");
const Store = require(path.join(REPO, "living-room-dress/cross-end-store.js"));
const DiaryEngine = require(path.join(REPO, "living-room-dress/diary-engine.js"));
const P5Data = require(path.join(REPO, "living-room-dress/p5-rooms-and-games.js"));

test("P3 & P5 DOM structure, 4-tab capsule-safe topbar, bookshelf miniatures, and zero .webp compliance", () => {
  const html = fs.readFileSync(path.join(REPO, "index.html"), "utf8");
  assert.ok(html.includes('id="mod-books-curio-minis"'), "bookshelf middle-shelf curio miniatures must exist");
  assert.ok(html.includes("eb-nav-bar--four-tabs"), "unified 4-tab capsule-safe topbar must exist");
  for (const tab of ["album", "postcards", "holocards", "keepsakes"]) {
    assert.ok(html.includes(`data-album-tab="${tab}"`), `missing unified tab: ${tab}`);
  }
  for (const id of [
    "tb-btn-diary",
    "holocards-album-view",
    "diary-modal-view",
    "bookshelf-hub-overlay",
    "diary-cover-overlay",
    "diary-book-view",
    "diary-polaroid-img",
    "house-guide-overlay",
    "yard-mailbox-overlay",
    "native-minigame-overlay",
    "kitchen-room-props",
    "yard-room-props",
    "yard-mailbox-flag"
  ]) {
    assert.ok(html.includes(`id="${id}"`), `missing required element #${id}`);
  }

  for (const rel of [
    "index.html",
    "living-room-dress/app.js",
    "living-room-dress/style.css",
    "living-room-dress/cross-end-store.js",
    "living-room-dress/diary-engine.js",
    "living-room-dress/p5-rooms-and-games.js"
  ]) {
    const src = fs.readFileSync(path.join(REPO, rel), "utf8");
    assert.equal(/\.webp\b/i.test(src), false, `${rel} must not contain any .webp references`);
  }
});

test("P3 diary engine has 32 four-archetype cold-humor templates, all passing anti-fluff validation", () => {
  assert.equal(DiaryEngine.DIARY_TEMPLATES.length, 32, "must have exactly 32 templates");
  const counts = {};
  for (const tpl of DiaryEngine.DIARY_TEMPLATES) {
    counts[tpl.archetype] = (counts[tpl.archetype] || 0) + 1;
    const sampleFact = {
      outfit: "雨天小青蛙",
      snack: "桂花蜜糕",
      focusMin: 25,
      miniGame: "一起画",
      keepsake: "小黄鸭"
    };
    const built = tpl.build(sampleFact);
    const check = DiaryEngine.validateDiaryEntry(built);
    assert.equal(check.ok, true, `template ${tpl.id} failed validation: ${check.reason}`);
  }
  for (const arch of DiaryEngine.ARCHETYPES) {
    assert.equal(counts[arch], 8, `archetype ${arch} must have 8 templates`);
  }
});

test("P3 diaryAdapter interface supports pluggable adapters with automatic anti-fluff fallback & zero-guilt absence rule", async () => {
  const t0 = Date.parse("2026-11-24T13:30:00Z"); // 2026-11-24 21:30 UTC+8
  const store = Store.createDefaultState({ now: t0 });
  store.companion.lastEffectiveDate = "2026-11-20"; // 4-day absence
  Store.recordDailyEvent(store, "2026-11-24", "yutu", {
    outfitId: "set_rain_frog",
    snackId: "osmanthus_cake",
    focusMinutes: 25,
    countsAsEffective: false
  });

  // 1. Custom adapter returning banned fluff -> validator rejects and falls back to local 32-template engine
  DiaryEngine.setDiaryAdapter({
    name: "mock-fluff-llm",
    async generateDiary() {
      return {
        title: "元气满满的一天",
        body: "亲爱的主人，今天又是元气满满温暖治愈开心的一天！多喝热水加油哦！！",
        ps: "感恩陪伴"
      };
    }
  });
  const res = await DiaryEngine.checkAndSettleDiary(store, null, { now: t0 });
  DiaryEngine.setDiaryAdapter(null); // reset to default local

  assert.ok(res.generated, "should generate today's diary at 21:30 with real interaction");
  assert.equal(res.generated.generator, "local-cold-humor-32", "fluff output must fall back to local engine");
  assert.equal(DiaryEngine.validateDiaryEntry(res.generated).ok, true);
  assert.ok(res.welcomeBackNote.length > 0, "absence >= 2 days should attach a zero-guilt welcome-back doodle");
  assert.equal(store.diaries.length, 1, "must never backfill fake diaries for absent days");
});

test("P5 daily star soft caps (45 minigame / 15 care), decor unlock, multi-room unlock, crafted snacks & yard mailbox", () => {
  const t0 = Date.parse("2026-11-24T04:00:00Z");
  const store = Store.createDefaultState({ now: t0 });
  const dk = Store.getUtc8DateKey(t0);
  const startStars = store.companion.starBalance;

  // 1. Minigame soft cap <= 45/day, overflow grants +5 EXP
  for (let i = 0; i < 4; i++) {
    const r = Store.awardActivityStars(store, 10, { dateKey: dk, miniGameId: "doodle_prop" });
    assert.equal(r.starsAwarded, 10);
  }
  const r5 = Store.awardActivityStars(store, 10, { dateKey: dk, miniGameId: "bakery_tap" });
  assert.equal(r5.starsAwarded, 5, "5th game should cap at remaining 5 stars to hit 45");
  assert.equal(r5.earnedToday, 45);
  const r6 = Store.awardActivityStars(store, 10, { dateKey: dk, miniGameId: "listen_qa" });
  assert.equal(r6.starsAwarded, 0, "6th game should award 0 stars");
  assert.equal(r6.expAwarded, 5, "capped game should still award +5 EXP");
  assert.equal(store.companion.starBalance, startStars + 45);

  // 2. Micro-care soft cap <= 15/day
  let careTotal = 0;
  for (let i = 0; i < 10; i++) {
    careTotal += Store.awardCareStars(store, 3, { dateKey: dk }).starsAwarded;
  }
  assert.equal(careTotal, 15, "daily micro-care stars must cap at 15");

  // 3. Decor unlock & permanent ownership
  const decor = P5Data.getDecorById("bed_matcha_waffle");
  const d1 = Store.unlockDecorItem(store, decor);
  assert.equal(d1.ok, true);
  assert.equal(d1.alreadyOwned, false);
  assert.ok(store.house.unlockedDecorIds.includes("bed_matcha_waffle"));
  assert.equal(store.house.roomModules.living_room.mod_bed.styleId, "bed_matcha_waffle");
  const balAfterDecor = store.companion.starBalance;
  const d2 = Store.unlockDecorItem(store, decor);
  assert.equal(d2.alreadyOwned, true);
  assert.equal(store.companion.starBalance, balAfterDecor, "re-equipping owned decor must be free");

  // 4. Multi-room progressive unlock (cozy_kitchen: 3 days + 60✦, sunlit_yard: 7 days + 150✦)
  const kitchen = P5Data.getRoomById("cozy_kitchen");
  const yard = P5Data.getRoomById("sunlit_yard");
  const kBlocked = Store.unlockRoom(store, kitchen);
  assert.equal(kBlocked.ok, false);
  assert.equal(kBlocked.reason, "insufficient_days");

  store.companion.totalCompanionDays = 7;
  store.companion.starBalance = 250;
  const kOk = Store.unlockRoom(store, kitchen);
  assert.equal(kOk.ok, true);
  assert.equal(store.companion.starBalance, 190);
  assert.ok(store.house.unlockedRoomIds.includes("cozy_kitchen"));

  const yOk = Store.unlockRoom(store, yard);
  assert.equal(yOk.ok, true);
  assert.equal(store.companion.starBalance, 40);
  assert.ok(store.house.unlockedRoomIds.includes("sunlit_yard"));

  // 5. Crafted snack & yard mailbox
  assert.equal(Store.addCraftedSnack(store, "osmanthus_pancake", 2), 2);
  assert.equal(Store.consumeCraftedSnack(store, "osmanthus_pancake"), true);
  assert.equal(store.house.craftedSnacks.osmanthus_pancake, 1);

  assert.equal(Store.deliverYardMailboxItem(store, { id: "mail_1", title: "桂月来信", starBonus: 6 }), true);
  assert.equal(store.house.mailboxUnreadIds.length, 1);
  const claimed = Store.claimYardMailboxItem(store, "mail_1");
  assert.ok(claimed);
  assert.equal(store.house.mailboxUnreadIds.length, 0);
  assert.equal(store.companion.starBalance, 46);
});
