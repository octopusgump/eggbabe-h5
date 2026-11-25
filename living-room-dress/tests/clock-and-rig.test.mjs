import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const REPO = path.resolve(import.meta.dirname, "../..");
const Store = require(path.join(REPO, "living-room-dress/cross-end-store.js"));

test("floating #room-clock is removed and unified cozy room + nighttime sleep patch + 4 core hotspots are mounted", () => {
  const html = fs.readFileSync(path.join(REPO, "index.html"), "utf8");
  assert.equal(html.includes('id="room-clock"'), false, "legacy floating #room-clock must be removed");
  assert.equal(html.includes('id="mod-desk-set"'), false, "cluttered #mod-desk-set cutout must be removed");
  assert.equal(html.includes('id="mod-jewelry-box"'), false, "cluttered #mod-jewelry-box cutout must be removed");
  assert.equal(html.includes('id="mod-wall-art"'), false, "cluttered #mod-wall-art cutout must be removed");
  assert.equal(html.includes('id="mod-bed-blanket"'), false, "daytime blanket overlay must be removed");
  assert.equal(html.includes('id="hit-bed-blanket"'), false, "daytime blanket hotspot must be removed");
  assert.ok(html.includes("cozy_room_day.png"), "default panorama must point to unified cozy_room_day.png");
  assert.ok(html.includes('id="bedside-cat-clock"'), "bedside Black Cat Sheriff clock must be mounted");
  assert.ok(html.includes('id="clock-modal-overlay"'), "Flip clock modal must exist");
  assert.ok(html.includes('id="pet-sleep-sprite"'), "nighttime tucked sleeping sprite layer must exist");
  assert.ok(html.includes('id="room-atmosphere-tint"'), "unified global atmosphere tint layer must exist");
  assert.ok(html.includes('id="books-mail-bubble"'), "bookshelf unread mail bubble must exist");
  assert.ok(html.includes('id="hit-bed-lamp"'), "bedside lamp transparent hotspot must exist");
  assert.ok(html.includes('id="hit-bookshelf"'), "bookshelf transparent hotspot must exist");
  assert.ok(html.includes('id="hit-desk-mirror"'), "desk mirror fitting-room hotspot must exist");
  assert.ok(html.includes('id="hit-cat-clock"'), "cat clock hotspot must exist");
});

test("all final cozy room assets (day, night, nightLit, yutu/koi sleep, 2 sill props) and clock assets exist as compressed PNGs with zero .webp or legacy modular references", () => {
  const expectedPngs = [
    "living-room-dress/panoramas/cozy_room_day.png",
    "living-room-dress/panoramas/cozy_room_night.png",
    "living-room-dress/panoramas/cozy_room_night_lit.png",
    "living-room-dress/modules/yutu_bed_sleep.png",
    "living-room-dress/modules/koi_bed_sleep.png",
    "living-room-dress/props/sill_sunny_plant.png",
    "living-room-dress/props/sill_night_jar.png",
    "living-room-dress/props/clock_black_cat_front.png",
    "living-room-dress/props/clock_black_cat_back.png",
    "living-room-dress/props/clock_black_cat_mid.png",
    "living-room-dress/props/clock_black_cat_tail.png",
    "living-room-dress/props/clock_black_cat_scene.png"
  ];
  const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  for (const rel of expectedPngs) {
    const abs = path.join(REPO, rel);
    assert.ok(fs.existsSync(abs), `missing asset ${rel}`);
    const buf = fs.readFileSync(abs);
    assert.deepEqual(buf.subarray(0, 8), PNG_SIG, `${rel} must be a valid PNG`);
  }

  // Verify clock asset bundle < 180 KB per PRD §3.3(1)
  const clockTotalBytes = [
    "living-room-dress/props/clock_black_cat_front.png",
    "living-room-dress/props/clock_black_cat_back.png",
    "living-room-dress/props/clock_black_cat_mid.png",
    "living-room-dress/props/clock_black_cat_tail.png",
    "living-room-dress/props/clock_black_cat_scene.png"
  ].reduce((sum, rel) => sum + fs.statSync(path.join(REPO, rel)).size, 0);
  assert.ok(clockTotalBytes < 180 * 1024, `clock PNG bundle (${clockTotalBytes}B) should stay < 180 KB`);

  // Verify zero .webp and zero deleted legacy modular PNG asset references in active source files
  const deprecatedRe = /(room_shell_|mod_bed_base|mod_blanket_|mod_bookshelf|mod_desk_set|mod_jewelry_|mod_lamp_|mod_wall_art|prop_wood_mirror|sill_rainy_teru)[^"'\s]*\.png/i;
  for (const rel of ["index.html", "living-room-dress/app.js", "living-room-dress/style.css", "living-room-dress/cross-end-store.js"]) {
    const src = fs.readFileSync(path.join(REPO, rel), "utf8");
    assert.equal(/\.webp\b/i.test(src), false, `${rel} must not reference .webp`);
    assert.equal(deprecatedRe.test(src), false, `${rel} must not reference deleted legacy modular assets`);
  }
});

test("settleFocusSession recovers lock-screen elapsed timestamps idempotently with 15m(+5) / 25m(+10) and daily 3x cap", () => {
  const t0 = Date.parse("2026-11-24T02:00:00Z"); // 2026-11-24 10:00 UTC+8
  const store = Store.createDefaultState({ now: t0 });
  const initialStars = store.companion.starBalance;

  // 1. Start 15m focus session, check before completion -> not settled
  store.clockWidget.focusSession.active = true;
  store.clockWidget.focusSession.durationMin = 15;
  store.clockWidget.focusSession.startedAt = t0;
  const mid = Store.settleFocusSession(store, t0 + 10 * 60000);
  assert.equal(mid.settled, false);
  assert.equal(store.companion.starBalance, initialStars);

  // 2. Wake from lock screen after 18m -> settles +5 stars and writes P0 dailyEventLog
  const r1 = Store.settleFocusSession(store, t0 + 18 * 60000);
  assert.equal(r1.settled, true);
  assert.equal(r1.starsAwarded, 5);
  assert.equal(r1.capped, false);
  assert.equal(store.companion.starBalance, initialStars + 5);
  assert.equal(store.clockWidget.focusSession.active, false);
  assert.equal(store.clockWidget.focusSession.startedAt, null);
  assert.equal(store.dailyEventLog["2026-11-24"].koi.focusMinutes, 15);

  // 3. Idempotent double-settle -> no extra stars
  const r1Again = Store.settleFocusSession(store, t0 + 19 * 60000);
  assert.equal(r1Again.settled, false);
  assert.equal(store.companion.starBalance, initialStars + 5);

  // 4. Two more 25m sessions -> +10 and +10 (reaching 3/3 daily cap)
  for (let i = 0; i < 2; i++) {
    const start = t0 + (30 + i * 30) * 60000;
    store.clockWidget.focusSession.active = true;
    store.clockWidget.focusSession.durationMin = 25;
    store.clockWidget.focusSession.startedAt = start;
    const r = Store.settleFocusSession(store, start + 26 * 60000);
    assert.equal(r.settled, true);
    assert.equal(r.starsAwarded, 10);
    assert.equal(r.capped, false);
  }
  assert.equal(store.companion.starBalance, initialStars + 25);
  assert.equal(store.dailyEventLog["2026-11-24"].koi.focusMinutes, 65);

  // 5. 4th session same day -> still settles & logs focusMinutes, but stars capped at 0
  const t4 = t0 + 120 * 60000;
  store.clockWidget.focusSession.active = true;
  store.clockWidget.focusSession.durationMin = 25;
  store.clockWidget.focusSession.startedAt = t4;
  const r4 = Store.settleFocusSession(store, t4 + 26 * 60000);
  assert.equal(r4.settled, true);
  assert.equal(r4.capped, true);
  assert.equal(r4.starsAwarded, 0);
  assert.equal(store.companion.starBalance, initialStars + 25);

  // 6. Next UTC+8 day resets daily cap -> +10 stars again
  const nextDay = t0 + 24 * 3600 * 1000;
  store.clockWidget.focusSession.active = true;
  store.clockWidget.focusSession.durationMin = 25;
  store.clockWidget.focusSession.startedAt = nextDay;
  const rNext = Store.settleFocusSession(store, nextDay + 26 * 60000);
  assert.equal(rNext.settled, true);
  assert.equal(rNext.capped, false);
  assert.equal(rNext.starsAwarded, 10);
  assert.equal(store.companion.starBalance, initialStars + 35);
});

test("sleep pat-to-wake guard (blocks feed/bath/wardrobe, allows activities) and unified toolbox rooms & backgrounds", () => {
  const html = fs.readFileSync(path.join(REPO, "index.html"), "utf8");
  const appJs = fs.readFileSync(path.join(REPO, "living-room-dress/app.js"), "utf8");
  const P5Data = require(path.join(REPO, "living-room-dress/p5-rooms-and-games.js"));

  // 1. Sleep pat-to-wake hotspot & 3-stage animation hooks
  assert.ok(html.includes('id="hit-sleep-pet"'), "sleep pat-to-wake hotspot must exist");
  assert.ok(appJs.includes("function isPetSleepingNow()"), "isPetSleepingNow helper must exist");
  assert.ok(appJs.includes("function promptPatToWake("), "promptPatToWake helper must exist");
  assert.ok(appJs.includes("function wakePetWithPatAnimation()"), "wakePetWithPatAnimation must exist");
  assert.ok(appJs.includes('promptPatToWake("feed")'), "feed must be guarded when sleeping");
  assert.ok(appJs.includes('promptPatToWake("bath")'), "bath must be guarded when sleeping");
  assert.ok(appJs.includes('promptPatToWake("wardrobe")'), "wardrobe must be guarded when sleeping");
  assert.ok(appJs.includes('nightLit: "./living-room-dress/panoramas/cozy_room_night_lit.png"'), "nightLit panorama must be configured");

  // 2. Unified rooms & backgrounds inside bottom-right toolbox; top pill hidden; wardrobe bg tab removed
  assert.ok(html.includes('id="tb-btn-spaces"'), "toolbox must contain unified 房间背景 entry");
  assert.ok(html.includes('id="house-bgs-pane"'), "house guide modal must include #house-bgs-pane");
  assert.ok(html.includes('data-house-tab="bgs"'), "house guide modal must include 场景背景 tab");
  assert.ok(html.includes('id="room-switcher-pill" class="room-switcher-pill" type="button" hidden'), "top room-switcher-pill must be hidden to avoid topbar overlap");
  assert.equal(html.includes('id="tab-wardrobe-bgs"'), false, "duplicate wardrobe background tab must be removed");

  // 3. Every room in ROOMS_CATALOG must point to an existing PNG (no broken thumbnails)
  for (const room of P5Data.ROOMS_CATALOG) {
    const abs = path.join(REPO, room.bgFile);
    assert.ok(fs.existsSync(abs), `missing room thumbnail PNG: ${room.bgFile}`);
    assert.ok(room.bgFile.endsWith(".png"), `room thumbnail must be PNG: ${room.bgFile}`);
  }

  // 4. Clock 25-min focus timer removed; legacy 唤回桌面 removed; dedicated tb_bg_3d.png exists
  assert.equal(html.includes('id="btn-clock-windup"'), false, "25m focus windup button must be removed");
  assert.equal(html.includes('id="clock-modal-focus-banner"'), false, "focus banner must be removed");
  assert.equal(html.includes('id="scene-clock-focus-ring"'), false, "scene clock focus ring must be removed");
  assert.equal(html.includes('id="tb-btn-desk-toggle"'), false, "legacy 唤回桌面 button must be removed");
  assert.ok(html.includes('./living-room-dress/ui/tb_bg_3d.png'), "toolbox 背景 button must use dedicated tb_bg_3d.png");
  assert.ok(fs.existsSync(path.join(REPO, "living-room-dress/ui/tb_bg_3d.png")), "tb_bg_3d.png must exist on disk");

  // 5. Partner profile modal minimalist cleanup (no footprints, no exp bar, no stat subtitles, no spine)
  assert.equal(html.includes("profile-footprints"), false, "陪伴足迹 section must be removed from profile modal");
  assert.equal(html.includes("profile-bar-row--exp"), false, "亲密经验 bar must be removed from profile modal");
  assert.equal(html.includes('id="profile-star-hint"'), false, "star subtitle fluff must be removed");
  assert.equal(html.includes('id="profile-streak-days"'), false, "streak subtitle fluff must be removed");
  assert.equal(html.includes("profile-journal-card__spine"), false, "legacy notebook spine must be removed");

  // 6. Zero intimacy / Lv. / +5 EXP strings in user-facing UI (index.html & app.js)
  assert.equal(html.includes("亲密"), false, "index.html must not contain any 亲密 UI text");
  assert.equal(html.includes("+5 EXP"), false, "index.html must not contain +5 EXP text");
  assert.equal(appJs.includes("亲密"), false, "app.js must not contain any 亲密 UI text");
  assert.equal(appJs.includes("升到 Lv."), false, "app.js must not contain any 升到 Lv. toast");
  assert.equal(appJs.includes("+5 EXP"), false, "app.js must not contain +5 EXP text");
});


