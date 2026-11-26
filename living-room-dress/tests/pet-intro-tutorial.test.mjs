import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const Store = require(path.join(ROOT, "living-room-dress/cross-end-store.js"));

test("cross-end-store defaults settings.petIntroTutorialDone to false and preserves true once completed", () => {
  const mem = new Map();
  const adapter = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k)
  };
  const storage = Store.createStorageAdapter({ storage: adapter });

  const first = Store.loadOrMigrateStore(storage, { pets: {}, backgrounds: [] });
  assert.equal(first.store.settings.petIntroTutorialDone, false, "新存档首次进入应默认未完成引导");

  first.store.settings.petIntroTutorialDone = true;
  storage.setJSON(Store.STORAGE_KEY, first.store);

  const second = Store.loadOrMigrateStore(storage, { pets: {}, backgrounds: [] });
  assert.equal(second.store.settings.petIntroTutorialDone, true, "完成后再次载入应永久保持已完成（只展示一次）");
});

test("index.html, style.css, and app.js mount and wire the 3-step once-only pet intro tutorial (speak -> jump -> walk)", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const css = fs.readFileSync(path.join(ROOT, "living-room-dress/style.css"), "utf8");
  const appJs = fs.readFileSync(path.join(ROOT, "living-room-dress/app.js"), "utf8");

  for (const id of [
    "pet-tutorial-card",
    "pet-tutorial-dots",
    "pet-tutorial-step-badge",
    "pet-tutorial-title",
    "pet-tutorial-desc",
    "btn-tutorial-skip",
    "btn-tutorial-next",
    "pet-tutorial-beacon",
    "pet-tutorial-beacon-label"
  ]) {
    assert.ok(html.includes(`id="${id}"`), `index.html 应挂载 #${id}`);
  }

  assert.ok(css.includes(".pet-tutorial-beacon"), "style.css 应定义光圈指引样式");
  assert.ok(css.includes(".pet-tutorial-card"), "style.css 应定义底部浮动教程卡片样式");

  assert.ok(appJs.includes('PET_TUTORIAL_STORAGE_KEY = "eggbabe_pet_intro_tutorial_v1"'), "应具备 localStorage 兜底一次标记");
  assert.ok(appJs.includes('notifyPetTutorialAction("speak")'), "点击头部说话应推进第一步教程");
  assert.ok(appJs.includes('notifyPetTutorialAction("jump")'), "点击下半身跳跃应推进第二步教程");
  assert.ok(appJs.includes('notifyPetTutorialAction("walk")'), "点击桌面散步应推进第三步教程");
  assert.ok(appJs.includes("maybeStartPetIntroTutorial("), "boot() 应调度首次进入教程");
  assert.ok(appJs.includes('qs.get("tutorial") === "1"'), "应支持 ?tutorial=1 验收预览参数");
});
