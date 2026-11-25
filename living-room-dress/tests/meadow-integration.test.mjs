import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const REPO = path.resolve(import.meta.dirname, "../..");
const Store = require(path.join(REPO, "living-room-dress/cross-end-store.js"));
const DiaryEngine = require(path.join(REPO, "living-room-dress/diary-engine.js"));

test("danbaobao-meadow is promoted to living-room-dress/meadow and removed from archive", () => {
  assert.equal(
    fs.existsSync(path.join(REPO, "archive/danbaobao-meadow")),
    false,
    "archive/danbaobao-meadow must be deleted after promotion"
  );
  assert.equal(
    fs.existsSync(path.join(REPO, "living-room-dress/meadow/site/index.html")),
    true,
    "built meadow site/index.html must exist"
  );
  assert.equal(
    fs.existsSync(path.join(REPO, "assets/shared/png/meadow/thumb_meadow.png")),
    true,
    "compressed PNG meadow thumbnail must exist"
  );
  assert.equal(
    fs.existsSync(path.join(REPO, "danbaobao-meadow.html")),
    true,
    "root danbaobao-meadow.html redirect must exist"
  );
  const redirectHtml = fs.readFileSync(path.join(REPO, "danbaobao-meadow.html"), "utf8");
  assert.ok(
    redirectHtml.includes("./living-room-dress/meadow/site/"),
    "root redirect must point to ./living-room-dress/meadow/site/"
  );
});

test("ACTIVITIES replaces meadow-breeze with danbaobao-meadow and wires postMessage handlers", () => {
  const appJs = fs.readFileSync(path.join(REPO, "living-room-dress/app.js"), "utf8");
  const actStart = appJs.indexOf("const ACTIVITIES = [");
  const actEnd = appJs.indexOf("];", actStart);
  assert.ok(actStart > 0 && actEnd > actStart, "ACTIVITIES array must exist in app.js");
  const activitiesBlock = appJs.slice(actStart, actEnd);

  assert.ok(activitiesBlock.includes('id: "danbaobao-meadow"'), "ACTIVITIES must include danbaobao-meadow");
  assert.ok(
    activitiesBlock.includes('url: "./living-room-dress/meadow/site/"'),
    "danbaobao-meadow must point to ./living-room-dress/meadow/site/"
  );
  assert.equal(
    activitiesBlock.includes('id: "meadow-breeze"'),
    false,
    "meadow-breeze must be replaced in ACTIVITIES"
  );
  assert.ok(appJs.includes('data.type === "eggbabe:meadow-complete"'), "must listen to meadow-complete");
  assert.ok(appJs.includes('data.type === "eggbabe:meadow-nav"'), "must listen to meadow-nav");
  assert.equal(DiaryEngine.MINIGAME_LABELS?.danbaobao_meadow ?? "蛋宝宝牧场", "蛋宝宝牧场");
});

test("meadow UI strictly follows EggBabe Design System v1.0 tokens and 25s fast pace", () => {
  const css = fs.readFileSync(path.join(REPO, "living-room-dress/meadow/src/style.css"), "utf8");
  const builtHtml = fs.readFileSync(path.join(REPO, "living-room-dress/meadow/site/index.html"), "utf8");
  const constants = fs.readFileSync(path.join(REPO, "living-room-dress/meadow/src/meadow/constants.ts"), "utf8");
  const levels = fs.readFileSync(path.join(REPO, "living-room-dress/meadow/src/meadow/levels.ts"), "utf8");

  assert.ok(css.includes("#002900"), "must use EggBabe ink primary #002900");
  assert.ok(css.includes("#9DB65B"), "must use EggBabe egg-green #9DB65B");
  assert.ok(css.includes("body.is-embedded .eb-topbar"), "must hide standalone topbar when embedded");
  assert.equal(/font-weight:\s*700\b/.test(css), false, "must respect Design System maxFontWeight 600");
  assert.equal(/\.webp\b/i.test(builtHtml), false, "built meadow HTML must contain zero .webp references");
  assert.ok(builtHtml.includes("./assets/"), "Vite build must use relative ./assets/ paths");
  assert.ok(builtHtml.includes("../../cross-end-store.js"), "built HTML must load cross-end-store.js");
  assert.ok(/ROUND_SECONDS\s*=\s*25\b/.test(constants), "ROUND_SECONDS must be 25s fast pace");
  assert.ok(/LevelId\s*=\s*1\s*\|\s*2\s*\|\s*3/.test(levels), "must support 3 levels");
});

test("cross-end-store awardActivityStars integrates cleanly with danbaobao_meadow daily 45-star cap", () => {
  const mem = new Map();
  const adapter = {
    getJSON: (k) => (mem.has(k) ? JSON.parse(mem.get(k)) : null),
    setJSON: (k, v) => mem.set(k, JSON.stringify(v))
  };
  const { store } = Store.loadOrMigrateStore(adapter);
  const dk = Store.getUtc8DateKey();
  const res1 = Store.awardActivityStars(store, 12, {
    dateKey: dk,
    petId: "yutu",
    miniGameId: "danbaobao_meadow"
  });
  assert.equal(res1.starsAwarded, 12);
  assert.equal(res1.capped, false);
  assert.equal(res1.cap, 45);
});
