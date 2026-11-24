import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const REPO = path.resolve(import.meta.dirname, "../..");
const Store = require(path.join(REPO, "living-room-dress/cross-end-store.js"));

test("floating #room-clock is removed and bedside Black Cat Sheriff clock + 5 modular layers are mounted", () => {
  const html = fs.readFileSync(path.join(REPO, "index.html"), "utf8");
  assert.equal(html.includes('id="room-clock"'), false, "legacy floating #room-clock must be removed");
  assert.ok(html.includes('id="bedside-cat-clock"'), "bedside Black Cat Sheriff clock must be mounted");
  assert.ok(html.includes('id="clock-modal-overlay"'), "Flip clock modal must exist");
  assert.ok(html.includes('id="mod-wall-art"'), "wall art module must exist");
  assert.ok(html.includes('id="mod-bed-base"'), "bed base module must exist");
  assert.ok(html.includes('id="mod-bed-blanket"'), "foreground blanket module must exist");
  assert.ok(html.includes('id="mod-lamp"'), "bedside lamp module must exist");
  assert.ok(html.includes('id="mod-books"'), "bookshelf module must exist");
  assert.ok(html.includes('id="mod-jewelry-box"'), "jewelry box module must exist");
  assert.ok(html.includes('id="mod-desk-set"'), "desk set module must exist");
});

test("all new room shell, module, and clock assets exist as compressed PNGs with zero .webp references", () => {
  const expectedPngs = [
    "living-room-dress/panoramas/room_shell_day.png",
    "living-room-dress/panoramas/room_shell_sunset.png",
    "living-room-dress/panoramas/room_shell_night.png",
    "living-room-dress/modules/mod_bed_base.png",
    "living-room-dress/modules/mod_blanket_tidy.png",
    "living-room-dress/modules/mod_blanket_rumpled.png",
    "living-room-dress/modules/mod_lamp_on.png",
    "living-room-dress/modules/mod_lamp_off.png",
    "living-room-dress/modules/mod_bookshelf.png",
    "living-room-dress/modules/mod_jewelry_closed.png",
    "living-room-dress/modules/mod_jewelry_peek.png",
    "living-room-dress/modules/mod_wall_art.png",
    "living-room-dress/modules/mod_desk_set.png",
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

  // Verify zero .webp references in index.html & living-room-dress active source files
  for (const rel of ["index.html", "living-room-dress/app.js", "living-room-dress/style.css", "living-room-dress/cross-end-store.js"]) {
    const src = fs.readFileSync(path.join(REPO, rel), "utf8");
    assert.equal(/\.webp\b/i.test(src), false, `${rel} must not reference .webp`);
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
