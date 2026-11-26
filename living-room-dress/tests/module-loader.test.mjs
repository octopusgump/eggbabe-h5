import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const REPO = path.resolve(import.meta.dirname, "../..");
const Loader = require(path.join(REPO, "living-room-dress/module-loader.js"));

test("Phase 1 & Phase 2 distributed loader keeps non-first-screen modules & CSS out of sync index.html and maps valid assets", () => {
  const html = fs.readFileSync(path.join(REPO, "index.html"), "utf8");
  assert.match(html, /living-room-dress\/module-loader\.js/);

  for (const name of Object.keys(Loader.FEATURES)) {
    const def = Loader.FEATURES[name];
    assert.ok(def, `missing feature definition: ${name}`);
    for (const rel of [...def.styles, ...def.scripts]) {
      const abs = path.join(REPO, rel.replace(/^\.\//, ""));
      assert.equal(fs.existsSync(abs), true, `feature asset missing on disk: ${rel}`);
      assert.equal(html.includes(rel), false, `non-first-screen asset must not load synchronously in index.html: ${rel}`);
    }
  }
  assert.ok(Loader.FEATURES.settings.styles.includes("./living-room-dress/settings-panel.css"));
  assert.ok(Loader.FEATURES.rooms.scripts.includes("./living-room-dress/native-minigames-ui.js"));
});

test("wall-polaroid never renders before decoded, hidden stage sprites use data-src, and global image guard marks states", () => {
  const html = fs.readFileSync(path.join(REPO, "index.html"), "utf8");
  const appJs = fs.readFileSync(path.join(REPO, "living-room-dress/app.js"), "utf8");
  const css = fs.readFileSync(path.join(REPO, "living-room-dress/style.css"), "utf8");

  assert.match(html, /<img id="wall-polaroid-img" alt="" \/>/);
  assert.match(html, /id="pet-sleep-sprite-img" data-src="/);
  assert.match(html, /id="folded-outfit-prop"[\s\S]*?data-src="/);
  assert.match(appJs, /wallPolaroidEl\.hidden = !inLivingRoom \|\| state\.postcards\.length === 0 \|\| !wallPolaroidReady;/);
  assert.match(appJs, /installGlobalImageGuard/);
  assert.match(css, /img\[data-eb-img="loading"\],\s*img\[data-eb-img="error"\]/);

  const mockLoadingImg = {
    tagName: "IMG",
    dataset: {},
    complete: false,
    naturalWidth: 0,
    getAttribute: (k) => (k === "src" ? "" : null)
  };
  Loader.hydrateImgState(mockLoadingImg);
  assert.equal(mockLoadingImg.dataset.ebImg, "loading");

  const mockReadyImg = {
    tagName: "IMG",
    dataset: {},
    complete: true,
    naturalWidth: 120,
    getAttribute: (k) => (k === "src" ? "./test.png" : null)
  };
  Loader.hydrateImgState(mockReadyImg);
  assert.equal(mockReadyImg.dataset.ebImg, "ready");
});

test("EggBabeLoader deduplicates concurrent script/style loads and clears cache on failure", async () => {
  Loader.resetCachesForTest();
  let appended = 0;
  const created = [];
  const fakeDoc = {
    head: { appendChild(el) { appended += 1; created.push(el); } },
    body: { appendChild(el) { appended += 1; created.push(el); } },
    querySelector: () => null,
    createElement: (tag) => ({ tagName: tag.toUpperCase(), dataset: {} })
  };

  const p1 = Loader.loadScript("./fake-chunk.js", fakeDoc);
  const p2 = Loader.loadScript("./fake-chunk.js", fakeDoc);
  assert.equal(p1, p2, "concurrent loadScript calls must share the same Promise");
  assert.equal(appended, 1, "must only inject one <script> tag");
  created[0].onload();
  await p1;

  // Failed load clears cache so subsequent retry can re-attempt
  const pFail = Loader.loadScript("./broken-chunk.js", fakeDoc);
  created[1].onerror();
  await assert.rejects(pFail);

  const pRetry = Loader.loadScript("./broken-chunk.js", fakeDoc);
  assert.equal(appended, 3, "retry after failure must inject a fresh <script> tag");
  created[2].onload();
  await pRetry;
  Loader.resetCachesForTest();
});
