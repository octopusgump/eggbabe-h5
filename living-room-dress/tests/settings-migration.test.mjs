import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..");
const Store = require(path.join(ROOT, "living-room-dress/cross-end-store.js"));
const SettingsPanel = require(path.join(ROOT, "living-room-dress/settings-panel.js"));

/* 轻量 Mock DOM，用于 Node 环境直接回归测试 createSettingsPanel 运行时交互 */
function createMockOverlay() {
  const listeners = new Map();
  let html = "";
  const children = {};

  function syncChildProxies() {
    children["#settings-inline-notice"] = {
      textContent: "",
      dataset: {},
      hidden: true
    };
    children["#settings-fb-desc"] = {
      value: "",
      addEventListener(ev, fn) { this["on_" + ev] = fn; }
    };
    children["#settings-fb-count"] = { textContent: "" };
    children['[data-action="submit-fb"]'] = {
      classList: { toggle() {} }
    };
    children["#settings-chat-email"] = {
      value: "",
      classList: { remove() {} },
      addEventListener(ev, fn) { this["on_" + ev] = fn; }
    };
    children["#settings-help-input"] = {
      value: "",
      focused: false,
      focus() { this.focused = true; },
      addEventListener(ev, fn) {
        this._events = this._events || {};
        this._events[ev] = fn;
      },
      trigger(ev, val) {
        if (val !== undefined) this.value = val;
        if (this._events && this._events[ev]) this._events[ev]();
      }
    };
    children["#settings-help-clear"] = { hidden: true };
    children[".settings-help-scroll"] = { innerHTML: "" };
    children[".settings-body"] = { scrollTop: 100 };
  }
  syncChildProxies();

  return {
    hidden: true,
    attrs: {},
    setAttribute(k, v) { this.attrs[k] = v; },
    get innerHTML() { return html; },
    set innerHTML(v) {
      html = String(v);
      syncChildProxies();
    },
    querySelector(sel) {
      return children[sel] || null;
    },
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
    },
    removeEventListener(type, fn) {
      if (listeners.has(type)) listeners.get(type).delete(fn);
    },
    listenerCount(type) {
      return listeners.has(type) ? listeners.get(type).size : 0;
    },
    click(attrs) {
      const target = {
        classList: { contains: (c) => (attrs.className || "").split(" ").includes(c) },
        getAttribute: (k) => (k in attrs ? attrs[k] : null),
        closest: () => target
      };
      const ev = { target };
      (listeners.get("click") || []).forEach((fn) => fn(ev));
    }
  };
}

test("index.html mounts #tb-btn-settings, #settings-overlay, and loads settings-panel.js", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.match(html, /id="tb-btn-settings"/);
  assert.match(html, /<span>设置<\/span>/);
  assert.doesNotMatch(html, /id="tb-btn-sfx"/);
  assert.doesNotMatch(html, /id="tb-sfx-label"/);
  assert.match(html, /id="settings-overlay"/);
  assert.match(html, /src="\.\/living-room-dress\/settings-panel\.js"/);

  const settingsScriptIdx = html.indexOf("./living-room-dress/settings-panel.js");
  const appScriptIdx = html.indexOf("./living-room-dress/app.js");
  assert.ok(settingsScriptIdx > 0 && appScriptIdx > settingsScriptIdx, "settings-panel.js must load before app.js");
});

test("cross-end-store compliance helpers: age range, feedback 20-cap & UTC+8 rollover, email, chat cleanup, and legacy persistence", () => {
  assert.equal(Store.AGE_RANGES.length, 4);
  assert.deepEqual(
    Store.AGE_RANGES.map((x) => x.value),
    ["AGE_0_14", "AGE_15_35", "AGE_36_60", "AGE_61_PLUS"]
  );
  assert.equal(Store.FEEDBACK_TYPES.length, 9);

  const store = Store.createDefaultState({ now: Date.UTC(2026, 9, 1, 4, 0, 0) });
  assert.equal(store.settings.ageRange, "");
  assert.equal(Store.getAgeRangeLabel(store.settings.ageRange), "未设置");

  assert.equal(Store.setAgeRange(store, "INVALID").ok, false);

  const okAge = Store.setAgeRange(store, "age_15_35", Date.UTC(2026, 9, 1, 4, 0, 0));
  assert.equal(okAge.ok, true);
  assert.equal(okAge.ageRange, "AGE_15_35");
  assert.equal(okAge.label, "15-35 周岁");
  assert.equal(store.settings.ageRange, "AGE_15_35");
  assert.ok(store.settings.ageRangeUpdatedAt);

  // Feedback validation
  assert.equal(Store.submitUserFeedback(store, { type: "", description: "test", consent: true }).ok, false);
  assert.equal(Store.submitUserFeedback(store, { type: "OTHER", description: "  ", consent: true }).ok, false);
  assert.equal(Store.submitUserFeedback(store, { type: "OTHER", description: "反馈内容", consent: false }).ok, false);

  // Sequential receipts + 20-item cap + UTC+8 midnight rollover back to 001
  const day1 = Date.UTC(2026, 9, 1, 15, 30, 0); // 2026-10-01 23:30 UTC+8
  for (let i = 1; i <= 22; i += 1) {
    const res = Store.submitUserFeedback(store, { type: "OTHER", description: "建议 " + i, consent: true }, day1);
    assert.equal(res.ok, true);
    assert.equal(res.receiptNumber, "H5-FB-20261001-" + String(i).padStart(3, "0"));
  }
  assert.equal(store.settings.feedbackReceipts.length, 20, "feedbackReceipts should be capped at 20");

  const day2 = Date.UTC(2026, 9, 1, 16, 5, 0); // 2026-10-02 00:05 UTC+8
  const nextDayFb = Store.submitUserFeedback(store, { type: "PRIVACY", description: "次日建议", consent: true }, day2);
  assert.equal(nextDayFb.ok, true);
  assert.equal(nextDayFb.receiptNumber, "H5-FB-20261002-001");

  // Email validation
  assert.equal(Store.validateEmail("user@example.com"), true);
  assert.equal(Store.validateEmail("  USER@eggbabe.com "), true);
  assert.equal(Store.validateEmail("not-an-email"), false);
  assert.equal(Store.validateEmail(""), false);

  // Clear local chat records
  store.listenHistory = [{ id: 1 }, { id: 2 }];
  store.chatMessages = [{ id: "m1" }];
  const cleared = Store.clearLocalChatRecords(store);
  assert.equal(cleared.ok, true);
  assert.equal(cleared.removedCount, 3);
  assert.equal(store.listenHistory.length, 0);
  assert.equal(store.chatMessages.length, 0);

  // Legacy v1 store missing new settings fields gets backfilled AND persisted by loadOrMigrateStore
  const mem = new Map();
  const oldV1 = Store.createDefaultState({ now: day1 });
  delete oldV1.settings.ageRange;
  delete oldV1.settings.ageRangeUpdatedAt;
  delete oldV1.settings.feedbackReceipts;
  delete oldV1.settings.feedbackCounter;
  delete oldV1.settings.inviteCodes;
  oldV1.settings.sfxOn = false;
  mem.set(Store.STORAGE_KEY, JSON.stringify(oldV1));

  let setCalls = 0;
  const mockAdapter = {
    getJSON(k) { return mem.has(k) ? JSON.parse(mem.get(k)) : null; },
    setJSON(k, v) { setCalls += 1; mem.set(k, JSON.stringify(v)); }
  };
  const loaded = Store.loadOrMigrateStore(mockAdapter, null, { now: day1 });
  assert.equal(loaded.store.settings.sfxOn, false);
  assert.equal(loaded.store.settings.ageRange, "");
  assert.deepEqual(loaded.store.settings.feedbackReceipts, []);
  assert.equal(setCalls, 1, "backfilled v1 store must be persisted once");
});

test("settings-panel exports all miniprogram views, contacts, FAQs, terms (17), privacy (10), and honors release-scope exclusions", () => {
  assert.deepEqual(Object.keys(SettingsPanel.VIEW_TITLES), [
    "home",
    "album",
    "invite-codes",
    "chat-records",
    "age-range",
    "feedback",
    "help",
    "terms",
    "privacy"
  ]);
  assert.equal(SettingsPanel.SUPPORT_EMAIL, "hello@eggbabe.com");
  assert.equal(SettingsPanel.HOTLINE, "18201931204");
  assert.deepEqual(SettingsPanel.REALITY_HELP, {
    psychologicalHotline: "12356",
    police: "110",
    medicalEmergency: "120"
  });
  assert.equal(SettingsPanel.FAQ_GROUPS.length, 4);
  const totalFaqs = SettingsPanel.FAQ_GROUPS.reduce((sum, g) => sum + g.items.length, 0);
  assert.equal(totalFaqs, 11);
  assert.equal(SettingsPanel.TERMS_SECTIONS.length, 17);
  assert.equal(SettingsPanel.PRIVACY_SECTIONS.length, 10);

  const src = fs.readFileSync(path.join(ROOT, "living-room-dress/settings-panel.js"), "utf8");
  for (const forbidden of ["注销账号", "退出登录", "清除本地数据", "节令上新", "破壳提醒", "我的卡册"]) {
    assert.equal(src.includes(forbidden), false, `settings-panel.js must not include removed item: ${forbidden}`);
  }
});

test("createSettingsPanel runtime: XSS escaping, consent modal rule, IME-safe case-insensitive help search, async abort safety, diaries export, and destroy()", async () => {
  const overlay = createMockOverlay();
  const store = Store.createDefaultState({ now: Date.UTC(2026, 9, 1, 4, 0, 0) });
  store.user.nickname = '<img src=x onerror="alert(1)">';
  store.diaries = [{ id: "d1", text: "今天晒了太阳" }];
  let sfxOn = false;
  let tickOn = false;
  let albumPet = "";
  let sceneFeedback = "";

  const panel = SettingsPanel.createSettingsPanel({
    overlayEl: overlay,
    storeApi: Store,
    getStore: () => store,
    persist: () => {},
    getSfxOn: () => sfxOn,
    setSfxOn: (v) => { sfxOn = v; },
    getTickNoiseOn: () => tickOn,
    setTickNoiseOn: (v) => { tickOn = v; },
    onOpenAlbum: (petId) => { albumPet = petId; },
    onShowSceneFeedback: (msg) => { sceneFeedback = msg; }
  });

  // 1. XSS escaping on home user card
  panel.open("home");
  assert.equal(panel.isOpen(), true);
  assert.equal(overlay.innerHTML.includes('<img src=x onerror="alert(1)">'), false);
  assert.equal(overlay.innerHTML.includes("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"), true);

  // 2. Tick white noise dependency notice when sfxOn is false
  overlay.click({ "data-action": "toggle-tick" });
  assert.equal(tickOn, true);
  assert.match(overlay.querySelector("#settings-inline-notice").textContent, /互动音效/);

  // 3. Album card passes data-pet to onOpenAlbum
  overlay.click({ "data-nav": "album" });
  assert.equal(panel.getCurrentView(), "album");
  overlay.click({ "data-action": "open-album-keepsakes", "data-pet": "yutu" });
  assert.equal(albumPet, "yutu");
  assert.equal(panel.isOpen(), false);

  // 4. Consent dialog view does NOT auto-check; agree button checks it
  panel.open("home");
  overlay.click({ "data-nav": "feedback" });
  overlay.click({ "data-action": "open-fb-consent" });
  assert.match(overlay.innerHTML, /知情同意书/);
  overlay.click({ "data-action": "close-fb-consent" });
  assert.doesNotMatch(overlay.innerHTML, /settings-checkbox is-checked/);
  overlay.click({ "data-action": "open-fb-consent" });
  overlay.click({ "data-action": "agree-fb-consent" });
  assert.match(overlay.innerHTML, /settings-checkbox is-checked/);

  // 5. Feedback mid-flight abort does NOT permanently lock form
  overlay.click({ "data-action": "pick-fb-type", "data-value": "OTHER" });
  const ta = overlay.querySelector("#settings-fb-desc");
  ta.value = "测试中途退出";
  ta.on_input();
  overlay.click({ "data-action": "submit-fb" });
  assert.match(overlay.innerHTML, />提交中</);
  panel.popView(); // abort within 600ms
  assert.equal(panel.getCurrentView(), "home");
  overlay.click({ "data-nav": "feedback" });
  assert.doesNotMatch(overlay.innerHTML, />提交中</, "re-entering feedback after abort must not stay locked");

  // 6. Help search: case-insensitive + does NOT rebuild #settings-help-input
  panel.popView();
  overlay.click({ "data-nav": "help" });
  const inputRef = overlay.querySelector("#settings-help-input");
  inputRef.trigger("input", "id");
  assert.equal(overlay.querySelector("#settings-help-input"), inputRef, "input node must not be recreated");
  assert.match(overlay.querySelector(".settings-help-scroll").innerHTML, /蛋宝宝 ID/);

  // 7. Chat records: email export abort + JSON export includes store.diaries
  panel.popView();
  overlay.click({ "data-nav": "chat-records" });
  const emailInput = overlay.querySelector("#settings-chat-email");
  emailInput.value = "test@example.com";
  emailInput.on_input();
  overlay.click({ "data-action": "export-chat-email" });
  panel.popView(); // abort within 450ms

  // Mock Blob/URL/document for JSON export check
  let exportedJson = null;
  const origBlob = globalThis.Blob;
  const origCreateObj = URL.createObjectURL;
  const origRevokeObj = URL.revokeObjectURL;
  const origDoc = globalThis.document;
  try {
    globalThis.Blob = class MockBlob {
      constructor(parts) { exportedJson = JSON.parse(parts[0]); }
    };
    URL.createObjectURL = () => "blob:mock";
    URL.revokeObjectURL = () => {};
    globalThis.document = {
      createElement: () => ({ click() {} }),
      body: { appendChild() {}, removeChild() {} }
    };
    overlay.click({ "data-nav": "chat-records" });
    overlay.click({ "data-action": "export-chat-json" });
    assert.ok(exportedJson && Array.isArray(exportedJson.diaries));
    assert.equal(exportedJson.diaries.length, 1);
    assert.equal(exportedJson.diaries[0].id, "d1");
  } finally {
    globalThis.Blob = origBlob;
    URL.createObjectURL = origCreateObj;
    URL.revokeObjectURL = origRevokeObj;
    globalThis.document = origDoc;
  }

  // 8. Direct open("age-range") closes cleanly after 900ms toast
  panel.open("age-range");
  overlay.click({ "data-action": "select-age", "data-value": "AGE_36_60" });
  overlay.click({ "data-action": "save-age" });
  assert.match(overlay.innerHTML, /settings-save-toast/);
  await new Promise((r) => setTimeout(r, 960));
  assert.equal(panel.isOpen(), false, "direct age-range save should close overlay after toast");
  assert.equal(sceneFeedback, "年龄区间已保存");

  // 9. destroy() removes click listener
  assert.equal(overlay.listenerCount("click"), 1);
  panel.destroy();
  assert.equal(overlay.listenerCount("click"), 0);
});
