/* ==========================================================================
   EggBabe 跨端统一状态底座 (eggbabe-cross-end-v1) — PRD-0003 Phase 1 P0
   - 离线优先 storageAdapter（兼容 localStorage / wx.setStorageSync，严禁写入 base64 DataURL）
   - migrateFromLegacyV4(v4, careV1, catalog) 老存档零丢失升级器
   - recordDailyEvent(store, dateKey, petId, payload) [dateKey][petId] 双层 14 天滚动日志
   - keepsakeAliasNormalizer 旧连字符 ID 自动升迁 + deferredUnlockedIds 无损兜底
   - 8 态柔和动态心情计算 (MOOD_TYPES + MOOD_DISPLAY_LABEL_OVERRIDES)
   - 4 档 profileMode 注入与微信原生胶囊安全区 CSS 变量计算器
   ========================================================================== */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.EggBabeStore = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : this), function () {
  "use strict";

  const SCHEMA_VERSION = "eggbabe-cross-end-v1";
  const STORAGE_KEY = "eggbabe_cross_end_v1";
  const LEGACY_V4_KEY = "eggbabe_living_room_mp_v4";
  const LEGACY_CARE_KEY = "eggbabe_care_v1";
  const MAX_DAILY_LOG_DAYS = 14;
  const MAX_POSTCARDS = 60;
  const TOTAL_KEEPSAKES_COUNT = 41;

  const PROFILE_MODES = Object.freeze([
    "h5",
    "wx-mp-enterprise",
    "wx-minigame",
    "wx-mp-ordinary"
  ]);

  const DEFAULT_PET_NAMES = Object.freeze({
    koi: "锦小鲤",
    yutu: "糯米团子"
  });

  const DEFAULT_SET_BY_PET = Object.freeze({
    koi: "set_duck",
    yutu: "set_cozy_knit"
  });

  /* ---------- 1. 8 态每日心情 + 治愈系柔和展示名映射 ---------- */
  const MOOD_DISPLAY_LABEL_OVERRIDES = Object.freeze({
    ANXIETY: "微虑",
    FRUSTRATION: "小闷",
    FATIGUE: "小困"
  });

  const MOOD_TYPES = Object.freeze({
    JOY: {
      key: "JOY",
      rawLabel: "愉快",
      label: "愉快",
      icon: "😊",
      text: "我想了想，觉得自己运气挺不错的。"
    },
    CALM: {
      key: "CALM",
      rawLabel: "平静",
      label: "平静",
      icon: "😌",
      text: "今天不想说太多话，就这样待着挺好。"
    },
    EXCITEMENT: {
      key: "EXCITEMENT",
      rawLabel: "兴奋",
      label: "兴奋",
      icon: "🤩",
      text: "我今天一刻都停不下来，坐下三秒又想起来。"
    },
    CURIOSITY: {
      key: "CURIOSITY",
      rawLabel: "好奇",
      label: "好奇",
      icon: "🤔",
      text: "我今天一直在想一件事，还没想明白。"
    },
    CARE: {
      key: "CARE",
      rawLabel: "关怀",
      label: "关怀",
      icon: "🤗",
      text: "我想安静陪一会儿，就在旁边不出声。"
    },
    ANXIETY: {
      key: "ANXIETY",
      rawLabel: "焦虑",
      label: MOOD_DISPLAY_LABEL_OVERRIDES.ANXIETY,
      icon: "😰",
      text: "心里像有片小云飘着，凑近一点就会散开吧。"
    },
    FRUSTRATION: {
      key: "FRUSTRATION",
      rawLabel: "沮丧",
      label: MOOD_DISPLAY_LABEL_OVERRIDES.FRUSTRATION,
      icon: "😞",
      text: "今天稍微有点闷闷的，想蹭一蹭暖暖的桌角。"
    },
    FATIGUE: {
      key: "FATIGUE",
      rawLabel: "疲惫",
      label: MOOD_DISPLAY_LABEL_OVERRIDES.FATIGUE,
      icon: "🥱",
      text: "晒着暖暖的太阳，眼皮有点打架啦。"
    }
  });

  const MOOD_KEYS = Object.freeze(Object.keys(MOOD_TYPES));

  function getMoodDisplay(moodKey) {
    const base = MOOD_TYPES[moodKey] || MOOD_TYPES.JOY;
    const softLabel = MOOD_DISPLAY_LABEL_OVERRIDES[base.key] || base.label;
    return Object.assign({}, base, { label: softLabel });
  }

  function stableHash(str) {
    let h = 2166136261;
    const s = String(str || "");
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function computeDailyMood(dateKey, petId, care) {
    const dk = dateKey || getUtc8DateKey();
    const pid = petId === "yutu" ? "yutu" : "koi";
    const hunger = care && typeof care.hunger === "number" ? care.hunger : 68;
    const hygiene = care && typeof care.hygiene === "number" ? care.hygiene : 72;

    if (hunger < 25 || hygiene < 25) {
      const isHungryWorse = hunger <= hygiene;
      const moodKey = isHungryWorse ? "FATIGUE" : "FRUSTRATION";
      const def = getMoodDisplay(moodKey);
      const careText = isHungryWorse
        ? "肚子咕噜咕噜响，眼皮也有点打架啦…"
        : "身上有点灰扑扑的，想洗个暖暖的泡泡澡…";
      return {
        dateKey: dk,
        moodKey: moodKey,
        overriddenByCare: true,
        label: def.label,
        icon: def.icon,
        text: careText
      };
    }

    const idx = stableHash(dk + ":" + pid) % MOOD_KEYS.length;
    const moodKey = MOOD_KEYS[idx];
    const def = getMoodDisplay(moodKey);
    return {
      dateKey: dk,
      moodKey: moodKey,
      overriddenByCare: false,
      label: def.label,
      icon: def.icon,
      text: def.text
    };
  }

  /* ---------- 2. Keepsake 别名归一器（PRD-0003 §600–608 & §7.3） ---------- */
  const KEEPSAKE_ALIAS_MAP = Object.freeze({
    "soft-button": "old_wooden_button",
    "short-pencil": "short_pencil",
    "dali-cloud": "dali_cloud_stone",
    "cafe-coaster": "cork_coaster",
    "wood-rattle": "small_wood_rattle",
    "ginkgo-leaf": "ginkgo_leaf",
    "window-leaf": "ginkgo_leaf",
    "copper-spoon": "retained_sugar_painting_ladle",
    "rain-seed": "rainforest_seed_pod",
    "delivery-clip": "red_order_clip",
    "rainbow-cloth": "rainbow_carwash_cloth"
  });

  const CANONICAL_TO_LEGACY_6 = Object.freeze({
    old_wooden_button: "soft-button",
    short_pencil: "short-pencil",
    dali_cloud_stone: "dali-cloud",
    cork_coaster: "cafe-coaster",
    small_wood_rattle: "wood-rattle",
    ginkgo_leaf: "ginkgo-leaf"
  });

  // 41 件标准已渲染纪念物 ID 集合（含现存 6 件 + 小程序 41 件标准池；兼容 P2 全量入库）
  const RENDERED_KEEPSAKE_IDS = new Set([
    "old_wooden_button",
    "short_pencil",
    "dali_cloud_stone",
    "cork_coaster",
    "small_wood_rattle",
    "ginkgo_leaf",
    "retained_sugar_painting_ladle",
    "rainforest_seed_pod",
    "red_order_clip",
    "rainbow_carwash_cloth",
    "jade_rabbit_helmet",
    "dried_tea_tag",
    "k_r01_yellow_rubber_duck"
  ]);

  // 暂未渲染的旧叙事 ID（无损暂存至 curioCabinet.deferredUnlockedIds）
  const KNOWN_DEFERRED_KEEPSAKE_IDS = new Set([
    "sun-speck",
    "paper-token",
    "bread-ticket",
    "cloud-note",
    "word-book"
  ]);

  function keepsakeAliasNormalizer(rawIds, extraRenderedIds) {
    const renderedSet = new Set(RENDERED_KEEPSAKE_IDS);
    if (extraRenderedIds) {
      for (const id of extraRenderedIds) {
        if (typeof id === "string" && id.trim()) renderedSet.add(id.trim());
      }
    }

    const unlockedIds = [];
    const deferredUnlockedIds = [];
    const seenUnlocked = new Set();
    const seenDeferred = new Set();

    const list = Array.isArray(rawIds) ? rawIds : [];
    for (let i = 0; i < list.length; i++) {
      const raw = typeof list[i] === "string" ? list[i].trim() : "";
      if (!raw) continue;

      const mapped = KEEPSAKE_ALIAS_MAP[raw] || raw;
      if (KNOWN_DEFERRED_KEEPSAKE_IDS.has(raw) || KNOWN_DEFERRED_KEEPSAKE_IDS.has(mapped)) {
        if (!seenDeferred.has(raw)) {
          seenDeferred.add(raw);
          deferredUnlockedIds.push(raw);
        }
        continue;
      }

      if (renderedSet.has(mapped) || KEEPSAKE_ALIAS_MAP[raw]) {
        if (!seenUnlocked.has(mapped)) {
          seenUnlocked.add(mapped);
          unlockedIds.push(mapped);
        }
      } else {
        // 未知历史 ID 一律无损暂存，绝不静默丢弃
        if (!seenDeferred.has(raw)) {
          seenDeferred.add(raw);
          deferredUnlockedIds.push(raw);
        }
      }
    }

    return { unlockedIds, deferredUnlockedIds };
  }

  function toLegacyKeepsakeId(canonicalOrLegacyId) {
    if (!canonicalOrLegacyId) return "";
    return CANONICAL_TO_LEGACY_6[canonicalOrLegacyId] || canonicalOrLegacyId;
  }

  /* ---------- 3. 时间、等级与输入安全校验 ---------- */
  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function getUtc8DateKey(ts) {
    const ms = typeof ts === "number" && isFinite(ts) ? ts : Date.now();
    return new Date(ms + 8 * 3600000).toISOString().slice(0, 10);
  }

  function getUtc8IsoString(ts) {
    const ms = typeof ts === "number" && isFinite(ts) ? ts : Date.now();
    return new Date(ms + 8 * 3600000).toISOString().replace("Z", "+08:00");
  }

  function diffDateKeys(prevDateKey, nextDateKey) {
    if (!prevDateKey || !nextDateKey) return 0;
    const a = Date.parse(prevDateKey + "T00:00:00Z");
    const b = Date.parse(nextDateKey + "T00:00:00Z");
    if (!isFinite(a) || !isFinite(b)) return 0;
    return Math.round((b - a) / 86400000);
  }

  function expForNextLevel(lv) {
    return 60 + (Math.max(1, Math.floor(Number(lv) || 1)) - 1) * 35;
  }

  function isSafeDisplayText(str) {
    if (typeof str !== "string") return false;
    const trimmed = str.trim();
    if (!trimmed) return false;
    if (/[<>]/.test(trimmed)) return false;
    if (/[\u0000-\u001F\u007F]/.test(trimmed)) return false;
    return true;
  }

  function validateNickname(raw, maxLen) {
    const limit = maxLen || 10;
    const trimmed = String(raw || "").trim();
    if (!trimmed) return { ok: false, error: "名字不能为空哦" };
    const chars = Array.from(trimmed);
    if (chars.length > limit) return { ok: false, error: `名字最多 ${limit} 个字哦` };
    if (!isSafeDisplayText(trimmed)) return { ok: false, error: "名字包含不支持的字符" };
    return { ok: true, value: trimmed };
  }

  function validateUserBio(raw, maxLen) {
    const limit = maxLen || 30;
    const trimmed = String(raw || "").trim();
    if (!trimmed) return { ok: true, value: "" };
    const chars = Array.from(trimmed);
    if (chars.length > limit) return { ok: false, error: `简介最多 ${limit} 个字哦` };
    if (!isSafeDisplayText(trimmed)) return { ok: false, error: "简介包含不支持的字符" };
    return { ok: true, value: trimmed };
  }

  function generatePublicId(seed) {
    if (seed) {
      const num = (stableHash(seed) % 900000) + 100000;
      return "EB-" + String(num);
    }
    const num = Math.floor(100000 + Math.random() * 900000);
    return "EB-" + String(num);
  }

  /* ---------- 4. 4 档 profileMode 与微信胶囊安全区 CSS 变量 ---------- */
  function normalizeProfileMode(mode) {
    return PROFILE_MODES.indexOf(mode) >= 0 ? mode : "h5";
  }

  function detectProfileMode(searchStr) {
    try {
      const qs = typeof searchStr === "string"
        ? searchStr
        : (typeof window !== "undefined" && window.location ? window.location.search : "");
      if (qs) {
        const params = new URLSearchParams(qs);
        const override = params.get("profileMode");
        if (override && PROFILE_MODES.indexOf(override) >= 0) {
          return override;
        }
      }
    } catch (e) {}

    if (typeof globalThis !== "undefined" && globalThis.__EGGBABE_PROFILE_MODE__) {
      return normalizeProfileMode(globalThis.__EGGBABE_PROFILE_MODE__);
    }

    if (typeof wx !== "undefined" && wx) {
      if (typeof wx.createCanvas === "function" && typeof document === "undefined") {
        return "wx-minigame";
      }
      return "wx-mp-enterprise";
    }
    return "h5";
  }

  function computeCapsuleSafeArea(opts) {
    const options = opts || {};
    let top = 12;
    let bottom = 0;
    let rightPad = 12;
    let hasCapsule = false;

    try {
      const qs = typeof options.search === "string"
        ? options.search
        : (typeof window !== "undefined" && window.location ? window.location.search : "");
      if (qs && new URLSearchParams(qs).get("wxCapsule") === "1") {
        return { top: 48, bottom: 80, rightPad: 104, hasCapsule: true };
      }
    } catch (e) {}

    const wxRef = options.wx || (typeof wx !== "undefined" ? wx : null);
    if (wxRef && typeof wxRef.getMenuButtonBoundingClientRect === "function") {
      try {
        const win = typeof wxRef.getWindowInfo === "function"
          ? wxRef.getWindowInfo()
          : (typeof wxRef.getSystemInfoSync === "function" ? wxRef.getSystemInfoSync() : {});
        const menu = wxRef.getMenuButtonBoundingClientRect();
        if (menu && typeof menu.top === "number" && menu.top > 0) {
          const statusBar = Number(win && win.statusBarHeight) || 20;
          const winW = Number(win && win.windowWidth) || 375;
          top = Math.max(menu.top, statusBar);
          bottom = menu.bottom || (menu.top + (menu.height || 32));
          rightPad = Math.max(96, Math.round(winW - menu.left + 10));
          hasCapsule = true;
        }
      } catch (e) {
        top = 44;
        bottom = 76;
        rightPad = 104;
        hasCapsule = true;
      }
    }

    return { top, bottom, rightPad, hasCapsule };
  }

  function injectCapsuleSafeAreaVars(rootEl, opts) {
    const metrics = computeCapsuleSafeArea(opts);
    const target = rootEl || (typeof document !== "undefined" ? document.documentElement : null);
    if (target && target.style) {
      target.style.setProperty("--wx-capsule-top", metrics.top + "px");
      target.style.setProperty("--wx-capsule-bottom", metrics.bottom + "px");
      target.style.setProperty("--wx-capsule-right-pad", metrics.rightPad + "px");
    }
    return metrics;
  }

  /* ---------- 5. Base64 DataURL 净水卫士与跨端 storageAdapter ---------- */
  const BASE64_DATA_URL_RE = /^data:image\/[a-z0-9.+-]+;base64,/i;

  function stripBase64FromMediaRecord(rec) {
    if (!rec || typeof rec !== "object") return rec;
    const out = {};
    const keys = Object.keys(rec);
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      const val = rec[k];
      if (typeof val === "string" && BASE64_DATA_URL_RE.test(val)) {
        continue; // 严禁持久化 base64 像素串
      }
      out[k] = val;
    }
    return out;
  }

  function sanitizeStoreForPersistence(store) {
    if (!store || typeof store !== "object") return store;
    const cloned = JSON.parse(JSON.stringify(store));
    if (Array.isArray(cloned.postcards)) {
      cloned.postcards = cloned.postcards.slice(0, MAX_POSTCARDS).map(stripBase64FromMediaRecord);
    }
    if (Array.isArray(cloned.diaries)) {
      cloned.diaries = cloned.diaries.map(stripBase64FromMediaRecord);
    }
    if (Array.isArray(cloned.lookbookPhotos)) {
      cloned.lookbookPhotos = cloned.lookbookPhotos.map(stripBase64FromMediaRecord);
    }
    if (cloned.user && typeof cloned.user.avatarUrl === "string" && BASE64_DATA_URL_RE.test(cloned.user.avatarUrl)) {
      cloned.user.avatarUrl = "";
    }
    return cloned;
  }

  function createStorageAdapter(options) {
    const opts = options || {};
    const onQuotaError = typeof opts.onQuotaError === "function" ? opts.onQuotaError : null;
    const memoryFallback = new Map();

    function hasWxStorage() {
      return typeof wx !== "undefined" && wx && typeof wx.getStorageSync === "function" && typeof wx.setStorageSync === "function";
    }

    function hasLocalStorage() {
      try {
        return typeof window !== "undefined" && !!window.localStorage;
      } catch (e) {
        return false;
      }
    }

    return {
      getRaw(key) {
        try {
          if (opts.backend && typeof opts.backend.getItem === "function") {
            return opts.backend.getItem(key);
          }
          if (hasWxStorage()) {
            const v = wx.getStorageSync(key);
            return v === "" || v === undefined || v === null ? null : (typeof v === "string" ? v : JSON.stringify(v));
          }
          if (hasLocalStorage()) {
            return window.localStorage.getItem(key);
          }
          return memoryFallback.has(key) ? memoryFallback.get(key) : null;
        } catch (e) {
          return null;
        }
      },
      setRaw(key, value) {
        const str = typeof value === "string" ? value : JSON.stringify(value);
        try {
          if (opts.backend && typeof opts.backend.setItem === "function") {
            opts.backend.setItem(key, str);
            return true;
          }
          if (hasWxStorage()) {
            wx.setStorageSync(key, str);
            return true;
          }
          if (hasLocalStorage()) {
            window.localStorage.setItem(key, str);
            return true;
          }
          memoryFallback.set(key, str);
          return true;
        } catch (err) {
          if (onQuotaError) onQuotaError(err);
          return false;
        }
      },
      getJSON(key) {
        const raw = this.getRaw(key);
        if (!raw) return null;
        try {
          return JSON.parse(raw);
        } catch (e) {
          return null;
        }
      },
      setJSON(key, obj) {
        const clean = key === STORAGE_KEY ? sanitizeStoreForPersistence(obj) : obj;
        return this.setRaw(key, JSON.stringify(clean));
      }
    };
  }

  /* ---------- 6. 默认 Schema 与老存档零丢失迁移器 ---------- */
  function validateSetId(petId, setId, catalog) {
    const fallback = DEFAULT_SET_BY_PET[petId] || "set_duck";
    if (!setId || typeof setId !== "string") return fallback;
    if (catalog && catalog.pets && catalog.pets[petId] && Array.isArray(catalog.pets[petId].items)) {
      const exists = catalog.pets[petId].items.some((item) => item && item.id === setId);
      return exists ? setId : fallback;
    }
    return setId;
  }

  function buildShelfSlots(unlockedIds, existingSlots) {
    const slots = Array.isArray(existingSlots) && existingSlots.length === 12
      ? existingSlots.slice(0, 12)
      : new Array(12).fill(null);
    const placed = new Set(slots.filter(Boolean));
    for (let i = 0; i < unlockedIds.length; i++) {
      const id = unlockedIds[i];
      if (placed.has(id)) continue;
      const emptyIdx = slots.indexOf(null);
      if (emptyIdx < 0) break;
      slots[emptyIdx] = id;
      placed.add(id);
    }
    return slots;
  }

  function createDefaultState(opts) {
    const options = opts || {};
    const now = typeof options.now === "number" ? options.now : Date.now();
    const todayKey = getUtc8DateKey(now);
    const profileMode = normalizeProfileMode(options.profileMode || detectProfileMode());
    const koiCare = { hunger: 68, hygiene: 72, exp: 15, level: 1, updatedAt: now };
    const yutuCare = { hunger: 68, hygiene: 72, exp: 15, level: 1, updatedAt: now };
    const koiMood = computeDailyMood(todayKey, "koi", koiCare);
    const yutuMood = computeDailyMood(todayKey, "yutu", yutuCare);

    return {
      schemaVersion: SCHEMA_VERSION,
      profileMode: profileMode,
      settings: {
        sfxOn: true,
        stageBgId: "living_room",
        clockMode: "analog"
      },
      user: {
        id: "usr_eb_01",
        publicId: generatePublicId(options.publicIdSeed),
        nickname: "蛋宝好友",
        avatarUrl: "",
        bio: "每天陪小家伙晒会儿太阳",
        authProvider: profileMode,
        maskedPhone: "",
        phoneBoundAt: null
      },
      activePetId: "koi",
      pets: {
        koi: {
          prototype: "KOI",
          name: DEFAULT_PET_NAMES.koi,
          equippedSetId: DEFAULT_SET_BY_PET.koi,
          care: koiCare,
          dailyMood: {
            dateKey: koiMood.dateKey,
            moodKey: koiMood.moodKey,
            overriddenByCare: koiMood.overriddenByCare
          }
        },
        yutu: {
          prototype: "YT",
          name: DEFAULT_PET_NAMES.yutu,
          equippedSetId: DEFAULT_SET_BY_PET.yutu,
          care: yutuCare,
          dailyMood: {
            dateKey: yutuMood.dateKey,
            moodKey: yutuMood.moodKey,
            overriddenByCare: yutuMood.overriddenByCare
          }
        }
      },
      companion: {
        firstMetAt: todayKey,
        companionDays: 1,
        totalCompanionDays: 1,
        lastEffectiveDate: todayKey,
        starBalance: 128,
        dailyLetterClaimedDate: null,
        actedSlotKeys: []
      },
      clockWidget: {
        anchorSlot: "headboard_lamp_left",
        skinId: "black_cat_sheriff_v1",
        unlockedSkinIds: ["black_cat_sheriff_v1"],
        tickWhiteNoiseOn: false,
        shiftId: "auto",
        focusSession: {
          active: false,
          durationMin: 25,
          startedAt: null,
          todayRewardCount: 0,
          lastRewardDate: null
        },
        gentleRoutines: [
          { id: "day_shift", time: "06:00", label: "白班哨：拉开窗帘晒太阳", enabled: true },
          { id: "sunset_shift", time: "17:00", label: "黄昏哨：泡杯热茶歇一歇", enabled: true },
          { id: "night_lamp", time: "23:00", label: "夜巡哨：陪它关台灯休息", enabled: true }
        ]
      },
      dailyEventLog: {},
      diaries: [],
      postcards: [],
      lookbookPhotos: [],
      curioCabinet: {
        unlockedIds: ["short_pencil"],
        deferredUnlockedIds: [],
        unlockedMeta: {
          short_pencil: { unlockedAt: getUtc8IsoString(now), source: "starter", isNew: false }
        },
        shelfSlots: buildShelfSlots(["short_pencil"])
      },
      house: {
        activeRoomId: "living_room",
        unlockedRoomIds: ["living_room"],
        unlockedDecorIds: [
          "bed_star_blue",
          "lamp_oak_warm",
          "books_oak_shelf_v1",
          "jewelry_box_oak",
          "wall_art_botanical",
          "rug_cork_default"
        ],
        craftedSnacks: {},
        mailboxUnreadIds: [],
        roomModules: {
          living_room: {
            mod_bed: { styleId: "bed_star_blue", state: "tidy" },
            mod_lamp: { styleId: "lamp_oak_warm", state: "auto_period" },
            mod_books: { styleId: "books_oak_shelf_v1", state: "normal" },
            mod_jewelry_box: { styleId: "jewelry_box_oak", state: "closed" },
            mod_wall_art: { styleId: "wall_art_botanical", state: "normal" },
            mod_desk_set: { styleId: "rug_cork_default", state: "steaming" },
            freePlacements: []
          }
        }
      }
    };
  }

  function applyOfflineCareDecay(rawCare, now) {
    const ts = typeof now === "number" ? now : Date.now();
    if (!rawCare || typeof rawCare !== "object") {
      return { hunger: 68, hygiene: 72, exp: 15, level: 1, updatedAt: ts };
    }
    const prevAt = Number(rawCare.updatedAt || ts);
    const hrs = Math.max(0, (ts - prevAt) / 3600000);
    return {
      hunger: clamp(Number(rawCare.hunger != null ? rawCare.hunger : 68) - hrs * 5, 0, 100),
      hygiene: clamp(Number(rawCare.hygiene != null ? rawCare.hygiene : 72) - hrs * 4, 0, 100),
      exp: Math.max(0, Number(rawCare.exp != null ? rawCare.exp : 0)),
      level: Math.max(1, Math.floor(Number(rawCare.level != null ? rawCare.level : 1))),
      updatedAt: ts
    };
  }

  function normalizePostcardItem(pc, idx, now) {
    if (!pc || typeof pc !== "object") return null;
    const clean = stripBase64FromMediaRecord(pc);
    const petId = clean.petId === "yutu" ? "yutu" : "koi";
    const outfitId = clean.outfitId || clean.setId || DEFAULT_SET_BY_PET[petId];
    const sceneId = typeof clean.sceneId === "string" && clean.sceneId ? clean.sceneId : "living_room";
    const createdAt = clean.createdAt || getUtc8IsoString(now);
    return {
      id: clean.id || ("pc_" + getUtc8DateKey(now).replace(/-/g, "") + "_" + String(idx + 1).padStart(2, "0")),
      petId: petId,
      outfitId: outfitId,
      setId: outfitId,
      sceneId: sceneId,
      text: typeof clean.text === "string" ? clean.text : "",
      dateText: typeof clean.dateText === "string" ? clean.dateText : "",
      createdAt: createdAt
    };
  }

  function migrateFromLegacyV4(v4, careV1, catalog, opts) {
    const options = opts || {};
    const now = typeof options.now === "number" ? options.now : Date.now();
    const todayKey = getUtc8DateKey(now);
    const next = createDefaultState(options);

    const legacy = v4 && typeof v4 === "object" ? v4 : null;
    const care = careV1 && typeof careV1 === "object" ? careV1 : null;

    if (legacy) {
      if (legacy.petId === "koi" || legacy.petId === "yutu") {
        next.activePetId = legacy.petId;
      }
      if (typeof legacy.stars === "number" && isFinite(legacy.stars)) {
        next.companion.starBalance = Math.max(0, Math.floor(legacy.stars));
      }
      if (typeof legacy.sfxOn === "boolean") {
        next.settings.sfxOn = legacy.sfxOn;
      }
      if (typeof legacy.stageBgId === "string" && legacy.stageBgId) {
        next.settings.stageBgId = legacy.stageBgId;
      }
      if (legacy.clockMode === "analog" || legacy.clockMode === "digital") {
        next.settings.clockMode = legacy.clockMode;
      }
      if (legacy.unreadMail === false) {
        next.companion.dailyLetterClaimedDate = todayKey;
      }
      if (typeof legacy.companionDays === "number" && legacy.companionDays >= 1) {
        next.companion.companionDays = Math.floor(legacy.companionDays);
        next.companion.totalCompanionDays = Math.max(next.companion.totalCompanionDays, Math.floor(legacy.companionDays));
      }
      if (legacy.savedSet && typeof legacy.savedSet === "object") {
        next.pets.koi.equippedSetId = validateSetId("koi", legacy.savedSet.koi, catalog);
        next.pets.yutu.equippedSetId = validateSetId("yutu", legacy.savedSet.yutu, catalog);
      }
      if (Array.isArray(legacy.keepsakes)) {
        const extraIds = catalog && Array.isArray(catalog.keepsakes)
          ? catalog.keepsakes.map((k) => k && k.id).filter(Boolean)
          : null;
        const normalized = keepsakeAliasNormalizer(legacy.keepsakes, extraIds);
        next.curioCabinet.unlockedIds = normalized.unlockedIds;
        next.curioCabinet.deferredUnlockedIds = normalized.deferredUnlockedIds;
        next.curioCabinet.unlockedMeta = {};
        normalized.unlockedIds.forEach((id) => {
          next.curioCabinet.unlockedMeta[id] = {
            unlockedAt: getUtc8IsoString(now),
            source: "migrated_v4",
            isNew: false
          };
        });
        next.curioCabinet.shelfSlots = buildShelfSlots(normalized.unlockedIds);
      }
      if (Array.isArray(legacy.postcards)) {
        next.postcards = legacy.postcards
          .slice(0, MAX_POSTCARDS)
          .map((pc, idx) => normalizePostcardItem(pc, idx, now))
          .filter(Boolean);
      }
    }

    if (care) {
      ["koi", "yutu"].forEach((pid) => {
        if (care[pid]) {
          next.pets[pid].care = applyOfflineCareDecay(care[pid], now);
        }
      });
    }

    ["koi", "yutu"].forEach((pid) => {
      const m = computeDailyMood(todayKey, pid, next.pets[pid].care);
      next.pets[pid].dailyMood = {
        dateKey: m.dateKey,
        moodKey: m.moodKey,
        overriddenByCare: m.overriddenByCare
      };
    });

    return next;
  }

  /* ---------- 7. 陪伴天数结算与双层 dailyEventLog 总线 ---------- */
  function recordEffectiveCompanionDay(store, dateKey) {
    if (!store || !store.companion) return false;
    const dk = dateKey || getUtc8DateKey();
    const comp = store.companion;
    if (!comp.firstMetAt) comp.firstMetAt = dk;
    if (comp.lastEffectiveDate === dk) return false;

    const delta = diffDateKeys(comp.lastEffectiveDate, dk);
    comp.totalCompanionDays = Math.max(1, Number(comp.totalCompanionDays || 0) + 1);
    if (delta === 1) {
      comp.companionDays = Math.max(1, Number(comp.companionDays || 0) + 1);
    } else {
      // 断签仅重置连续值，累计总天数永不清零
      comp.companionDays = 1;
    }
    comp.lastEffectiveDate = dk;
    return true;
  }

  function createEmptyPetDayLog() {
    return {
      outfitsWorn: [],
      snacksFed: [],
      bathed: false,
      focusMinutes: 0,
      visitedStates: [],
      miniGamesPlayed: [],
      keepsakesFound: []
    };
  }

  function pruneDailyEventLog(logObj, maxDays) {
    if (!logObj || typeof logObj !== "object") return;
    const limit = maxDays || MAX_DAILY_LOG_DAYS;
    const keys = Object.keys(logObj).sort();
    while (keys.length > limit) {
      const oldest = keys.shift();
      delete logObj[oldest];
    }
  }

  function pushUnique(arr, val) {
    if (!val || typeof val !== "string") return;
    if (arr.indexOf(val) < 0) arr.push(val);
  }

  function recordDailyEvent(store, dateKey, petId, payload) {
    if (!store || typeof store !== "object") return null;
    const dk = dateKey || getUtc8DateKey();
    const pid = petId === "yutu" ? "yutu" : "koi";
    const data = payload && typeof payload === "object" ? payload : {};

    if (!store.dailyEventLog || typeof store.dailyEventLog !== "object") {
      store.dailyEventLog = {};
    }
    if (!store.dailyEventLog[dk] || typeof store.dailyEventLog[dk] !== "object") {
      store.dailyEventLog[dk] = {};
    }
    if (!store.dailyEventLog[dk][pid]) {
      store.dailyEventLog[dk][pid] = createEmptyPetDayLog();
    }

    const entry = store.dailyEventLog[dk][pid];
    if (data.outfitId) pushUnique(entry.outfitsWorn, data.outfitId);
    if (Array.isArray(data.outfitsWorn)) data.outfitsWorn.forEach((x) => pushUnique(entry.outfitsWorn, x));

    if (data.snackId && typeof data.snackId === "string") entry.snacksFed.push(data.snackId);
    if (Array.isArray(data.snacksFed)) {
      data.snacksFed.forEach((x) => { if (typeof x === "string" && x) entry.snacksFed.push(x); });
    }

    if (data.bathed === true) entry.bathed = true;

    if (typeof data.focusMinutes === "number" && data.focusMinutes > 0) {
      entry.focusMinutes = Math.round((entry.focusMinutes || 0) + data.focusMinutes);
    }

    if (data.visitedState) pushUnique(entry.visitedStates, data.visitedState);
    if (Array.isArray(data.visitedStates)) data.visitedStates.forEach((x) => pushUnique(entry.visitedStates, x));

    if (data.miniGame) pushUnique(entry.miniGamesPlayed, data.miniGame);
    if (Array.isArray(data.miniGamesPlayed)) data.miniGamesPlayed.forEach((x) => pushUnique(entry.miniGamesPlayed, x));

    if (data.keepsakeId) {
      const norm = keepsakeAliasNormalizer([data.keepsakeId]);
      const cid = norm.unlockedIds[0] || norm.deferredUnlockedIds[0] || data.keepsakeId;
      pushUnique(entry.keepsakesFound, cid);
    }
    if (Array.isArray(data.keepsakesFound)) {
      data.keepsakesFound.forEach((x) => pushUnique(entry.keepsakesFound, x));
    }

    pruneDailyEventLog(store.dailyEventLog, MAX_DAILY_LOG_DAYS);

    if (data.countsAsEffective !== false) {
      recordEffectiveCompanionDay(store, dk);
    }
    return entry;
  }

  function ensureModularAndClockDefaults(store, opts) {
    const def = createDefaultState(opts);
    if (!store.clockWidget || typeof store.clockWidget !== "object") {
      store.clockWidget = def.clockWidget;
    } else {
      const cw = store.clockWidget;
      if (!cw.anchorSlot) cw.anchorSlot = def.clockWidget.anchorSlot;
      if (!cw.skinId) cw.skinId = def.clockWidget.skinId;
      if (!Array.isArray(cw.unlockedSkinIds)) cw.unlockedSkinIds = def.clockWidget.unlockedSkinIds;
      if (typeof cw.tickWhiteNoiseOn !== "boolean") cw.tickWhiteNoiseOn = false;
      if (!cw.shiftId) cw.shiftId = "auto";
      if (!cw.focusSession || typeof cw.focusSession !== "object") {
        cw.focusSession = Object.assign({}, def.clockWidget.focusSession);
      } else {
        if (typeof cw.focusSession.active !== "boolean") cw.focusSession.active = false;
        if (cw.focusSession.durationMin !== 15 && cw.focusSession.durationMin !== 25) {
          cw.focusSession.durationMin = 25;
        }
        if (typeof cw.focusSession.todayRewardCount !== "number") cw.focusSession.todayRewardCount = 0;
        if (cw.focusSession.lastRewardDate === undefined) cw.focusSession.lastRewardDate = null;
      }
      if (!Array.isArray(cw.gentleRoutines) || cw.gentleRoutines.length === 0) {
        cw.gentleRoutines = def.clockWidget.gentleRoutines;
      }
    }

    if (!store.house || typeof store.house !== "object") {
      store.house = def.house;
    }
    if (!store.house.roomModules || typeof store.house.roomModules !== "object") {
      store.house.roomModules = def.house.roomModules;
    }
    if (!store.house.roomModules.living_room || typeof store.house.roomModules.living_room !== "object") {
      store.house.roomModules.living_room = def.house.roomModules.living_room;
    } else {
      const defMods = def.house.roomModules.living_room;
      const curMods = store.house.roomModules.living_room;
      Object.keys(defMods).forEach((k) => {
        if (!curMods[k]) curMods[k] = JSON.parse(JSON.stringify(defMods[k]));
      });
    }
    return store;
  }

  /**
   * 锁屏时间戳幂等补算（PRD-0003 §3.3）：
   * 基于 Date.now() - startedAt 判断 15m(+5✦) / 25m(+10✦) 专注发条是否已完成，
   * 每日计奖上限 3 次（按 UTC+8 日期重置），完成后写入 P0 recordDailyEvent()。
   */
  function settleFocusSession(store, nowTs) {
    if (!store || !store.clockWidget || !store.clockWidget.focusSession) {
      return { settled: false, starsAwarded: 0, capped: false, durationMin: 0 };
    }
    const now = typeof nowTs === "number" && isFinite(nowTs) ? nowTs : Date.now();
    const todayKey = getUtc8DateKey(now);
    const fs = store.clockWidget.focusSession;

    if (fs.lastRewardDate && fs.lastRewardDate !== todayKey) {
      fs.todayRewardCount = 0;
    }

    if (!fs.active || typeof fs.startedAt !== "number" || !isFinite(fs.startedAt)) {
      return { settled: false, starsAwarded: 0, capped: false, durationMin: fs.durationMin || 25 };
    }

    const durationMin = fs.durationMin === 15 ? 15 : 25;
    const elapsedMs = now - fs.startedAt;
    if (elapsedMs < durationMin * 60000) {
      return {
        settled: false,
        starsAwarded: 0,
        capped: false,
        durationMin: durationMin,
        progress: clamp(elapsedMs / (durationMin * 60000), 0, 1)
      };
    }

    // 已达标：幂等结算并清空 active
    fs.active = false;
    fs.startedAt = null;

    const currentCount = fs.lastRewardDate === todayKey ? Number(fs.todayRewardCount || 0) : 0;
    const capped = currentCount >= 3;
    const starsAwarded = capped ? 0 : (durationMin === 15 ? 5 : 10);

    if (!capped) {
      fs.todayRewardCount = currentCount + 1;
      fs.lastRewardDate = todayKey;
      if (store.companion) {
        store.companion.starBalance = Math.max(0, Math.floor(Number(store.companion.starBalance || 0)) + starsAwarded);
      }
    }

    const petId = store.activePetId === "yutu" ? "yutu" : "koi";
    recordDailyEvent(store, todayKey, petId, {
      focusMinutes: durationMin,
      countsAsEffective: true
    });

    return {
      settled: true,
      starsAwarded: starsAwarded,
      capped: capped,
      durationMin: durationMin,
      todayRewardCount: fs.todayRewardCount
    };
  }

  /* ---------- 8. 加载或自动升级 Store ---------- */
  function loadOrMigrateStore(adapter, catalog, opts) {
    const storeAdapter = adapter || createStorageAdapter();
    const options = opts || {};
    const now = typeof options.now === "number" ? options.now : Date.now();
    const todayKey = getUtc8DateKey(now);
    const detectedMode = normalizeProfileMode(options.profileMode || detectProfileMode(options.search));

    const existing = storeAdapter.getJSON(STORAGE_KEY);
    if (existing && existing.schemaVersion === SCHEMA_VERSION && existing.pets && existing.companion) {
      existing.profileMode = detectedMode;
      if (existing.user && !existing.user.authProvider) {
        existing.user.authProvider = detectedMode;
      }
      ["koi", "yutu"].forEach((pid) => {
        if (!existing.pets[pid]) {
          existing.pets[pid] = createDefaultState(options).pets[pid];
        } else {
          existing.pets[pid].care = applyOfflineCareDecay(existing.pets[pid].care, now);
          existing.pets[pid].equippedSetId = validateSetId(pid, existing.pets[pid].equippedSetId, catalog);
        }
        const m = computeDailyMood(todayKey, pid, existing.pets[pid].care);
        existing.pets[pid].dailyMood = {
          dateKey: m.dateKey,
          moodKey: m.moodKey,
          overriddenByCare: m.overriddenByCare
        };
      });
      if (!existing.curioCabinet) {
        existing.curioCabinet = createDefaultState(options).curioCabinet;
      }
      if (!Array.isArray(existing.curioCabinet.deferredUnlockedIds)) {
        existing.curioCabinet.deferredUnlockedIds = [];
      }
      ensureModularAndClockDefaults(existing, options);
      pruneDailyEventLog(existing.dailyEventLog, MAX_DAILY_LOG_DAYS);
      return { store: existing, migrated: false };
    }

    const legacyV4 = storeAdapter.getJSON(LEGACY_V4_KEY);
    const legacyCare = storeAdapter.getJSON(LEGACY_CARE_KEY);
    const store = migrateFromLegacyV4(legacyV4, legacyCare, catalog, Object.assign({}, options, { profileMode: detectedMode }));
    ensureModularAndClockDefaults(store, options);
    storeAdapter.setJSON(STORAGE_KEY, store);
    return { store, migrated: !!(legacyV4 || legacyCare) };
  }

  return {
    SCHEMA_VERSION,
    STORAGE_KEY,
    LEGACY_V4_KEY,
    LEGACY_CARE_KEY,
    MAX_DAILY_LOG_DAYS,
    TOTAL_KEEPSAKES_COUNT,
    PROFILE_MODES,
    DEFAULT_PET_NAMES,
    DEFAULT_SET_BY_PET,
    MOOD_TYPES,
    MOOD_DISPLAY_LABEL_OVERRIDES,
    KEEPSAKE_ALIAS_MAP,
    getMoodDisplay,
    computeDailyMood,
    keepsakeAliasNormalizer,
    toLegacyKeepsakeId,
    getUtc8DateKey,
    getUtc8IsoString,
    expForNextLevel,
    isSafeDisplayText,
    validateNickname,
    validateUserBio,
    generatePublicId,
    detectProfileMode,
    computeCapsuleSafeArea,
    injectCapsuleSafeAreaVars,
    sanitizeStoreForPersistence,
    createStorageAdapter,
    createDefaultState,
    migrateFromLegacyV4,
    recordEffectiveCompanionDay,
    recordDailyEvent,
    ensureModularAndClockDefaults,
    settleFocusSession,
    loadOrMigrateStore
  };
});
