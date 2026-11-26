import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const REPO = path.resolve(import.meta.dirname, "../..");
const Store = require(path.join(REPO, "living-room-dress/cross-end-store.js"));
const HoloConfig = require(path.join(REPO, "living-room-dress/holo-pack/holo-pack-config.js"));
const catalog = JSON.parse(fs.readFileSync(path.join(REPO, "assets/shared/catalog.json"), "utf8"));

test("holo-pack maps all 41 catalog keepsakes cleanly with zero missing PNGs and zero forbidden brand/format strings", () => {
  const pool = HoloConfig.buildKeepsakeCardPool(catalog, "../../");
  assert.equal(pool.length, 41, "must map all 41 keepsakes");

  const tierCounts = {};
  for (const card of pool) {
    tierCounts[card.rarity] = (tierCounts[card.rarity] || 0) + 1;
    assert.ok(card.id && card.name && card.image, `card missing fields: ${card.id}`);
    const absImg = path.join(REPO, card.rawImg);
    assert.equal(fs.existsSync(absImg), true, `keepsake PNG missing on disk: ${card.rawImg}`);
  }
  assert.deepEqual(tierCounts, { secret: 6, holo: 12, ultra: 12, common: 11 });

  const webpPattern = new RegExp("\\.we" + "bp\\b", "i");
  const filesToAudit = [
    "living-room-dress/holo-pack/index.html",
    "living-room-dress/holo-pack/holo-pack.css",
    "living-room-dress/holo-pack/holo-pack.js",
    "living-room-dress/holo-pack/holo-pack-config.js",
    "living-room-dress/holo-pack/holo-pack-sound.js",
    "living-room-dress/holo-card-showcase.css",
    "living-room-dress/holo-card-showcase.js"
  ];
  for (const rel of filesToAudit) {
    const src = fs.readFileSync(path.join(REPO, rel), "utf8");
    assert.equal(webpPattern.test(src), false, `${rel} must not reference webp`);
    assert.equal(/simplemkt/i.test(src), false, `${rel} must not contain SimpleMkt proprietary branding`);
  }
});

test("rollEggBabePack always deals 3 distinct cards, prioritizes unowned keepsakes, and enforces 3-pack pity for 祈愿典藏", () => {
  const pool = HoloConfig.buildKeepsakeCardPool(catalog, "../../");

  for (let i = 0; i < 30; i++) {
    const roll = HoloConfig.rollEggBabePack({ pool, unlockedIds: [], pityCount: 0 });
    assert.equal(roll.entries.length, 3, "every pack must have 3 cards");
    const ids = new Set(roll.entries.map((e) => e.def.id));
    assert.equal(ids.size, 3, "cards inside a single pack must be distinct");
  }

  // Pity trigger on 3rd pack (pityCount >= 2) guarantees a secret (shared) card
  for (let i = 0; i < 20; i++) {
    const pityRoll = HoloConfig.rollEggBabePack({ pool, unlockedIds: [], pityCount: 2 });
    assert.equal(pityRoll.hitSecret, true, "pity pack must include a 祈愿典藏 card");
    assert.equal(pityRoll.entries.some((e) => e.def.rarity === "secret"), true);
  }
});

test("cross-end-store holo-pack economy: daily free pack UTC+8 rollover, 20-star charge, auto-slot unlock, and +5 duplicate refund", () => {
  const day1 = Date.UTC(2026, 10, 24, 4, 0, 0); // 2026-11-24 12:00 UTC+8
  const day2 = Date.UTC(2026, 10, 25, 4, 0, 0); // 2026-11-25 12:00 UTC+8
  const store = Store.createDefaultState({ now: day1 });
  store.companion.starBalance = 25;

  // 1. First pack today is free
  assert.equal(Store.canOpenFreeHoloPack(store, "2026-11-24"), true);
  const freeCharge = Store.chargeHoloPackOpen(store, { now: day1, petId: "yutu" });
  assert.equal(freeCharge.ok, true);
  assert.equal(freeCharge.free, true);
  assert.equal(freeCharge.cost, 0);
  assert.equal(store.companion.starBalance, 25);
  assert.equal(Store.canOpenFreeHoloPack(store, "2026-11-24"), false);

  // 2. Second pack today costs 20 stars
  const paidCharge = Store.chargeHoloPackOpen(store, { now: day1, petId: "yutu" });
  assert.equal(paidCharge.ok, true);
  assert.equal(paidCharge.free, false);
  assert.equal(paidCharge.cost, Store.HOLO_PACK_STAR_COST);
  assert.equal(store.companion.starBalance, 5);

  // 3. Third pack today fails gracefully with missing=15
  const failCharge = Store.chargeHoloPackOpen(store, { now: day1, petId: "yutu" });
  assert.equal(failCharge.ok, false);
  assert.equal(failCharge.missing, 15);

  // 4. Next UTC+8 day restores free pack
  assert.equal(Store.canOpenFreeHoloPack(store, "2026-11-25"), true);
  const nextFree = Store.chargeHoloPackOpen(store, { now: day2, petId: "koi" });
  assert.equal(nextFree.ok, true);
  assert.equal(nextFree.free, true);

  // 5. New keepsake unlock auto-slots into oak shelf; duplicate refunds +5 stars
  const unlock1 = Store.settleHoloPackCard(store, "k_a01_prayer_stick", { now: day2, petId: "yutu" });
  assert.equal(unlock1.ok, true);
  assert.equal(unlock1.isNew, true);
  assert.equal(unlock1.refundStars, 0);
  assert.ok(store.curioCabinet.unlockedIds.includes("k_a01_prayer_stick"));
  assert.ok(store.curioCabinet.shelfSlots.includes("k_a01_prayer_stick"));

  const dup = Store.settleHoloPackCard(store, "k_a01_prayer_stick", { now: day2, petId: "yutu" });
  assert.equal(dup.ok, true);
  assert.equal(dup.isNew, false);
  assert.equal(dup.refundStars, Store.HOLO_PACK_DUPLICATE_REFUND);
  assert.equal(store.companion.starBalance, 5 + Store.HOLO_PACK_DUPLICATE_REFUND);
});

test("buildEntityEggCardData produces complete 3D holographic identity cards for both koi and yutu", () => {
  const store = Store.createDefaultState({ now: Date.UTC(2026, 10, 24, 4, 0, 0) });
  store.companion.totalCompanionDays = 14;
  for (const petId of ["koi", "yutu"]) {
    const card = HoloConfig.buildEntityEggCardData({
      petId,
      store,
      catalog,
      assetPrefix: "./"
    });
    assert.equal(card.kind, "entity-egg");
    assert.equal(card.petId, petId);
    assert.ok(card.image.endsWith(".png"), `expected PNG outfit image, got ${card.image}`);
    assert.equal(card.backMeta.totalDays, 14);
    assert.equal(card.backMeta.publicId, store.user.publicId);
    assert.equal(Array.isArray(card.backMeta.orbs), true);
    assert.equal(card.backMeta.orbs.length, 5);
    assert.ok(card.backMeta.moodIcon && card.backMeta.moodLabel && card.backMeta.statusLabel && card.backMeta.personaLabel);
  }
});

test("index.html, app.js, and settings-panel.js wire Option C dual integration properly", () => {
  const html = fs.readFileSync(path.join(REPO, "index.html"), "utf8");
  const appJs = fs.readFileSync(path.join(REPO, "living-room-dress/app.js"), "utf8");
  const settingsJs = fs.readFileSync(path.join(REPO, "living-room-dress/settings-panel.js"), "utf8");

  assert.match(html, /holo-card-showcase\.css/);
  assert.match(html, /holo-pack\/holo-pack-config\.js/);
  assert.match(html, /holo-card-showcase\.js/);
  assert.match(html, /id="btn-curio-open-pack"/);
  assert.match(html, /id="btn-detail-holo-view"/);
  assert.match(html, /data-album-tab="holocards"/);
  assert.match(html, /id="holocards-album-view"/);
  assert.match(html, /id="tb-btn-diary"/);
  assert.match(html, /id="diary-modal-view"/);

  assert.match(appJs, /id:\s*"holo-pack"/);
  assert.match(appJs, /eggbabe:holo-pack-complete/);
  assert.match(appJs, /eggbabe:holo-pack-nav/);
  assert.match(appJs, /onOpenHoloCard:/);
  assert.match(appJs, /btn-detail-holo-view/);
  assert.match(appJs, /btn-curio-open-pack/);
  assert.match(appJs, /renderHolocardsAlbum/);
  assert.match(appJs, /openDiaryModal/);

  assert.match(settingsJs, /onOpenHoloCard/);
});
