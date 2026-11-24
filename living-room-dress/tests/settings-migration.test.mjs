import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..");
const Store = require(path.join(ROOT, "living-room-dress/cross-end-store.js"));
const SettingsPanel = require(path.join(ROOT, "living-room-dress/settings-panel.js"));

test("index.html mounts #tb-btn-settings, #settings-overlay, and loads settings-panel.js", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.match(html, /id="tb-btn-settings"/);
  assert.match(html, /<span>设置<\/span>/);
  assert.doesNotMatch(html, /id="tb-btn-sfx"/);
  assert.doesNotMatch(html, /id="tb-sfx-label"/);
  assert.match(html, /id="settings-overlay"/);
  assert.match(html, /src="\.\/living-room-dress\/settings-panel\.js"/);

  const settingsScriptIdx = html.indexOf('./living-room-dress/settings-panel.js');
  const appScriptIdx = html.indexOf('./living-room-dress/app.js');
  assert.ok(settingsScriptIdx > 0 && appScriptIdx > settingsScriptIdx, "settings-panel.js must load before app.js");
});

test("cross-end-store compliance helpers: age range, feedback receipts, email validation, chat cleanup, and legacy backfill", () => {
  assert.equal(Store.AGE_RANGES.length, 4);
  assert.deepEqual(
    Store.AGE_RANGES.map((x) => x.value),
    ["AGE_0_14", "AGE_15_35", "AGE_36_60", "AGE_61_PLUS"]
  );
  assert.equal(Store.FEEDBACK_TYPES.length, 9);

  const store = Store.createDefaultState({ now: Date.UTC(2026, 9, 1, 4, 0, 0) });
  assert.equal(store.settings.ageRange, "");
  assert.equal(Store.getAgeRangeLabel(store.settings.ageRange), "未设置");

  const badAge = Store.setAgeRange(store, "INVALID");
  assert.equal(badAge.ok, false);

  const okAge = Store.setAgeRange(store, "age_15_35", Date.UTC(2026, 9, 1, 4, 0, 0));
  assert.equal(okAge.ok, true);
  assert.equal(okAge.ageRange, "AGE_15_35");
  assert.equal(okAge.label, "15-35 周岁");
  assert.equal(store.settings.ageRange, "AGE_15_35");
  assert.ok(store.settings.ageRangeUpdatedAt);

  // Feedback validation & sequential receipts
  assert.equal(Store.submitUserFeedback(store, { type: "", description: "test", consent: true }).ok, false);
  assert.equal(Store.submitUserFeedback(store, { type: "OTHER", description: "  ", consent: true }).ok, false);
  assert.equal(Store.submitUserFeedback(store, { type: "OTHER", description: "反馈内容", consent: false }).ok, false);

  const fixedNow = Date.UTC(2026, 9, 1, 4, 0, 0); // 2026-10-01 UTC+8
  const fb1 = Store.submitUserFeedback(store, { type: "OTHER", description: "第一条建议", consent: true }, fixedNow);
  assert.equal(fb1.ok, true);
  assert.equal(fb1.receiptNumber, "H5-FB-20261001-001");

  const fb2 = Store.submitUserFeedback(store, { type: "PRIVACY", description: "第二条建议", consent: true }, fixedNow);
  assert.equal(fb2.ok, true);
  assert.equal(fb2.receiptNumber, "H5-FB-20261001-002");
  assert.equal(store.settings.feedbackReceipts.length, 2);

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

  // Backward-compatible backfill on legacy store missing new settings fields
  const legacyStore = { settings: { sfxOn: false } };
  Store.ensureModularAndClockDefaults(legacyStore);
  assert.equal(legacyStore.settings.sfxOn, false);
  assert.equal(legacyStore.settings.ageRange, "");
  assert.deepEqual(legacyStore.settings.feedbackReceipts, []);
  assert.deepEqual(legacyStore.settings.inviteCodes, []);
});

test("settings-panel exports all miniprogram views, contacts, FAQs, terms (17), and privacy (10)", () => {
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
});
