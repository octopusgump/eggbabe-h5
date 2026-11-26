/* ==========================================================================
   蛋宝宝 · 破壳起居室 × eggbabe-h5 全量锦鲤/玉兔换装/背景/喂食/洗澡（1:1 小程序同源 UI 版）
   - 内嵌 catalog-snapshot.js 零网络阻塞 + 同域/github.io CDN 双模资源解析
   - 完整移植 eggbabe-uni PetStage (laugh/sad/think/cute 四情绪剧场 + eat/scrub/rinse/doze)
   - 右侧 3D 百宝箱风格「喂食 / 洗澡 / 装扮」胶囊栏 + 全量 36 套服装 & 12 套背景免锁即穿
   ========================================================================== */
(function () {
  "use strict";

  const PANO_W = 2823;
  const PANO_H = 1672;
  const GL_LOGICAL_W = 1352;
  const GL_LOGICAL_H = 800;
  const COZY_SCENE_CONFIG = {
    id: "cozy_living_room_v1",
    panoramas: {
      day: "./living-room-dress/panoramas/cozy_room_day.png",
      night: "./living-room-dress/panoramas/cozy_room_night.png",
      nightLit: "./living-room-dress/panoramas/cozy_room_night_lit.png"
    },
    sleepSprites: {
      yutu: "./living-room-dress/modules/yutu_bed_sleep.png",
      koi: "./living-room-dress/modules/koi_bed_sleep.png"
    },
    sleepBoxes: {
      yutu: [92, 443, 1161, 1012],
      koi: [75, 485, 1173, 1066]
    },
    sillProps: {
      sunny: "./living-room-dress/props/sill_sunny_plant.png",
      night: "./living-room-dress/props/sill_night_jar.png"
    },
    anchors: {
      corkHome: { x: 1520, y: 1205 },
      bedCenter: { x: 580, y: 980 }
    },
    slots: {
      lampGlow: [695, 345, 620, 520],
      catClock: [432, 468, 174, 180],
      catClockHit: [432, 468, 196, 200],
      wallPolaroid: [1160, 215, 148, 175],
      mailBubble: [1135, 385],
      awayNote: [1520, 1090],
      sillProp: [1730, 586, 148, 148]
    },
    hotspots: {
      lamp: [595, 195, 200, 300],
      bookshelf: [920, 415, 430, 505],
      deskMirror: [1815, 685, 390, 440],
      sleepPet: [250, 620, 760, 740]
    }
  };
  const CORK_HOME = COZY_SCENE_CONFIG.anchors.corkHome;
  const COLS = 30, ROWS = 56, NV = (COLS + 1) * (ROWS + 1);
  const ACC_COLS = 12, ACC_ROWS = 12;
  const PAGES_CDN = "https://octopusgump.github.io/eggbabe-h5";
  const REDUCED_MOTION = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const DiaryEngine = window.EggBabeDiaryEngine;
  const P5Data = window.EggBabeP5Data;
  const Voice = window.EggBabeVoice;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const sstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const easeInOut = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const easeOutBack = (t) => { const c = 1.6; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  function rot2d(x, y, px, py, deg) {
    const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a), dx = x - px, dy = y - py;
    return [px + dx * c - dy * s, py + dx * s + dy * c];
  }

  // 双模高可用资源解析：本地或正式 /living-room-dress/ 走相对路径 ../assets/，独立预览沙箱自动走线上 github.io CDN
  function sharedUrl(relPath) {
    if (!relPath) return "";
    if (/^(https?:|data:|blob:)/i.test(relPath)) return relPath;
    const clean = String(relPath).replace(/^(\.\.\/|\/)+/, "");
    const proto = window.location.protocol;
    if (proto === "http:" || proto === "https:") {
      return window.location.pathname.indexOf("/living-room-dress/") >= 0 ? "../" + clean : "./" + clean;
    }
    return PAGES_CDN + "/" + clean;
  }

  /* ---------- 1. 跨端底座 (eggbabe-cross-end-v1) 与轻养成小零食 ---------- */
  const Store = window.EggBabeStore;
  let catalog = window.__EGGBABE_CATALOG__ || { backgrounds: [], pets: {} };

  if (Store && typeof Store.injectCapsuleSafeAreaVars === "function") {
    Store.injectCapsuleSafeAreaVars(document.documentElement);
  }

  let quotaWarned = false;
  const storageAdapter = Store.createStorageAdapter({
    onQuotaError: () => {
      if (quotaWarned) return;
      quotaWarned = true;
      if (typeof showSceneFeedback === "function") {
        showSceneFeedback("存储空间紧张，已为您保留核心陪伴存档", "system", "warning");
      }
    }
  });
  const loadedStoreResult = Store.loadOrMigrateStore(storageAdapter, catalog);
  const crossStore = loadedStoreResult.store;
  window.__EGGBABE_CROSS_STORE__ = crossStore;

  const SNACKS_BY_PET = {
    koi: [
      { id: "dried_fish", name: "香酥小鱼干", icon: "./living-room-dress/ui/snack_fish.png", hunger: 22, exp: 16, reply: "咔嚓咔嚓，最爱香酥小鱼干啦～" },
      { id: "berry_mochi", name: "草莓大福", icon: "./living-room-dress/ui/snack_berry.png", hunger: 26, exp: 20, reply: "软糯糯甜甜的，幸福冒泡泡～" },
      { id: "star_candy", name: "幸运星星糖", icon: "./living-room-dress/ui/tb_activity.png", hunger: 18, exp: 24, reply: "叮咚，吃掉一颗好运加倍～" }
    ],
    yutu: [
      { id: "carrot", name: "脆脆胡萝卜", icon: "./living-room-dress/ui/snack_carrot.png", hunger: 24, exp: 16, reply: "嘎嘣脆，兔兔能量充满啦～" },
      { id: "osmanthus_cake", name: "桂花蜜糕", icon: "./living-room-dress/ui/snack_cake.png", hunger: 28, exp: 22, reply: "香香的桂花味，像在月宫一样～" },
      { id: "cream_berry", name: "奶油小草莓", icon: "./living-room-dress/ui/snack_berry.png", hunger: 20, exp: 20, reply: "酸酸甜甜，耳朵都要开心翘起来啦～" }
    ]
  };

  const careAll = {
    koi: crossStore.pets.koi.care,
    yutu: crossStore.pets.yutu.care
  };
  function saveCareAll() {
    const now = Date.now();
    careAll.koi.updatedAt = now;
    careAll.yutu.updatedAt = now;
    crossStore.pets.koi.care = careAll.koi;
    crossStore.pets.yutu.care = careAll.yutu;
    if (typeof persistState === "function") persistState();
  }

  /* ---------- 2. 8 态柔和每日心情、10 态房间与遇见配置 ---------- */
  const DAILY_MOODS = Store.MOOD_TYPES;

  const KEPSAKE_DEFS = {
    "soft-button": { id: "soft-button", name: "旧木纽扣", img: "./living-room-dress/keepsakes/soft-button.png", story: "这颗纽扣原本缝在一条很旧的围巾上。天气凉的时候握一会儿，就像有人替我把领口掖好了。" },
    "short-pencil": { id: "short-pencil", name: "短短的铅笔", img: "./living-room-dress/keepsakes/short-pencil.png", story: "这支铅笔越画越短，最后只剩两根手指那么长。每一道木屑里都藏着一张画。" },
    "dali-cloud": { id: "dali-cloud", name: "苍山脚下的云石", img: "./living-room-dress/keepsakes/dali-cloud.png", story: "我在风很大的路边看到它，白色纹路像一小片被压住的云。" },
    "cafe-coaster": { id: "cafe-coaster", name: "软木杯垫", img: "./living-room-dress/keepsakes/cafe-coaster.png", story: "忙乱的时候，把歪掉的杯垫扶正，桌面就会突然安静下来。" },
    "wood-rattle": { id: "wood-rattle", name: "小拨浪鼓", img: "./living-room-dress/keepsakes/wood-rattle.png", story: "轻轻摇一下，声音一圈圈传出去，每当想不出问题就听它开个头。" },
    "ginkgo-leaf": { id: "ginkgo-leaf", name: "一片银杏叶", img: "./living-room-dress/keepsakes/ginkgo-leaf.png", story: "它落下来时正好停在鞋尖，夹在纸页里带回家，边缘像金色的小扇子。" }
  };

  const ROOM_STATES = {
    free_stand: { key: "free_stand", label: "桌面待机", screen: 1, track: "webgl", line: "软木垫晒得暖洋洋的，来陪我玩或者换新衣服吧～" },
    sleep: { key: "sleep", fileKey: "nap", label: "睡觉", screen: 0, track: "baked", line: "我把被角压在脸下面，睡得很安静。", actionFeedback: "房间暗下来，我翻了个身。", keepsakeId: "soft-button", anchors: { yutu: { c: [790, 875], a: [663, 344] }, koi: { c: [650, 860], a: [663, 344] } } },
    lazy: { key: "lazy", fileKey: "lazy", label: "小憩", screen: 0, track: "baked", line: "我听见窗外亮起来了，还想再缩一会儿。", actionFeedback: "被子轻轻盖好，我往里缩了缩。", keepsakeId: "soft-button", anchors: { yutu: { c: [760, 870], a: [570, 980] }, koi: { c: [650, 810], a: [560, 975] } } },
    stare: { key: "stare", fileKey: "stare", label: "发呆", screen: 1, track: "baked", line: "我盯着桌上的光斑，看它慢慢走过半张纸。", actionFeedback: "我慢半拍地回头看你。", keepsakeId: "cafe-coaster", anchors: { yutu: { c: [1450, 930], a: [1450, 930] }, koi: { c: [1590, 980], a: [1590, 980] } } },
    drawing: { key: "drawing", fileKey: "draw", label: "涂涂画画", screen: 1, track: "baked", line: "我画了半张纸，还没有决定它像云还是像鱼。", actionFeedback: "画纸转向你，线条终于看清了。", keepsakeId: "short-pencil", anchors: { yutu: { c: [1440, 1010], a: [1510, 1245] }, koi: { c: [1480, 1000], a: [1510, 1245] } } },
    reading: { key: "reading", fileKey: "read", label: "看书", screen: 1, track: "baked", line: "这一页讲到月亮，我把耳朵靠近一点听。", actionFeedback: "书页翻过去，故事又向前走了一小格。", keepsakeId: "short-pencil", anchors: { yutu: { c: [1420, 930], a: [1415, 1055] }, koi: { c: [1430, 980], a: [1410, 1060] } } },
    gaming: { key: "gaming", fileKey: "game", label: "打游戏", screen: 1, track: "baked", line: "这一关差一点就过去了，我连耳朵都没敢动。", actionFeedback: "画面里的小角色跳了一下，我没有抬头。", keepsakeId: "cafe-coaster", anchors: { yutu: { c: [1400, 990], a: [1490, 1120] }, koi: { c: [1400, 990], a: [1500, 1120] } } },
    music: { key: "music", fileKey: "music", label: "听音乐", screen: 1, track: "baked", line: "这首歌的尾巴轻轻绕了一圈，我还不想按暂停。", actionFeedback: "旋律又走了一小段，房间里像多了一点月光。", keepsakeId: "wood-rattle", anchors: { yutu: { c: [1710, 985], a: [1590, 1050] }, koi: { c: [1780, 1000], a: [1680, 1055] } } },
    window: { key: "window", fileKey: "window", label: "看窗外", screen: 2, track: "baked", line: "远处的云走得很慢，我想和你一起看一会儿。", actionFeedback: "窗外的光慢慢铺开，我陪你看着此刻的天空。", keepsakeId: "ginkgo-leaf", anchors: { yutu: { c: [1940, 835], a: [2200, 450] }, koi: { c: [1940, 830], a: [2200, 450] } } },
    away: { key: "away", label: "外出旅行", screen: 1, track: "away", line: "我穿着新衣服出门拍明信片啦。", actionFeedback: "桌上留了一张字条：拆开左下角信封看看我寄回来的照片吧。", keepsakeId: "dali-cloud", anchors: { yutu: { c: null, a: [1385, 1345] }, koi: { c: null, a: [1385, 1345] } } }
  };

  /* ---------- 3. 原版 PetStage 四大情绪配置（100% 移植自 eggbabe-uni/src/engine/petStage.js） ---------- */
  // 严格遵守 AGENTS.md：玉兔严禁添加粉色腮红；保留原版深棕圆眼、灰蓝鼻与胡须
  const EMO_FACES = {
    yutu: {
      rect: [230, 425, 620, 680], closedTex: true, stalk: false, stalkK: 1,
      eyes: [
        { x: 341, y: 553, r: 27, ex: 327, ey: 549, erx: 43, ery: 52 },
        { x: 503, y: 554, r: 27, ex: 521, ey: 549, erx: 44, ery: 51 }
      ],
      mouth: { x: 421, y: 620, w: 46, h: 30 }, eraseMouth: null,
      browLen: 46, browGap: 6, gloom: { x: 421, y: 432, w: 54, h: 44 },
      lookUp: [4, -11],
      anchors: { L: [248, 485], R: [594, 485], top: [421, 315] },
      lines: {
        laugh: ["哈哈哈，好痒呀～", "嘿嘿，再来一次！", "笑得长耳朵都抖啦～"],
        sad: ["呜…胡萝卜掉了", "陪我玩一会儿嘛…", "心里空空的…"],
        think: ["嗯…月亮上有什么呢？", "让我想想今天穿哪套哦…", "今天吃什么小零食好呢？"],
        cute: ["抱抱我嘛～", "这套新衣服超合身对吧♡", "眯眯眼，最喜欢你啦"]
      }
    },
    koi: {
      rect: [156, 252, 506, 532], closedTex: false, stalk: true, stalkK: 1.5,
      eyes: [
        { x: 247, y: 371, r: 27, ex: 243, ey: 368, erx: 51, ery: 57 },
        { x: 398, y: 371, r: 27, ex: 398, ey: 369, erx: 52, ery: 56 }
      ],
      mouth: { x: 324, y: 448, w: 96, h: 40 },
      eraseMouth: { x0: 248, y0: 420, x1: 400, y1: 478, dy: 54 },
      browLen: 46, browGap: 8, gloom: { x: 324, y: 258, w: 54, h: 38 },
      lookUp: [5, -14],
      anchors: { L: [134, 327], R: [522, 327], top: [410, 204] },
      lines: {
        laugh: ["咕噜噜，笑出泡泡啦！", "哈哈，好运来啦～", "痒痒的，嘻嘻～"],
        sad: ["呜…泡泡破掉了", "鳍鳍好累哦…", "摸摸我才能好起来…"],
        think: ["咦？水面上是什么？", "让我咕噜一下…", "嗯…好运藏在哪？"],
        cute: ["摸摸我，好运加倍♡", "转个圈给你看新衣服～", "嘿嘿，我最锦鲤啦"]
      }
    }
  };

  function earSide(s, v) { return s > 0 ? { earL: 0, earR: v } : { earL: -v, earR: 0 }; }
  function K(o, e, pose, extra) { return Object.assign({ o, e }, pose, extra || {}); }

  const EMO_DEFS = {
    laugh: {
      ms: 2400,
      keys(s) {
        const hop = (o, d) => K(o, "in", { hopY: -26, sy: 1.03, sx: 0.98, headRot: 5 * d, earL: d > 0 ? -14 : -5, earR: d > 0 ? 5 : 14, stalk: 16 * d, wClosed: 1, shS: 0.92 });
        const land = (o, d) => K(o, "out", { hopY: 0, sy: 0.95, sx: 1.05, headRot: 2 * d, earL: -8, earR: 8, stalk: 4 * d, wClosed: 1, shS: 1.08 });
        return [
          K(0, "in", {}),
          K(0.08, "out", { sx: 1.08, sy: 0.88, earL: 12, earR: -12, wClosed: 1, shS: 1.12, stalk: -8 }),
          K(0.18, "out", { hopY: -86, sy: 1.10, sx: 0.94, earL: -20, earR: 20, rot: -2, wClosed: 1, shS: 0.9, stalk: -18 }),
          K(0.28, "in", { hopY: -105, sy: 1.02, sx: 0.99, headRot: 6, earL: -8, earR: 8, rot: -1, wClosed: 1, stalk: -12 }),
          K(0.38, "back", { hopY: 0, sx: 1.12, sy: 0.86, earL: -18, earR: 18, wClosed: 1, shS: 1.16, stalk: 10 }),
          hop(0.46, 1), land(0.515, 1), hop(0.57, -1), land(0.625, -1), hop(0.68, 1),
          K(0.735, "out", { hopY: 0, sy: 0.95, sx: 1.05, headRot: 1, wClosed: 1, shS: 1.08 }),
          K(0.78, "io", { sy: 1.0, wClosed: 1 }),
          K(0.84, "io", { headRot: -4, rot: -1.5, sy: 1.02, earL: -6, earR: 6, wClosed: 1, stalk: -6 }),
          K(0.92, "out", { headRot: -1, wClosed: 0.5 }),
          K(1, "out", {})
        ];
      },
      faces: [["laughEyes", 0.07, 0.88, 140, 260], ["laugh", 0.27, 0.88, 160, 260]],
      beats: [{ u: 0.3, fx: "haha", t: "哈", at: "L" }, { u: 0.46, fx: "haha", t: "哈哈", at: "R" }, { u: 0.57, fx: "haha", t: "嘻", at: "L" }, { u: 0.68, fx: "haha", t: "哈", at: "R" }]
    },
    sad: {
      ms: 2600, lag: { earR: 0.05 },
      keys(s) {
        const base = { sy: 0.94, sx: 1.03, headTy: 12, headRot: -5 * s, earL: -50, earR: 50, stalk: 40 * s };
        const sniff = (o) => K(o, "out", Object.assign({}, base, { sy: 0.965, hopY: -8, headRot: -5 * s + 1.5, stalk: 40 * s + 4 }));
        return [
          K(0, "io", {}),
          K(0.10, "io", { sy: 1.02, earL: -4, earR: 4, stalk: -6 * s }),
          K(0.30, "lin", base), K(0.42, "in", base), sniff(0.443), K(0.466, "out", Object.assign({}, base, { stalk: 40 * s - 4 })),
          K(0.52, "in", base), sniff(0.543), K(0.566, "io", Object.assign({}, base, { stalk: 40 * s - 4 })),
          K(0.62, "io", base),
          K(0.71, "io", Object.assign({}, base, { sy: 0.97, breath: 0.04, headTy: 10 })),
          K(0.80, "io", Object.assign({}, base, { sy: 0.92, breath: -0.02, headTy: 16 })),
          K(0.88, "io", Object.assign({}, base, { sy: 0.93, headTy: 15, lean: 0.25 * s, rot: 0.8 * s })),
          K(0.92, "io", Object.assign({}, base, { sy: 0.97, headTy: 6, headRot: -2 * s, lean: 0.1 * s, earL: -46, earR: 46 })),
          K(0.96, "io", { earL: -30, earR: 30, stalk: 22 * s }),
          K(1, "out", {})
        ];
      },
      faces: [["sad", 0.12, 0.9, 320, 220]],
      beats: [{ u: 0.36, fx: "tear", eye: 0 }, { u: 0.50, fx: "tear", eye: 1 }]
    },
    think: {
      ms: 2500,
      add(u, ms) {
        const w = sstep(0.15, 0.22, u) * (1 - sstep(0.5, 0.55, u));
        const shk = u > 0.8 && u < 0.92 ? Math.sin(((u - 0.8) / 0.12) * Math.PI * 4) * (1 - (u - 0.8) / 0.12) : 0;
        return {
          headRot: 2.5 * w * Math.sin((ms / 1000) * Math.PI * 2 * 0.7),
          lean: 0.15 * w * Math.sin((ms / 1000) * Math.PI * 2 * 0.5),
          stalk: 10 * shk
        };
      },
      keys(s) {
        const tilt = Object.assign({ headRot: 11 * s, rot: 1.5 * s, headTy: 3, stalk: 20 * s }, earSide(s, 24));
        return [
          K(0, "out", {}),
          K(0.15, "lin", tilt), K(0.33, "out", tilt), K(0.345, "in", Object.assign({}, tilt, { hopY: -8 })), K(0.36, "out", tilt),
          K(0.375, "in", Object.assign({}, tilt, { hopY: -8 })), K(0.39, "io", tilt), K(0.5, "io", tilt),
          K(0.62, "io", Object.assign({ headRot: -6 * s, rot: -0.5 * s, headTy: 2, stalk: -12 * s }, earSide(-s, 14))),
          K(0.72, "out", { sy: 0.9, sx: 1.06, headRot: -2 * s, earL: 6, earR: -6, shS: 1.1 }),
          K(0.80, "in", { hopY: -45, sy: 1.08, sx: 0.95, earL: -14, earR: 14, shS: 0.9 }),
          K(0.88, "back", { hopY: 0, sx: 1.08, sy: 0.9, earL: -8, earR: 8, shS: 1.1 }),
          K(0.95, "io", { sy: 1.02 }),
          K(1, "out", {})
        ];
      },
      faces(s) { return [[s > 0 ? "thinkR" : "thinkL", 0.04, 0.72, 220, 120]]; },
      beats: [{ u: 0.08, fx: "q", big: true }, { u: 0.56, fx: "q", big: false, flip: true }, { u: 0.78, fx: "bang" }]
    },
    cute: {
      ms: 2400,
      keys(s) {
        const sw = (o, d) => K(o, "io", Object.assign({ headRot: 10 * d, lean: 0.45 * d, rot: 2 * d, headTy: 3, wClosed: 1, stalk: 14 * d }, d > 0 ? { earL: 8, earR: 10 } : { earL: -10, earR: -8 }));
        const pose = Object.assign({ headRot: 12 * s, rot: 3 * s, headTy: 2, wClosed: 1, stalk: 22 * s }, s > 0 ? { earL: -2, earR: 26 } : { earL: -26, earR: 2 });
        return [
          K(0, "out", {}),
          K(0.10, "io", { sy: 0.95, sx: 1.04, headTy: 4, earL: 8, earR: -8, wClosed: 1 }),
          sw(0.2, 1), sw(0.3, -1), sw(0.4, 1),
          K(0.50, "out", { wClosed: 1 }),
          K(0.55, "in", { hopY: -36, sy: 1.06, sx: 0.96, earL: -10, earR: 10, wClosed: 1, shS: 0.9 }),
          K(0.60, "out", { hopY: 0, sy: 0.9, sx: 1.08, earL: -6, earR: 6, wClosed: 1, shS: 1.1 }),
          K(0.65, "in", { hopY: -36, sy: 1.06, sx: 0.96, earL: -10, earR: 10, wClosed: 1, shS: 0.9 }),
          K(0.70, "back", { hopY: 0, sy: 0.92, sx: 1.07, wClosed: 1, shS: 1.08 }),
          K(0.74, "lin", pose), K(0.865, "io", pose),
          K(0.92, "io", { sy: 1.03, headRot: 3 * s, wClosed: 0.6 }),
          K(1, "out", {})
        ];
      },
      faces: [["cute", 0.04, 0.88, 200, 260]],
      beats: [{ u: 0.2, fx: "heart", at: "R" }, { u: 0.3, fx: "heart", at: "L" }, { u: 0.4, fx: "heart", at: "R" }, { u: 0.76, fx: "star", at: "S" }, { u: 0.8, fx: "star", at: "S2" }]
    }
  };

  /* ---------- 4. 持久化状态（全量服装默认开放，底层统一由 eggbabe-cross-end-v1 驱动） ---------- */
  function detectLocalPeriod() {
    const d = new Date(Date.now() + 8 * 3600 * 1000);
    const h = d.getUTCHours();
    return (h >= 6 && h < 19) ? "day" : "night";
  }

  const todayDateKey = Store.getUtc8DateKey();
  const initialMood = Store.computeDailyMood(todayDateKey, crossStore.activePetId, careAll[crossStore.activePetId]);

  const state = {
    petId: crossStore.activePetId === "yutu" ? "yutu" : "koi",
    roomState: "free_stand",
    period: detectLocalPeriod(),
    stageBgId: (crossStore.settings && crossStore.settings.stageBgId) || "living_room",
    moodKey: initialMood.moodKey,
    sfxOn: crossStore.settings && typeof crossStore.settings.sfxOn === "boolean" ? crossStore.settings.sfxOn : true,
    stars: Number(crossStore.companion.starBalance || 0),
    companionDays: Number(crossStore.companion.companionDays || 1),
    totalCompanionDays: Number(crossStore.companion.totalCompanionDays || 1),
    unreadMail: crossStore.companion.dailyLetterClaimedDate !== todayDateKey,
    actedStates: {},
    savedSet: {
      koi: crossStore.pets.koi.equippedSetId || Store.DEFAULT_SET_BY_PET.koi,
      yutu: crossStore.pets.yutu.equippedSetId || Store.DEFAULT_SET_BY_PET.yutu
    },
    keepsakes: Array.isArray(crossStore.curioCabinet.unlockedIds) ? crossStore.curioCabinet.unlockedIds.slice() : [],
    postcards: Array.isArray(crossStore.postcards) ? crossStore.postcards.slice() : []
  };

  function persistState() {
    crossStore.activePetId = state.petId;
    crossStore.settings.sfxOn = !!state.sfxOn;
    crossStore.settings.stageBgId = state.stageBgId || "living_room";
    crossStore.companion.starBalance = Math.max(0, Math.floor(Number(state.stars || 0)));
    crossStore.pets.koi.equippedSetId = state.savedSet.koi;
    crossStore.pets.yutu.equippedSetId = state.savedSet.yutu;
    crossStore.pets.koi.care = careAll.koi;
    crossStore.pets.yutu.care = careAll.yutu;
    crossStore.curioCabinet.unlockedIds = state.keepsakes.slice();
    crossStore.postcards = state.postcards.slice(0, 60);
    state.companionDays = Number(crossStore.companion.companionDays || 1);
    state.totalCompanionDays = Number(crossStore.companion.totalCompanionDays || 1);
    storageAdapter.setJSON(Store.STORAGE_KEY, crossStore);
  }

  /* ---------- 5. Web Audio 轻音效（对齐 sfx.js：含咀嚼、泡泡、冲水、升级） ---------- */
  let audioCtx = null;
  function playTone(freq, endFreq, dur, gainVal, type) {
    if (!state.sfxOn) return;
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume();
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type || "sine";
      osc.frequency.setValueAtTime(freq, now);
      if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, now + dur);
      gain.gain.setValueAtTime(gainVal || 0.055, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + dur + 0.02);
    } catch (e) {}
  }
  const sfx = {
    tap: () => playTone(520, 680, 0.065, 0.045, "sine"),
    hop: () => playTone(330, 590, 0.13, 0.05, "triangle"),
    munch: () => {
      playTone(290, 210, 0.08, 0.06, "triangle");
      setTimeout(() => playTone(340, 240, 0.08, 0.06, "triangle"), 130);
      setTimeout(() => playTone(520, 760, 0.12, 0.05, "sine"), 270);
    },
    bubble: () => playTone(580 + Math.random() * 280, 960 + Math.random() * 260, 0.07, 0.035, "sine"),
    splash: () => {
      playTone(440, 880, 0.14, 0.055, "sine");
      setTimeout(() => playTone(660, 1180, 0.18, 0.055, "sine"), 95);
    },
    star: () => {
      playTone(660, 880, 0.11, 0.05, "sine");
      setTimeout(() => playTone(880, 1175, 0.16, 0.05, "sine"), 85);
    },
    levelUp: () => {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => playTone(f, f * 1.04, 0.14, 0.055, "triangle"), i * 75));
    },
    ratchet: () => {
      [0, 55, 110].forEach((d, idx) => {
        setTimeout(() => playTone(920 + idx * 110, 520, 0.045, 0.045, "square"), d);
      });
    },
    lampClick: (on) => {
      playTone(on ? 460 : 380, on ? 740 : 260, 0.06, 0.045, "triangle");
    },
    drawer: () => {
      playTone(210, 310, 0.11, 0.04, "triangle");
    },
    clockTick: (even) => {
      playTone(even ? 1080 : 880, even ? 780 : 640, 0.024, 0.016, "triangle");
      playTone(even ? 96 : 88, 72, 0.16, 0.012, "sine");
    }
  };

  /* ---------- 6. DOM 节点引用 ---------- */
  const $ = (id) => document.getElementById(id);
  const appEl = $("app");
  const worldScrollEl = $("world-scroll");
  const worldTrackEl = $("world-track");
  const cameraRigEl = $("camera-rig");
  const panoBoxEl = $("pano-box");
  const panoPrevEl = $("pano-prev");
  const panoCurrEl = $("pano-curr");
  const panoPreloadEl = $("pano-preload");
  const customStageBgEl = $("custom-stage-bg");

  // 夜晚整床入睡贴片 + 窗台天气小摆件 + 台灯暖光光晕 + 书架来信/出门留条气泡
  const petSleepSpriteEl = $("pet-sleep-sprite");
  const petSleepSpriteImgEl = $("pet-sleep-sprite-img");
  const sillWeatherPropEl = $("sill-weather-prop");
  const sillWeatherPropImgEl = $("sill-weather-prop-img");
  const roomLampGlowEl = $("room-lamp-glow");
  const booksMailBubbleEl = $("books-mail-bubble");
  const awayNoteBubbleEl = $("away-note-bubble");

  // 核心 4 组透明交互热区（台灯、书架、桌面原木小立镜、黑猫钟）
  const hitBedLampEl = $("hit-bed-lamp");
  const hitBookshelfEl = $("hit-bookshelf");
  const hitDeskMirrorEl = $("hit-desk-mirror");
  const hitCatClockEl = $("hit-cat-clock");
  const hitSleepPetEl = $("hit-sleep-pet");

  const wallPolaroidEl = $("wall-polaroid");
  const wallPolaroidImgEl = $("wall-polaroid-img");
  const bedsideCatClockEl = $("bedside-cat-clock");
  const sceneClockFocusRingEl = $("scene-clock-focus-ring");
  const sceneHandHourEl = $("scene-hand-hour");
  const sceneHandMinEl = $("scene-hand-minute");
  const clockDutyHintEl = $("clock-duty-hint");
  const clockDutyHintTextEl = $("clock-duty-hint-text");

  const foldedOutfitPropEl = $("folded-outfit-prop");
  const shSoftEl = $("pet-shadow-soft");
  const shConEl = $("pet-shadow-contact");
  const glCanvas = $("gl-pet");
  const petFxHostEl = $("pet-fx-host");
  const sleepZzEl = $("sleep-zz");
  const dirtyLayerEl = $("dirty-layer");
  const btnDirtyHintEl = $("btn-dirty-hint");
  const hungryLayerEl = $("hungry-layer");
  const btnHungryThoughtEl = $("btn-hungry-thought");
  const hungryThoughtIconEl = $("hungry-thought-icon");
  const soapBubbleLayerEl = $("soap-bubble-layer");
  const rinseFlashEl = $("rinse-flash");
  const hitLayerEl = $("scene-hit-layer");
  const charHotspotEl = $("character-hotspot");
  const actionGlowEl = $("action-glow");
  const screenDotsEl = $("screen-dots");

  const feedbackStackEl = $("scene-feedback-stack");
  const feedbackFrontEl = $("feedback-front");
  const feedbackFrontTextEl = $("feedback-front-text");
  const feedbackBackEl = $("feedback-back");
  const feedbackBackTextEl = $("feedback-back-text");

  const moodTabEl = $("pet-mood-tab");
  const roomStarWidgetEl = $("room-star-widget");
  const hudStarCountEl = $("hud-star-count");
  const hudStarGainEl = $("hud-star-gain");
  const hudLvPillEl = $("hud-lv-pill");
  const hudDaysNumEl = $("hud-days-num");
  const hudPetNameEl = $("hud-pet-name");
  const hudSwitchPetTextEl = $("hud-switch-pet-text");
  const hudMoodIconEl = $("hud-mood-icon");
  const hudMoodLabelEl = $("hud-mood-label");
  const hudCareHungerEl = $("hud-care-hunger");
  const hudCareHygieneEl = $("hud-care-hygiene");
  const hudHungerValEl = $("hud-hunger-val");
  const hudHungerBarEl = $("hud-hunger-bar");
  const hudHygieneValEl = $("hud-hygiene-val");
  const hudHygieneBarEl = $("hud-hygiene-bar");

  const profileModalEl = $("profile-modal-overlay");
  const profileAvatarEl = $("profile-avatar");
  const profileUserNicknameEl = $("profile-user-nickname");
  const profileSyncBadgeEl = $("profile-sync-badge");
  const profilePublicIdEl = $("profile-public-id");
  const profilePhoneRowEl = $("profile-phone-row");
  const profilePhoneTextEl = $("profile-phone-text");
  const btnProfilePhoneActionEl = $("btn-profile-phone-action");
  const profileUserBioEl = $("profile-user-bio");
  const profilePetThumbEl = $("profile-pet-thumb");
  const profilePetNameEl = $("profile-pet-name");
  const profilePetLvEl = $("profile-pet-lv");
  const profileMoodIconEl = $("profile-mood-icon");
  const profileMoodLabelEl = $("profile-mood-label");
  const profileMoodQuoteEl = $("profile-mood-quote");
  const profileOutfitTagEl = $("profile-outfit-tag");
  const profileStarBadgeEl = $("profile-star-badge");
  const profileStarValueEl = $("profile-star-value");
  const profileTotalDaysEl = $("profile-total-days");
  const profileStreakDaysEl = $("profile-streak-days");
  const profileBarHungerRowEl = $("profile-bar-hunger-row");
  const profileBarHungerEl = $("profile-bar-hunger");
  const profileValHungerEl = $("profile-val-hunger");
  const profileBarHygieneRowEl = $("profile-bar-hygiene-row");
  const profileBarHygieneEl = $("profile-bar-hygiene");
  const profileValHygieneEl = $("profile-val-hygiene");
  const profileBarExpEl = $("profile-bar-exp");
  const profileValExpEl = $("profile-val-exp");
  const fpKeepsakesTextEl = $("fp-keepsakes-text");
  const fpOutfitsTextEl = $("fp-outfits-text");
  const fpDiariesTextEl = $("fp-diaries-text");
  const fpPostcardsTextEl = $("fp-postcards-text");

  // P4《奶肚黑猫警长发条钟》居中 3D Flip 翻转弹窗节点
  const clockModalEl = $("clock-modal-overlay");
  const ipClockSceneEl = $("ip-clock-scene");
  const ipClockCardEl = $("ip-clock-card");
  const ipClockFrontEl = $("ip-clock-front");
  const ipClockBackEl = $("ip-clock-back");
  const ipClockDialEl = clockModalEl.querySelector(".ip-clock__dial");
  const ipClockFocusArcEl = $("ip-clock-focus-arc");
  const ipClockPatrolTextEl = $("ip-clock-patrol-text");
  const modalHandHourEl = $("modal-hand-hour");
  const modalHandMinEl = $("modal-hand-minute");
  const modalHandSecEl = $("modal-hand-second");
  const ipClockTailPivotEl = $("ip-clock-tail-pivot");
  const btnClockWindupEl = $("btn-clock-windup");
  const ipClockWindupKeyEl = $("ip-clock-windup-key");
  const ipClockWindupLabelEl = $("ip-clock-windup-label");
  const btnClockTickToggleEl = $("btn-clock-tick-toggle");
  const ipClockTickTextEl = $("ip-clock-tick-text");
  const clockModalReadoutEl = $("clock-modal-readout");
  const clockModalSubEl = $("clock-modal-sub");
  const clockModalFocusBannerEl = $("clock-modal-focus-banner");
  const btnClockFlipHintEl = $("btn-clock-flip-hint");
  const btnCloseClockEl = $("btn-close-clock");

  const dockBtnFeedEl = $("dock-btn-feed");
  const dockBtnBathEl = $("dock-btn-bath");
  const dockBtnWardrobeEl = $("dock-btn-wardrobe");
  const dockDotHungryEl = $("dock-dot-hungry");
  const dockDotDirtyEl = $("dock-dot-dirty");
  const feedPanelEl = $("feed-3d-panel");
  const snackGridEl = $("snack-3d-grid");
  const flyingSnackEl = $("flying-snack-3d");
  const flyingSnackImgEl = $("flying-snack-img");
  const dragSnackEl = $("drag-snack-3d");
  const dragSnackImgEl = $("drag-snack-img");
  const bathPanelEl = $("bath-3d-panel");
  const bathPctTextEl = $("bath-pct-text");
  const bathFillBarEl = $("bath-fill-bar");

  const btnContextEntryEl = $("btn-context-entry");
  const contextIconEl = $("context-entry-icon");
  const contextUnreadDotEl = $("context-unread-dot");
  const letterPlaneFxEl = $("letter-plane-fx");

  const actionDockEl = $("scene-action-dock");
  const toolboxDismissEl = $("toolbox-dismiss");
  const toolboxEl = $("companion-toolbox");
  const btnToolboxEl = $("btn-toolbox");
  const toolboxBtnMotionEl = $("toolbox-btn-motion");
  const chestClosedEl = $("chest-lid-closed");
  const chestOpenEl = $("chest-lid-open");
  const tbAlbumDotEl = $("tb-album-dot");
  const tbDeskToggleLabelEl = $("tb-desk-toggle-label");
  const settingsOverlayEl = $("settings-overlay");

  const devTestersEl = $("dev-testers");
  const btnAcceptanceToggleEl = $("btn-acceptance-toggle");
  const acceptanceChevronEl = $("acceptance-chevron");
  const acceptanceStackEl = $("acceptance-stack");

  const fittingTopbarEl = $("fitting-topbar");
  const wardrobeSheetEl = $("wardrobe-sheet");
  const tabWardrobeItemsEl = $("tab-wardrobe-items");
  const tabWardrobeBgsEl = $("tab-wardrobe-bgs");
  const wardrobeGridEl = $("wardrobe-grid");

  const letterOverlayEl = $("today-companion-overlay");
  const letterAwardBoxEl = $("letter-award-box");
  const letterAwardPlusEl = $("letter-award-plus");
  const letterTitleEl = $("letter-title");
  const letterLineEl = $("letter-line");
  const postcardScenePillsEl = $("postcard-scene-pills");
  const letterPolaroidImgEl = $("letter-polaroid-img");
  const polaroidPlaceEl = $("polaroid-place");
  const polaroidOutfitEl = $("polaroid-outfit");

  const albumViewEl = $("keepsake-album-view");
  const curioCabinetViewEl = $("curio-cabinet-view");
  const curioPlacedCountEl = $("curio-placed-count");
  const btnCurioArrangeEl = $("btn-curio-arrange");
  const curioArrangeHintEl = $("curio-arrange-hint");
  const curioShelfGridEl = $("curio-shelf-grid");
  const curioPickerOverlayEl = $("curio-picker-overlay");
  const curioPickerTitleEl = $("curio-picker-title");
  const curioPickerListEl = $("curio-picker-list");
  const btnCurioClearSlotEl = $("btn-curio-clear-slot");
  const keepsakeClueOverlayEl = $("keepsake-clue-overlay");
  const clueLineImgEl = $("clue-line-img");
  const clueCategoryTagEl = $("clue-category-tag");
  const clueTitleEl = $("clue-title");
  const clueTextEl = $("clue-text");
  const clueSourceEl = $("clue-source");

  const keepsakeEmptyEl = $("keepsake-empty");
  const keepsakeGridEl = $("keepsake-grid");
  const detailViewEl = $("keepsake-detail-view");
  const detailNavTitleEl = $("detail-nav-title");
  const detailHeroImgEl = $("detail-hero-img");
  const detailTitleEl = $("detail-title");
  const detailBadgeEl = $("detail-badge");
  const detailPetStorySegEl = $("detail-pet-story-seg");
  const detailStoryEl = $("detail-story");
  const detailDateEl = $("detail-date");
  const detailKeepsakeActionsEl = $("detail-keepsake-actions");
  const detailPlaceCabinetTextEl = $("detail-place-cabinet-text");
  const detailDownloadWrapEl = $("detail-download-wrap");

  function triggerRebound(el) {
    if (!el || REDUCED_MOTION) return;
    el.classList.remove("is-rebounding");
    void el.offsetWidth;
    el.classList.add("is-rebounding");
  }

  function triggerModuleNudge(el) {
    if (!el || REDUCED_MOTION) return;
    el.classList.remove("is-nudge");
    void el.offsetWidth;
    el.classList.add("is-nudge");
  }

  /* ---------- 7. 中场 34vh 双层场景反馈栈 ---------- */
  let feedbackTimer = 0;
  function showSceneFeedback(text, variant, tone, durationMs) {
    if (!text) return;
    const v = variant === "system" ? "system" : "dialogue";
    if (v === "dialogue" && feedbackStackEl.classList.contains("scene-feedback-stack--visible") && feedbackFrontEl.classList.contains("scene-feedback-stack__card--system")) {
      feedbackBackTextEl.textContent = feedbackFrontTextEl.textContent || "";
      feedbackBackEl.hidden = false;
    } else {
      feedbackBackEl.hidden = true;
    }
    feedbackFrontEl.className = "scene-feedback-stack__card scene-feedback-stack__card--" + v + (tone === "warning" ? " scene-feedback-stack__card--warning" : "");
    feedbackFrontTextEl.textContent = text;
    feedbackStackEl.classList.add("scene-feedback-stack--visible");
    clearTimeout(feedbackTimer);
    feedbackTimer = setTimeout(() => {
      feedbackStackEl.classList.remove("scene-feedback-stack--visible");
      feedbackBackEl.hidden = true;
    }, durationMs || (v === "system" ? 1900 : 2600));
  }

  /* ---------- 8. 星星滚字与床头《奶肚黑猫警长发条钟》（P4） ---------- */
  let starRollRaf = 0;
  let displayedStars = state.stars;
  function animateStarsTo(targetVal, gainDelta) {
    const startVal = displayedStars;
    state.stars = targetVal;
    persistState();
    if (gainDelta && gainDelta > 0) {
      hudStarGainEl.textContent = "+" + gainDelta;
      hudStarGainEl.hidden = false;
      roomStarWidgetEl.classList.remove("companion-star--pulse");
      void roomStarWidgetEl.offsetWidth;
      roomStarWidgetEl.classList.add("companion-star--pulse");
      setTimeout(() => { hudStarGainEl.hidden = true; }, 1050);
    }
    if (REDUCED_MOTION || startVal === targetVal) {
      displayedStars = targetVal;
      hudStarCountEl.textContent = String(targetVal);
      return;
    }
    cancelAnimationFrame(starRollRaf);
    const t0 = performance.now();
    function step(now) {
      const u = Math.min(1, (now - t0) / 520);
      displayedStars = Math.round(startVal + (targetVal - startVal) * easeOutCubic(u));
      hudStarCountEl.textContent = String(displayedStars);
      if (u < 1) starRollRaf = requestAnimationFrame(step);
    }
    starRollRaf = requestAnimationFrame(step);
  }

  // P5 日常微照料星星软上限保护（≤15✦/日，超限后照常加饱食/清洁与 EXP）
  function grantCareStars(amount) {
    const res = Store.awardCareStars(crossStore, amount);
    if (res.starsAwarded > 0) {
      animateStarsTo(Number(crossStore.companion.starBalance || state.stars), res.starsAwarded);
    } else {
      persistState();
    }
    return res;
  }

  const CLOCK_SHIFT_DEFS = {
    day: { id: "day", label: "白班", time: "06:00", hint: "☀️ 白班哨暗号：06:00 拉开窗帘晒晒太阳" },
    sunset: { id: "sunset", label: "黄昏哨", time: "17:00", hint: "🌇 黄昏哨暗号：17:00 泡杯热茶歇一歇" },
    night: { id: "night", label: "夜巡哨", time: "19:30", hint: "🌙 夜巡哨暗号：23:00 陪它关台灯休息" }
  };
  const FOCUS_CIRCUMFERENCE = 2 * Math.PI * 54;
  let clockFlipped = false;
  let clockKeyAngle = 0;
  let clockFlipAnimLock = false;

  function detectSkylineEngine() {
    try {
      const qs = new URLSearchParams(window.location.search);
      if (qs.get("skyline") === "1") return true;
      if (typeof wx !== "undefined" && wx && wx.renderer === "skyline") return true;
    } catch (e) {}
    return false;
  }
  const IS_SKYLINE_FALLBACK = detectSkylineEngine();
  if (IS_SKYLINE_FALLBACK) {
    ipClockCardEl.classList.add("is-skyline-fallback");
  }

  function getClockWidget() {
    Store.ensureModularAndClockDefaults(crossStore);
    return crossStore.clockWidget;
  }

  function resolveActiveShift(now) {
    const cw = getClockWidget();
    if (cw.shiftId && CLOCK_SHIFT_DEFS[cw.shiftId]) return cw.shiftId;
    const h = now.getHours(), m = now.getMinutes();
    if (h >= 6 && h < 17) return "day";
    if (h >= 17 && (h < 19 || (h === 19 && m < 30))) return "sunset";
    return "night";
  }

  // 严守小程序 PRD §4.1.3 第 7 条红线：正面 6 点钟执勤微窗绝不显示剩余倒计时数字
  function resolvePatrolWindowText(now) {
    const h = now.getHours();
    if (h >= 23 || h < 6) return "🌙 深夜静默值守";
    const map = {
      sleep: "🌙 被窝夜巡休整",
      lazy: "☁️ 被角打盹值守",
      stare: "☀️ 桌角光斑执勤",
      drawing: "🐾 书桌涂鸦值守",
      reading: "📖 翻书安静值守",
      gaming: "🎮 掌机关卡值守",
      music: "🎵 旋律巡逻中",
      window: "🌤️ 窗边望云执勤",
      away: "📮 远行守屋值班"
    };
    if (map[state.roomState]) return map[state.roomState];
    const shift = resolveActiveShift(now);
    if (shift === "sunset") return "🌇 黄昏巡逻点名";
    if (shift === "night") return "🌙 床头夜巡值守";
    return "🐾 书桌涂鸦值守";
  }

  function checkAndSettleFocusSession() {
    return false;
  }

  function renderBlackCatClockUI() {
    const cw = getClockWidget();
    const now = new Date();
    const shiftKey = resolveActiveShift(now);
    const shiftDef = CLOCK_SHIFT_DEFS[shiftKey] || CLOCK_SHIFT_DEFS.day;

    // 1. 正面微窗（纯粹走时与值守状态）
    if (ipClockPatrolTextEl) ipClockPatrolTextEl.textContent = resolvePatrolWindowText(now);
    if (ipClockDialEl) ipClockDialEl.classList.remove("is-focus-active");
    if (clockDutyHintEl) clockDutyHintEl.classList.remove("is-focusing");
    if (clockDutyHintTextEl) clockDutyHintTextEl.textContent = "🐾 警长值班中";
    if (ipClockFocusArcEl) ipClockFocusArcEl.style.strokeDashoffset = FOCUS_CIRCUMFERENCE.toFixed(2);

    // 2. 背面班次拨盘高亮
    clockModalEl.querySelectorAll("[data-clock-shift]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.clockShift === shiftKey);
    });

    // 3. 背面呼噜滴答机械拨杆
    const tickOn = !!cw.tickWhiteNoiseOn;
    if (btnClockTickToggleEl) btnClockTickToggleEl.setAttribute("aria-checked", String(tickOn));
    if (ipClockTickTextEl) ipClockTickTextEl.textContent = tickOn ? "呼噜滴答:开" : "呼噜滴答:关";

    // 4. 底部副标题与翻转提示
    const wk = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][now.getDay()];
    if (clockModalSubEl) clockModalSubEl.textContent = `${now.getMonth() + 1}月${now.getDate()}日 ${wk} · ${shiftDef.label}`;
    if (btnClockFlipHintEl) btnClockFlipHintEl.textContent = clockFlipped ? "点一下翻回正面表盘 ↻" : "轻触黑猫翻看背面 ↻";
  }

  function updateBlackCatClockTick() {
    checkAndSettleFocusSession();
    const now = new Date();
    const hh = now.getHours(), mm = now.getMinutes(), ss = now.getSeconds();
    const hourDeg = (((hh % 12) + mm / 60) * 30).toFixed(1);
    const minDeg = ((mm + ss / 60) * 6).toFixed(1);
    const secDeg = (ss * 6).toFixed(1);

    // 同步场景床头微缩指针 & 弹窗高清表盘指针
    sceneHandHourEl.style.transform = `rotate(${hourDeg}deg)`;
    sceneHandMinEl.style.transform = `rotate(${minDeg}deg)`;
    modalHandHourEl.style.transform = `rotate(${hourDeg}deg)`;
    modalHandMinEl.style.transform = `rotate(${minDeg}deg)`;
    modalHandSecEl.style.transform = `rotate(${secDeg}deg)`;

    clockModalReadoutEl.textContent = `${String(hh).padStart(2, "0")} : ${String(mm).padStart(2, "0")} : ${String(ss).padStart(2, "0")}`;

    // 背面黑猫尾巴随秒针一左一右慢悠悠摇摆
    if (!REDUCED_MOTION) {
      const swingDeg = ss % 2 === 0 ? -15 : 15;
      ipClockTailPivotEl.style.transform = `rotate(${swingDeg}deg)`;
    }

    // 开启「呼噜滴答」且音效打开时播放轻柔机械滴答 + 呼噜低频
    const cw = getClockWidget();
    if (cw.tickWhiteNoiseOn && state.sfxOn && document.visibilityState === "visible") {
      sfx.clockTick(ss % 2 === 0);
    }

    renderBlackCatClockUI();
  }

  function setClockFlipped(nextFlipped) {
    const target = !!nextFlipped;
    if (clockFlipAnimLock) return;
    sfx.tap();

    if (IS_SKYLINE_FALLBACK && !REDUCED_MOTION) {
      clockFlipAnimLock = true;
      ipClockCardEl.classList.add("is-skyline-mid");
      setTimeout(() => {
        clockFlipped = target;
        ipClockCardEl.dataset.flipped = String(clockFlipped);
        ipClockFrontEl.setAttribute("aria-hidden", String(clockFlipped));
        ipClockBackEl.setAttribute("aria-hidden", String(!clockFlipped));
        renderBlackCatClockUI();
        ipClockCardEl.classList.remove("is-skyline-mid");
        setTimeout(() => { clockFlipAnimLock = false; }, 260);
      }, 150);
      return;
    }

    clockFlipped = target;
    ipClockCardEl.dataset.flipped = String(clockFlipped);
    ipClockFrontEl.setAttribute("aria-hidden", String(clockFlipped));
    ipClockBackEl.setAttribute("aria-hidden", String(!clockFlipped));
    renderBlackCatClockUI();
  }

  function openClockModal() {
    checkAndSettleFocusSession();
    clockFlipped = false;
    ipClockCardEl.dataset.flipped = "false";
    ipClockFrontEl.setAttribute("aria-hidden", "false");
    ipClockBackEl.setAttribute("aria-hidden", "true");
    renderBlackCatClockUI();
    updateBlackCatClockTick();

    const srcRect = bedsideCatClockEl.getBoundingClientRect();
    clockModalEl.hidden = false;

    // 600ms FLIP 飞出过渡：从床头顶板平滑飞入屏幕中央
    if (!REDUCED_MOTION && srcRect && srcRect.width > 12) {
      const dstRect = ipClockSceneEl.getBoundingClientRect();
      if (dstRect.width > 0) {
        const dx = (srcRect.left + srcRect.width / 2) - (dstRect.left + dstRect.width / 2);
        const dy = (srcRect.top + srcRect.height / 2) - (dstRect.top + dstRect.height / 2);
        const sc = clamp(srcRect.width / dstRect.width, 0.25, 0.9);
        ipClockSceneEl.style.transition = "none";
        ipClockSceneEl.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0) scale(${sc.toFixed(3)})`;
        void ipClockSceneEl.offsetWidth;
        ipClockSceneEl.style.transition = "transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)";
        ipClockSceneEl.style.transform = "translate3d(0, 0, 0) scale(1)";
        setTimeout(() => { ipClockSceneEl.style.transition = ""; }, 620);
      }
    }
  }

  function closeClockModal() {
    clockModalEl.hidden = true;
  }

  // 点击表身正面 / 背面空白处 / 底部按钮触发 180° 翻转
  ipClockFrontEl.addEventListener("click", (ev) => {
    ev.stopPropagation();
    setClockFlipped(true);
  });
  ipClockFrontEl.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      setClockFlipped(true);
    }
  });
  ipClockBackEl.addEventListener("click", (ev) => {
    if (ev.target && ev.target.closest && ev.target.closest(".ip-clock__backplate")) return;
    ev.stopPropagation();
    setClockFlipped(false);
  });
  btnClockFlipHintEl.addEventListener("click", (ev) => {
    ev.stopPropagation();
    setClockFlipped(!clockFlipped);
  });
  btnCloseClockEl.addEventListener("click", () => { sfx.tap(); closeClockModal(); });
  clockModalEl.addEventListener("click", (ev) => {
    if (ev.target === clockModalEl) {
      sfx.tap();
      closeClockModal();
    }
  });

  // 背面①：白班 / 黄昏哨 / 夜巡哨作息拨盘
  clockModalEl.querySelectorAll("[data-clock-shift]").forEach((btn) => {
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const shift = btn.dataset.clockShift;
      if (!CLOCK_SHIFT_DEFS[shift]) return;
      sfx.tap();
      const cw = getClockWidget();
      cw.shiftId = shift;
      persistState();
      renderBlackCatClockUI();
      showSceneFeedback(CLOCK_SHIFT_DEFS[shift].hint, "dialogue");
    });
  });

  // 背面③：呼噜滴答声机械拨杆
  btnClockTickToggleEl.addEventListener("click", (ev) => {
    ev.stopPropagation();
    const cw = getClockWidget();
    cw.tickWhiteNoiseOn = !cw.tickWhiteNoiseOn;
    persistState();
    if (cw.tickWhiteNoiseOn) sfx.clockTick(true);
    else sfx.tap();
    renderBlackCatClockUI();
    showSceneFeedback(cw.tickWhiteNoiseOn ? "呼噜滴答白噪音已开启" : "呼噜滴答已静音", "system");
  });

  // 锁屏 / 切后台唤醒幂等时间戳补算（H5 visibilitychange/focus/pageshow + 微信 wx.onAppShow）
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") checkAndSettleFocusSession();
  });
  window.addEventListener("focus", () => checkAndSettleFocusSession());
  window.addEventListener("pageshow", () => checkAndSettleFocusSession());
  if (typeof wx !== "undefined" && wx && typeof wx.onAppShow === "function") {
    try { wx.onAppShow(() => checkAndSettleFocusSession()); } catch (e) {}
  }

  clockDutyHintEl.addEventListener("click", () => {
    sfx.tap();
    scrollToScreen(0, true);
    setTimeout(() => triggerRebound(bedsideCatClockEl.querySelector(".scene-cat-clock__img")), 360);
  });

  updateBlackCatClockTick();
  setInterval(updateBlackCatClockTick, 1000);

  /* ---------- 9. 内嵌 catalog.json 辅助查询 ---------- */
  function getSetItem(petId, setId) {
    if (!catalog || !setId) return null;
    const p = catalog.pets && catalog.pets[petId];
    return (p && p.items && p.items.find((x) => x.id === setId)) || null;
  }

  function getSetName(petId, setId) {
    const found = getSetItem(petId, setId);
    return found ? found.name : "";
  }

  function getPetDisplayThumbUrl(petId, setId) {
    const p = catalog && catalog.pets && catalog.pets[petId];
    const item = getSetItem(petId, setId);
    const rel = (item && (item.thumb || item.tex)) || (p && p.textures && p.textures.base) || "";
    return sharedUrl(rel);
  }

  function getPetName(petId) {
    const p = crossStore.pets && crossStore.pets[petId];
    return (p && p.name) || Store.DEFAULT_PET_NAMES[petId] || "蛋宝宝";
  }

  function getAllPostcardScenes() {
    const list = [
      {
        id: "living_room",
        label: "破壳起居室",
        src: `./living-room-dress/panoramas/empty_${state.period}.png`,
        cropCenter: true,
        tint: "rgba(255,224,182,0.07)",
        shadowRgba: "rgba(58,36,18,0.30)",
        pose: "cute",
        copy: {
          koi: "在阳光晒暖的书桌软木垫上转了个圈，这套新穿搭正式收录进今日份好运气。",
          yutu: "在窗边软木垫刚换好的新造型，趁咖啡还冒着热气，留一张居家定妆纪念。"
        }
      }
    ];
    (catalog.backgrounds || []).forEach((bg, idx) => {
      const poses = ["tilt", "cute", "jump"];
      list.push({
        id: bg.id,
        label: bg.name,
        src: sharedUrl(bg.file),
        cropCenter: false,
        tint: "rgba(255,220,185,0.08)",
        shadowRgba: bg.exportShadowRgba || "rgba(48,32,20,0.32)",
        pose: poses[idx % poses.length],
        copy: {
          koi: `穿着喜欢的衣服溜达到「${bg.name}」，连吹过来的风都带着泡泡糖的味道，快拍给你看～`,
          yutu: `今天去「${bg.name}」散步啦，长耳朵听见了很温柔的风声，顺手寄一张明信片回书桌给你。`
        }
      });
    });
    return list;
  }

  /* ---------- 10. 左上精简 HUD 状态牌 + 「个人信息与伙伴档案」手帐弹窗（P1） ---------- */
  let secretTapTimes = [];

  function copyTextToClipboard(text, successMsg) {
    const val = String(text || "");
    if (!val) return;
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      navigator.clipboard.writeText(val).then(() => {
        showSceneFeedback(successMsg || "已复制到剪贴板", "system");
      }).catch(() => {
        fallbackCopyText(val, successMsg);
      });
    } else {
      fallbackCopyText(val, successMsg);
    }
  }

  function fallbackCopyText(val, successMsg) {
    try {
      const ta = document.createElement("textarea");
      ta.value = val;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      showSceneFeedback(successMsg || "已复制到剪贴板", "system");
    } catch (e) {
      showSceneFeedback(val, "system");
    }
  }

  function isPetHungryNow() {
    const ps = careAll[state.petId] || careAll.koi;
    return Math.round(clamp(ps.hunger, 0, 100)) < 30;
  }

  function isPetDirtyNow() {
    const ps = careAll[state.petId] || careAll.koi;
    return Math.round(clamp(ps.hygiene, 0, 100)) < 30;
  }

  function getPetPersonaId(petId) {
    const pid = petId === "yutu" ? "yutu" : "koi";
    const stored = crossStore && crossStore.pets && crossStore.pets[pid] && crossStore.pets[pid].personaId;
    return Voice ? Voice.resolvePersonaId(pid, stored) : (stored || (pid === "yutu" ? "dry_wit" : "chill_daze"));
  }

  function sayAsPet(sceneKey, fallbackText, petIdOverride) {
    const pid = petIdOverride || state.petId;
    if (Voice) {
      const line = Voice.pick(pid, getPetPersonaId(pid), sceneKey);
      if (line) return line;
    }
    return fallbackText || "";
  }

  function syncCareIndicators() {
    const isHungry = isPetHungryNow();
    const isDirty = isPetDirtyNow();

    if (dockDotHungryEl) dockDotHungryEl.hidden = !isHungry;
    if (dockDotDirtyEl) dockDotDirtyEl.hidden = !isDirty;
    if (hudDaysNumEl) hudDaysNumEl.textContent = String(crossStore.companion.totalCompanionDays || 1);

    const petVisibleAwake = isWebGLActive() && !isFittingOpen && !(typeof isNightSleepingNow === "function" && isNightSleepingNow());
    const showDirtyFx = isDirty && petVisibleAwake && careUiMode !== "bath";
    const showHungryFx = isHungry && petVisibleAwake && careUiMode !== "feed";

    appEl.classList.toggle("is-pet-dirty", showDirtyFx);
    appEl.classList.toggle("is-pet-hungry", showHungryFx);

    if (dirtyLayerEl) {
      dirtyLayerEl.hidden = !showDirtyFx;
      if (showDirtyFx) {
        if (btnDirtyHintEl && Voice) {
          const sp = btnDirtyHintEl.querySelector("span");
          if (sp) sp.textContent = Voice.getDirtyCueText(getPetPersonaId(state.petId));
        }
        positionDirtyFx();
      }
    }
    if (hungryLayerEl) {
      hungryLayerEl.hidden = !showHungryFx;
      if (showHungryFx) {
        if (hungryThoughtIconEl) {
          hungryThoughtIconEl.src = state.petId === "yutu"
            ? "./living-room-dress/ui/snack_carrot.png"
            : "./living-room-dress/ui/snack_fish.png";
        }
        positionHungryFx();
      }
    }
  }

  function getActiveComputedMood() {
    const dk = Store.getUtc8DateKey();
    const ps = careAll[state.petId] || careAll.koi;
    const m = Store.computeDailyMood(dk, state.petId, ps);
    state.moodKey = m.moodKey;
    if (crossStore.pets[state.petId]) {
      crossStore.pets[state.petId].dailyMood = {
        dateKey: m.dateKey,
        moodKey: m.moodKey,
        overriddenByCare: m.overriddenByCare
      };
    }
    return m;
  }

  function renderMoodTab() {
    const mood = getActiveComputedMood();
    const speciesLabel = state.petId === "yutu" ? "玉兔" : "锦鲤";
    hudStarCountEl.textContent = String(state.stars);
    hudPetNameEl.textContent = `${getPetName(state.petId)} · ${speciesLabel}`;
    hudSwitchPetTextEl.textContent = state.petId === "yutu" ? "⇄ 锦鲤" : "⇄ 玉兔";
    hudMoodIconEl.textContent = mood.icon;
    hudMoodLabelEl.textContent = mood.label;
    syncCareIndicators();
    if (!profileModalEl.hidden) renderProfileModal();
  }

  function renderProfileModal() {
    const mode = crossStore.profileMode || "h5";
    const user = crossStore.user;
    const petId = state.petId;
    const ps = careAll[petId] || careAll.koi;
    const mood = getActiveComputedMood();
    const eqName = getSetName(petId, state.savedSet[petId]) || "原生毛绒";

    // 分区一：账号与 4 档 profileMode 适配
    if (user.avatarUrl) {
      profileAvatarEl.innerHTML = `<img src="${user.avatarUrl}" alt="头像" />`;
    } else {
      const firstChar = Array.from(String(user.nickname || "蛋").trim())[0] || "蛋";
      profileAvatarEl.textContent = firstChar;
    }
    profileUserNicknameEl.textContent = user.nickname || "蛋宝好友";
    profilePublicIdEl.textContent = user.publicId || "EB-000000";
    profileUserBioEl.textContent = user.bio || "这个人很懒，还没有简介";

    if (mode === "h5") {
      profileSyncBadgeEl.textContent = "本地已保存";
      profilePhoneRowEl.hidden = false;
      profilePhoneTextEl.textContent = "跨端存档备份";
      btnProfilePhoneActionEl.textContent = "生成跨端引继码";
    } else if (mode === "wx-mp-enterprise") {
      profileSyncBadgeEl.textContent = "已同步云端 ●";
      profilePhoneRowEl.hidden = false;
      if (user.maskedPhone) {
        profilePhoneTextEl.textContent = `📱 手机号：${user.maskedPhone}`;
        btnProfilePhoneActionEl.textContent = "已绑定";
      } else {
        profilePhoneTextEl.textContent = "📱 手机号：未绑定";
        btnProfilePhoneActionEl.textContent = "绑定手机号 · 防丢档";
      }
    } else if (mode === "wx-minigame") {
      profileSyncBadgeEl.textContent = "小游戏云端 ●";
      profilePhoneRowEl.hidden = false;
      if (user.maskedPhone) {
        profilePhoneTextEl.textContent = `📱 手机号：${user.maskedPhone}`;
        btnProfilePhoneActionEl.textContent = "已同步";
      } else {
        profilePhoneTextEl.textContent = "📱 手机号：未同步";
        btnProfilePhoneActionEl.textContent = "授权同步手机号";
      }
    } else {
      // wx-mp-ordinary：严格遵循 privacy.wxml §8，彻底隐藏手机号字段
      profileSyncBadgeEl.textContent = "微信已登录 ●";
      profilePhoneRowEl.hidden = true;
    }

    // 分区二：宠物核心档案
    document.querySelectorAll("[data-profile-pet]").forEach((btn) => {
      const active = btn.dataset.profilePet === petId;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", String(active));
    });
    profilePetThumbEl.src = getPetDisplayThumbUrl(petId, state.savedSet[petId]);
    profilePetNameEl.textContent = getPetName(petId);
    profileMoodIconEl.textContent = mood.icon;
    profileMoodLabelEl.textContent = mood.label;
    profileMoodQuoteEl.textContent = `“${mood.text}”`;
    profileOutfitTagEl.textContent = `身穿 · ${eqName}`;

    profileStarValueEl.textContent = `${state.stars} ✦`;
    profileTotalDaysEl.textContent = `累计 ${crossStore.companion.totalCompanionDays || 1} 天`;
  }

  function openProfileModal() {
    renderProfileModal();
    profileModalEl.hidden = false;
  }

  function closeProfileModal() {
    profileModalEl.hidden = true;
  }

  $("btn-hud-switch-pet").addEventListener("click", async (ev) => {
    ev.stopPropagation();
    sfx.tap();
    const next = state.petId === "koi" ? "yutu" : "koi";
    await switchPet(next);
    showSceneFeedback(`已切换为：${getPetName(next)}（${next === "koi" ? "12" : "24"} 套穿搭）`, "system");
  });

  moodTabEl.addEventListener("click", () => {
    sfx.tap();
    triggerRebound(moodTabEl);
    openProfileModal();
  });
  moodTabEl.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      sfx.tap();
      openProfileModal();
    }
  });

  $("btn-close-profile").addEventListener("click", () => { sfx.tap(); closeProfileModal(); });
  profileModalEl.addEventListener("click", (ev) => {
    if (ev.target === profileModalEl) {
      sfx.tap();
      closeProfileModal();
    }
  });
  window.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") {
      if (settingsOverlayEl && !settingsOverlayEl.hidden) return;
      if (!clockModalEl.hidden) closeClockModal();
      else if (!profileModalEl.hidden) closeProfileModal();
    }
  });

  $("btn-copy-public-id").addEventListener("click", () => {
    sfx.tap();
    copyTextToClipboard(crossStore.user.publicId, `蛋宝宝号 ${crossStore.user.publicId} 已复制`);
  });

  $("btn-edit-user-nickname").addEventListener("click", () => {
    sfx.tap();
    const input = window.prompt("请输入你的昵称（1–16 字）：", crossStore.user.nickname || "");
    if (input === null) return;
    const res = Store.validateNickname(input, 16);
    if (!res.ok) {
      showSceneFeedback(res.error, "system", "warning");
      return;
    }
    crossStore.user.nickname = res.value;
    persistState();
    renderProfileModal();
    showSceneFeedback("昵称已更新", "system");
  });

  $("btn-edit-user-bio").addEventListener("click", () => {
    sfx.tap();
    const input = window.prompt("请输入个人简介（最多 30 字）：", crossStore.user.bio || "");
    if (input === null) return;
    const res = Store.validateUserBio(input, 30);
    if (!res.ok) {
      showSceneFeedback(res.error, "system", "warning");
      return;
    }
    crossStore.user.bio = res.value;
    persistState();
    renderProfileModal();
    showSceneFeedback("简介已保存", "system");
  });

  btnProfilePhoneActionEl.addEventListener("click", () => {
    sfx.tap();
    const mode = crossStore.profileMode || "h5";
    if (mode === "h5") {
      const token = `${crossStore.user.publicId}-${String(crossStore.companion.totalCompanionDays || 1).padStart(2, "0")}D-${crossStore.activePetId.toUpperCase()}`;
      copyTextToClipboard(token, `跨端引继码已复制：${token}`);
      return;
    }
    if (mode === "wx-mp-enterprise" || mode === "wx-minigame") {
      if (crossStore.user.maskedPhone) {
        showSceneFeedback(`当前已缓存脱敏号 ${crossStore.user.maskedPhone}（免重复扣费）`, "system");
        return;
      }
      // 模拟服务端换取脱敏手机号并持久化缓存（前端绝不存明文完整号码）
      crossStore.user.maskedPhone = "138****5678";
      crossStore.user.phoneBoundAt = Store.getUtc8IsoString();
      persistState();
      renderProfileModal();
      showSceneFeedback("已绑定脱敏手机号 138****5678", "system");
    }
  });

  document.querySelectorAll("[data-profile-pet]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const next = btn.dataset.profilePet;
      if (!next || next === state.petId) return;
      sfx.tap();
      await switchPet(next);
      renderProfileModal();
    });
  });

  $("btn-edit-pet-name").addEventListener("click", () => {
    sfx.tap();
    const current = getPetName(state.petId);
    const input = window.prompt("给小家伙起个新名字吧（最多 10 字）：", current);
    if (input === null) return;
    const res = Store.validateNickname(input, 10);
    if (!res.ok) {
      showSceneFeedback(res.error, "system", "warning");
      return;
    }
    crossStore.pets[state.petId].name = res.value;
    persistState();
    renderMoodTab();
    renderProfileModal();
    showSceneFeedback(`已将伙伴改名为「${res.value}」`, "system");
  });

  // 5 连击弹窗星标开启/收起 #dev-testers（从主界面 HUD 迁移至此）
  profileStarBadgeEl.addEventListener("click", () => {
    sfx.tap();
    const now = Date.now();
    secretTapTimes = secretTapTimes.filter((t) => now - t < 2400);
    secretTapTimes.push(now);
    if (secretTapTimes.length >= 5) {
      secretTapTimes = [];
      devTestersEl.hidden = !devTestersEl.hidden;
      showSceneFeedback(devTestersEl.hidden ? "验收工具已收起" : "验收工具已开启", "system");
    }
  });

  if (new URLSearchParams(window.location.search).get("demo") === "1") {
    devTestersEl.hidden = false;
  }

  /* ---------- 11. 三屏全景视口与 11 套插画背景舞台切换 ---------- */
  let geom = { vw: 390, vh: 844, isPortrait: true, trackW: 1170, panoScale: 0.5, ox: 0, oy: 0, pw: 1411, ph: 836 };
  let isFittingOpen = false;
  let careUiMode = "none"; // "none" | "feed" | "bath"

  function isCustomBgActive() {
    return state.stageBgId && state.stageBgId !== "living_room" && state.roomState === "free_stand";
  }

  function syncCustomStageBg() {
    if (isCustomBgActive()) {
      const bgObj = (catalog.backgrounds || []).find((b) => b.id === state.stageBgId);
      if (bgObj) {
        appEl.classList.add("has-custom-bg");
        customStageBgEl.src = sharedUrl(bgObj.file);
        customStageBgEl.hidden = false;
        shSoftEl.style.background = bgObj.shadowSoft || "";
        shConEl.style.background = bgObj.shadowContact || "";
        screenDotsEl.style.display = "none";
        return;
      }
    }
    appEl.classList.remove("has-custom-bg");
    customStageBgEl.hidden = true;
    shSoftEl.style.background = "";
    shConEl.style.background = "";
    screenDotsEl.style.display = (geom.isPortrait || geom.trackW > geom.vw + 24) ? "flex" : "none";
  }

  function updateViewportGeometry() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const isPortrait = (vw / Math.max(1, vh)) < 1.15;
    const trackW = isPortrait ? vw * 3 : Math.max(vw, Math.round(vh * (PANO_W / PANO_H)));
    const panoScale = Math.max(trackW / PANO_W, vh / PANO_H);
    const pw = Math.round(PANO_W * panoScale);
    const ph = Math.round(PANO_H * panoScale);
    const ox = Math.round((trackW - pw) / 2);
    const oy = Math.round((vh - ph) / 2);

    geom = { vw, vh, isPortrait, trackW, panoScale, ox, oy, pw, ph };
    worldTrackEl.style.width = trackW + "px";
    panoBoxEl.style.left = ox + "px";
    panoBoxEl.style.top = oy + "px";
    panoBoxEl.style.width = pw + "px";
    panoBoxEl.style.height = ph + "px";

    syncCustomStageBg();
    layoutScenePropsAndHotspots();
    if (isFittingOpen) applyFittingCameraTransform();
  }

  function panoToBoxStyle(el, px, py, wPano, hPano, anchorOrigin) {
    if (!el) return;
    el.style.left = (px * geom.panoScale).toFixed(1) + "px";
    el.style.top = (py * geom.panoScale).toFixed(1) + "px";
    if (wPano) el.style.width = (wPano * geom.panoScale).toFixed(1) + "px";
    if (hPano) el.style.height = (hPano * geom.panoScale).toFixed(1) + "px";
    if (anchorOrigin === "top-left") {
      el.dataset.anchor = "top-left";
    }
  }

  function updateClockDutyHintVisibility() {
    if (!clockDutyHintEl) return;
    const maxS = worldTrackEl.offsetWidth - worldScrollEl.clientWidth;
    if (maxS <= 6) {
      clockDutyHintEl.classList.add("is-hidden-edge");
      return;
    }
    // 当床头黑猫警长钟 (x=430) 已在视口可视范围内时自动隐藏左缘提示角标
    const clockViewportX = geom.ox + 430 * geom.panoScale - worldScrollEl.scrollLeft;
    const isClockVisible = clockViewportX > 36 && clockViewportX < geom.vw - 36;
    clockDutyHintEl.classList.toggle("is-hidden-edge", isClockVisible);
  }

  function scrollToScreen(screenIdx, smooth) {
    const maxScroll = worldTrackEl.offsetWidth - worldScrollEl.clientWidth;
    if (maxScroll <= 4) return;
    const targetX = geom.isPortrait
      ? clamp(screenIdx, 0, 2) * geom.vw
      : geom.ox + (screenIdx === 0 ? 720 : screenIdx === 2 ? 2120 : CORK_HOME.x) * geom.panoScale - geom.vw * 0.5;
    worldScrollEl.scrollTo({ left: clamp(targetX, 0, maxScroll), behavior: (smooth && !REDUCED_MOTION) ? "smooth" : "auto" });
    setTimeout(updateClockDutyHintVisibility, smooth ? 420 : 20);
  }

  function scrollToPanoX(panoX, smooth) {
    const maxScroll = worldTrackEl.offsetWidth - worldScrollEl.clientWidth;
    if (maxScroll <= 4) return;
    const targetX = geom.ox + panoX * geom.panoScale - geom.vw * 0.5;
    worldScrollEl.scrollTo({ left: clamp(targetX, 0, maxScroll), behavior: (smooth && !REDUCED_MOTION) ? "smooth" : "auto" });
    setTimeout(updateClockDutyHintVisibility, smooth ? 420 : 20);
  }

  worldScrollEl.addEventListener("scroll", () => {
    const maxS = worldTrackEl.offsetWidth - worldScrollEl.clientWidth;
    updateClockDutyHintVisibility();
    if (maxS <= 6) return;
    const r = worldScrollEl.scrollLeft / maxS;
    const idx = r < 0.30 ? 0 : r < 0.70 ? 1 : 2;
    screenDotsEl.querySelectorAll(".screen-dot").forEach((d, i) => d.classList.toggle("screen-dot--active", i === idx));
  });

  let mousePan = null;
  worldScrollEl.addEventListener("pointerdown", (ev) => {
    if (ev.pointerType === "mouse" && !isFittingOpen && careUiMode === "none" && worldTrackEl.offsetWidth > worldScrollEl.clientWidth + 8) {
      mousePan = { startX: ev.clientX, startScroll: worldScrollEl.scrollLeft, moved: false };
    }
  });
  window.addEventListener("pointermove", (ev) => {
    if (!mousePan) return;
    const dx = ev.clientX - mousePan.startX;
    if (Math.abs(dx) > 6) mousePan.moved = true;
    if (mousePan.moved) worldScrollEl.scrollLeft = mousePan.startScroll - dx;
  });
  window.addEventListener("pointerup", () => { setTimeout(() => { mousePan = null; }, 0); });

  let currentPanoUrl = COZY_SCENE_CONFIG.panoramas.day;
  let panoReqToken = 0;
  function resolveTargetPanoramaUrl() {
    const pd = state.period;
    if (isFittingOpen || state.roomState === "free_stand" || state.roomState === "away") {
      if (pd === "night") {
        return isBedsideLampLit() ? COZY_SCENE_CONFIG.panoramas.nightLit : COZY_SCENE_CONFIG.panoramas.night;
      }
      return COZY_SCENE_CONFIG.panoramas.day;
    }
    const def = ROOM_STATES[state.roomState];
    const charFolder = state.petId === "yutu" ? "jade-rabbit" : "boon-koi";
    return `./living-room-dress/panoramas/${charFolder}/${def.fileKey}_${pd}.png`;
  }

  function syncPanoramaImage(immediate) {
    syncCustomStageBg();
    const nextUrl = resolveTargetPanoramaUrl();
    if (nextUrl === currentPanoUrl) return;
    const token = ++panoReqToken;
    if (immediate || REDUCED_MOTION) {
      currentPanoUrl = nextUrl;
      panoCurrEl.src = nextUrl;
      panoPrevEl.hidden = true;
      return;
    }
    panoPreloadEl.onload = () => {
      if (token !== panoReqToken) return;
      panoPrevEl.src = currentPanoUrl;
      panoPrevEl.hidden = false;
      panoPrevEl.classList.remove("world-panorama-bg--previous-fading");
      void panoPrevEl.offsetWidth;
      currentPanoUrl = nextUrl;
      panoCurrEl.src = nextUrl;
      panoPrevEl.classList.add("world-panorama-bg--previous-fading");
    };
    panoPreloadEl.src = nextUrl;
  }
  panoPrevEl.addEventListener("animationend", () => {
    panoPrevEl.hidden = true;
    panoPrevEl.classList.remove("world-panorama-bg--previous-fading");
  });

  /* ---------- 12. 完整原版 PetStage WebGL 渲染引擎（含锦鲤毛绒眼皮 Shader + 四情绪面部重绘） ---------- */
  const DPR = Math.min(2.0, window.devicePixelRatio || 1);
  glCanvas.width = Math.round(GL_LOGICAL_W * DPR);
  glCanvas.height = Math.round(GL_LOGICAL_H * DPR);
  const gl = glCanvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: true, preserveDrawingBuffer: true });

  const vsSrc = "attribute vec2 aPos; attribute vec2 aUv; varying vec2 vUv; void main(){ vUv = aUv; gl_Position = vec4(aPos.x / 1411.5 - 1.0, 1.0 - aPos.y / 836.0, 0.0, 1.0); }";
  const fsBodySrc =
    "precision mediump float; varying vec2 vUv; uniform sampler2D t0; uniform sampler2D t1; uniform sampler2D t2;" +
    "uniform float w1; uniform float w2; uniform float uEye; uniform vec4 uEyeL; uniform vec4 uEyeR; uniform vec3 uEnvTint;" +
    "float gate(float w){ w = clamp(w, 0.0, 1.0); return 1.0 - pow(1.0 - w, 2.6); }" +
    "vec3 eyeLid(vec2 uv, vec4 eye, float w){" +
    "  if (w <= 0.004) return vec3(0.0); vec2 d = (uv - eye.xy) / eye.zw; float rad = length(d); if (rad > 1.20) return vec3(0.0);" +
    "  float mask = smoothstep(1.16, 0.78, rad); float curve = mix(-0.12, 0.26, w);" +
    "  float lidY = mix(-1.12, 0.34, w) - curve * (d.x * d.x); float lowY = mix(1.22, 0.34, smoothstep(0.25, 1.0, w)) - curve * (d.x * d.x);" +
    "  float cover = clamp(max(smoothstep(lidY + 0.12, lidY - 0.08, d.y), smoothstep(lowY - 0.12, lowY + 0.08, d.y)), 0.0, 1.0) * mask;" +
    "  float xTaper = smoothstep(0.78, 0.28, abs(d.x)); float thick = mix(0.05, 0.09, w) * xTaper;" +
    "  float line = (1.0 - smoothstep(thick * 0.45, thick + 0.045, abs(d.y - lidY))) * xTaper * smoothstep(0.10, 0.30, w) * mask;" +
    "  float castSh = smoothstep(0.30, 0.0, d.y - lidY) * smoothstep(-0.04, 0.06, d.y - lidY) * (1.0 - w * 0.78) * 0.28 * xTaper * mask;" +
    "  return vec3(cover, clamp(line + castSh * (1.0 - cover), 0.0, 1.0), 1.0 + clamp(-0.045 * d.x - 0.055 * d.y, -0.09, 0.07));" +
    "}" +
    "vec4 happyEye(vec2 uv, vec4 eye, float w){" +
    "  if (w <= 0.004) return vec4(0.0, 0.0, 0.0, 1.0); vec2 d = (uv - eye.xy) / eye.zw; float rad = length(d); if (rad > 1.20) return vec4(0.0, 0.0, 0.0, 1.0);" +
    "  float mask = smoothstep(1.16, 0.78, rad); float xTaper = smoothstep(0.68, 0.22, abs(d.x)); float yArc = -0.20 + 0.62 * (d.x * d.x); float thick = 0.042 + 0.068 * xTaper;" +
    "  float stroke = (1.0 - smoothstep(thick * 0.48, thick + 0.036, abs(d.y - yArc))) * xTaper * w * mask;" +
    "  float dropSh = (1.0 - smoothstep(thick * 0.55, thick + 0.09, abs(d.y - (yArc + 0.065)))) * xTaper * w * mask * 0.34;" +
    "  float sh = 1.0 + clamp(-0.045 * d.x - 0.055 * d.y, -0.09, 0.07);" +
    "  return vec4(mask * w, stroke, dropSh, sh);" +
    "}" +
    "void main(){" +
    "  vec4 a = texture2D(t0, vUv); vec4 col;" +
    "  if (uEye > 0.5) {" +
    "    col = a; float c2 = clamp(w2, 0.0, 1.0); float c1 = clamp(w1, 0.0, 1.0);" +
    "    if (c2 > 0.004 || c1 > 0.004) {" +
    "      vec4 plush = texture2D(t2, vUv); vec3 furRgb = plush.rgb / max(plush.a, 0.001); vec3 rgb = col.rgb / max(col.a, 0.001);" +
    "      if (c2 > 0.004) {" +
    "        vec3 lL = eyeLid(vUv, uEyeL, c2); vec3 lR = eyeLid(vUv, uEyeR, c2);" +
    "        float cov = max(lL.x, lR.x); float sh = lL.x >= lR.x ? (lL.x > 0.001 ? lL.z : 1.0) : lR.z;" +
    "        rgb = mix(rgb, furRgb * sh, cov); rgb = mix(rgb, vec3(0.14, 0.115, 0.098), max(lL.y, lR.y));" +
    "      }" +
    "      if (c1 > 0.004) {" +
    "        vec4 hL = happyEye(vUv, uEyeL, c1); vec4 hR = happyEye(vUv, uEyeR, c1);" +
    "        float covH = max(hL.x, hR.x); float shH = hL.x >= hR.x ? (hL.x > 0.001 ? hL.w : 1.0) : hR.w;" +
    "        rgb = mix(rgb, furRgb * shH, covH); rgb = mix(rgb, vec3(0.45, 0.38, 0.31), max(hL.z, hR.z)); rgb = mix(rgb, vec3(0.14, 0.115, 0.098), max(hL.y, hR.y));" +
    "      }" +
    "      col = vec4(rgb * col.a, col.a);" +
    "    }" +
    "  } else {" +
    "    vec4 b = texture2D(t1, vUv); vec4 c = texture2D(t2, vUv);" +
    "    float c1 = gate(w1); float c2 = gate(w2); float s = c1 + c2; if (s > 1.0) { c1 /= s; c2 /= s; }" +
    "    col = a * (1.0 - c1 - c2) + b * c1 + c * c2;" +
    "  }" +
    "  gl_FragColor = vec4(col.rgb * uEnvTint, col.a);" +
    "}";
  const fsFaceSrc = "precision mediump float; varying vec2 vUv; uniform sampler2D tF; uniform float uA; uniform vec3 uEnvTint; void main(){ vec4 c = texture2D(tF, vUv) * uA; gl_FragColor = vec4(c.rgb * uEnvTint, c.a); }";

  function compileSh(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; }
  const prog = gl.createProgram();
  gl.attachShader(prog, compileSh(gl.VERTEX_SHADER, vsSrc));
  gl.attachShader(prog, compileSh(gl.FRAGMENT_SHADER, fsBodySrc));
  gl.linkProgram(prog);

  const progF = gl.createProgram();
  gl.attachShader(progF, compileSh(gl.VERTEX_SHADER, vsSrc));
  gl.attachShader(progF, compileSh(gl.FRAGMENT_SHADER, fsFaceSrc));
  gl.linkProgram(progF);

  const loc = {
    aPos: gl.getAttribLocation(prog, "aPos"), aUv: gl.getAttribLocation(prog, "aUv"),
    t0: gl.getUniformLocation(prog, "t0"), t1: gl.getUniformLocation(prog, "t1"), t2: gl.getUniformLocation(prog, "t2"),
    w1: gl.getUniformLocation(prog, "w1"), w2: gl.getUniformLocation(prog, "w2"),
    uEye: gl.getUniformLocation(prog, "uEye"), uEyeL: gl.getUniformLocation(prog, "uEyeL"), uEyeR: gl.getUniformLocation(prog, "uEyeR"),
    uEnvTint: gl.getUniformLocation(prog, "uEnvTint")
  };
  const locF = {
    aPos: gl.getAttribLocation(progF, "aPos"), aUv: gl.getAttribLocation(progF, "aUv"),
    tF: gl.getUniformLocation(progF, "tF"), uA: gl.getUniformLocation(progF, "uA"),
    uEnvTint: gl.getUniformLocation(progF, "uEnvTint")
  };

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.viewport(0, 0, glCanvas.width, glCanvas.height);

  const bodyIdx = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const a = r * (COLS + 1) + c, b = a + 1, d = a + COLS + 1, e = d + 1;
    bodyIdx.push(a, d, b, b, d, e);
  }
  const bodyIdxBuf = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bodyIdxBuf);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(bodyIdx), gl.STATIC_DRAW);

  const texCache = new Map();
  const imgCache = new Map();
  function loadTex(rawPath) {
    const url = sharedUrl(rawPath);
    if (texCache.has(url)) return Promise.resolve(texCache.get(url));
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        texCache.set(url, t);
        imgCache.set(url, img);
        resolve(t);
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  function makeSubGrid(rect) {
    const nv = (ACC_COLS + 1) * (ACC_ROWS + 1);
    const rest = new Float32Array(nv * 2), uv = new Float32Array(nv * 2), pos = new Float32Array(nv * 2);
    for (let r = 0, i = 0; r <= ACC_ROWS; r++) for (let c = 0; c <= ACC_COLS; c++, i++) {
      const u = c / ACC_COLS, v = r / ACC_ROWS;
      rest[i * 2] = rect.x + u * rect.w; rest[i * 2 + 1] = rect.y + v * rect.h;
      uv[i * 2] = u; uv[i * 2 + 1] = v;
    }
    const idx = [];
    for (let r = 0; r < ACC_ROWS; r++) for (let c = 0; c < ACC_COLS; c++) {
      const a = r * (ACC_COLS + 1) + c, b = a + 1, d = a + ACC_COLS + 1, e = d + 1;
      idx.push(a, d, b, b, d, e);
    }
    const uvBuf = gl.createBuffer(), posBuf = gl.createBuffer(), idxBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf); gl.bufferData(gl.ARRAY_BUFFER, uv, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf); gl.bufferData(gl.ARRAY_BUFFER, pos, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
    return { rest, uv, pos, nv, idxLen: idx.length, uvBuf, posBuf, idxBuf };
  }

  const petRuntimes = {};
  async function initPet(petId) {
    if (petRuntimes[petId]) return petRuntimes[petId];
    const pCfg = catalog.pets[petId];
    const rest = new Float32Array(NV * 2), uv = new Float32Array(NV * 2), pos = new Float32Array(NV * 2);
    for (let r = 0, i = 0; r <= ROWS; r++) for (let c = 0; c <= COLS; c++, i++) {
      const u = c / COLS, v = r / ROWS;
      rest[i * 2] = u * pCfg.canvasW; rest[i * 2 + 1] = v * pCfg.canvasH;
      uv[i * 2] = u; uv[i * 2 + 1] = v;
    }
    const uvBuf = gl.createBuffer(), posBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf); gl.bufferData(gl.ARRAY_BUFFER, uv, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf); gl.bufferData(gl.ARRAY_BUFFER, pos, gl.DYNAMIC_DRAW);

    const promises = [loadTex(pCfg.textures.base), loadTex(pCfg.textures.doze)];
    if (!pCfg.useEyeShader && pCfg.textures.closed) promises.push(loadTex(pCfg.textures.closed));
    const loaded = await Promise.all(promises);
    const tBase = loaded[0], tDoze = loaded[1], tClosed = loaded[2] || tBase;

    const hitCanvas = document.createElement("canvas");
    hitCanvas.width = pCfg.canvasW; hitCanvas.height = pCfg.canvasH;
    const hitCtx = hitCanvas.getContext("2d", { willReadFrequently: true });
    hitCtx.drawImage(imgCache.get(sharedUrl(pCfg.textures.base)), 0, 0, pCfg.canvasW, pCfg.canvasH);

    const faceCfg = EMO_FACES[petId];
    const fr = faceCfg.rect;
    const rt = {
      id: petId,
      cfg: Object.assign({}, pCfg, { baseScale: petId === "yutu" ? 0.565 : 0.725 }),
      rest, uv, pos, uvBuf, posBuf, hitCtx,
      defaultTex: { base: tBase, closed: tClosed, doze: tDoze },
      setTexMap: {},
      faceCfg,
      faceGrid: makeSubGrid({ x: fr[0], y: fr[1], w: fr[2] - fr[0], h: fr[3] - fr[1] }),
      faceTexCache: {},
      emoKeyCache: {}
    };
    petRuntimes[petId] = rt;
    if (state.savedSet[petId]) await ensureSetLoaded(rt, state.savedSet[petId]);

    // 预热前 4 套常用装扮，点击零等待
    setTimeout(() => {
      (pCfg.items || []).slice(0, 4).forEach((it) => { ensureSetLoaded(rt, it.id).catch(() => {}); });
    }, 450);
    return rt;
  }

  async function ensureSetLoaded(rt, setId) {
    if (!setId || rt.setTexMap[setId]) return rt.setTexMap[setId];
    const item = rt.cfg.items.find((x) => x.id === setId);
    if (!item) return null;
    if (rt.cfg.useEyeShader) {
      const tBase = await loadTex(item.tex);
      const entry = { base: tBase, closed: tBase, doze: rt.defaultTex.doze, eyeLUV: item.eyeLUV || rt.cfg.eyeLUV, eyeRUV: item.eyeRUV || rt.cfg.eyeRUV };
      rt.setTexMap[setId] = entry;
      return entry;
    }
    const [tBase, tClosed, tDoze] = await Promise.all([
      loadTex(item.tex),
      item.closedTex ? loadTex(item.closedTex) : Promise.resolve(rt.defaultTex.closed),
      item.dozeTex ? loadTex(item.dozeTex) : Promise.resolve(rt.defaultTex.doze)
    ]);
    const entry = { base: tBase, closed: tClosed, doze: tDoze };
    rt.setTexMap[setId] = entry;
    return entry;
  }

  // 原版 PetStage 面部表情贴图绘制（含锦鲤大笑擦除嘴巴、弯月笑眼、悲伤阴云、思考转眼珠）
  function getFaceOverlayTex(rt, id) {
    if (rt.faceTexCache[id] !== undefined) return rt.faceTexCache[id];
    const faceCfg = rt.faceCfg;
    const FR = faceCfg.rect, FW = FR[2] - FR[0], FH = FR[3] - FR[1];
    const cv = document.createElement("canvas"); cv.width = FW; cv.height = FH;
    const c = cv.getContext("2d"); c.translate(-FR[0], -FR[1]);

    const S = rt.cfg.scale || 0.35;
    const CX = rt.cfg.cx;
    const hitCtx = rt.hitCtx;
    const lw = (px) => px / S;
    const sampleAvg = (x, y, w, h) => {
      const d = hitCtx.getImageData(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h))).data;
      let r = 0, g = 0, b = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 200 || (d[i] + d[i + 1] + d[i + 2]) / 3 < 120) continue;
        r += d[i]; g += d[i + 1]; b += d[i + 2]; n++;
      }
      return n ? [r / n | 0, g / n | 0, b / n | 0] : [232, 226, 216];
    };
    const rgb = (col) => `rgb(${col[0]},${col[1]},${col[2]})`;
    const eyeClip = (ctx, e) => { ctx.beginPath(); ctx.ellipse(e.ex, e.ey, e.erx, e.ery, 0, 0, Math.PI * 2); ctx.clip(); };
    const coverPupil = (ctx, e) => {
      const top = sampleAvg(e.x - 8, e.y - e.r - 10, 16, 5);
      const bot = sampleAvg(e.x - 8, e.y + e.r + 5, 16, 5);
      const mid = sampleAvg(e.x + (e.x < CX ? -e.r - 9 : e.r + 4), e.y - 6, 5, 12);
      ctx.save(); eyeClip(ctx, e);
      const g = ctx.createLinearGradient(0, e.y - e.r - 4, 0, e.y + e.r + 4);
      g.addColorStop(0, rgb(top)); g.addColorStop(0.5, rgb(mid)); g.addColorStop(1, rgb(bot));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    };
    const movePupil = (ctx, e, dx, dy) => {
      coverPupil(ctx, e);
      const R = e.r + 3;
      ctx.save(); eyeClip(ctx, e);
      ctx.beginPath(); ctx.arc(e.x + dx, e.y + dy, e.r + 2, 0, Math.PI * 2); ctx.clip();
      ctx.drawImage(hitCtx.canvas, e.x - R, e.y - R, 2 * R, 2 * R, e.x - R + dx, e.y - R + dy, 2 * R, 2 * R);
      ctx.restore();
    };
    const eraseMouth = (ctx) => {
      const m = faceCfg.eraseMouth; if (!m) return;
      const w = m.x1 - m.x0, h = m.y1 - m.y0, tc = document.createElement("canvas");
      tc.width = w; tc.height = h;
      const t = tc.getContext("2d");
      t.filter = "blur(5px)"; t.lineCap = "round"; t.lineWidth = 26; t.strokeStyle = "#000"; t.fillStyle = "#000";
      t.beginPath(); t.moveTo(16, 17); t.quadraticCurveTo(w / 2, h - 4, w - 18, 14); t.stroke();
      t.beginPath(); t.ellipse(w / 2, h * 0.5, w * 0.36, h * 0.32, 0, 0, Math.PI * 2); t.fill();
      t.filter = "none"; t.globalCompositeOperation = "source-in";
      t.drawImage(hitCtx.canvas, m.x0, m.y0 + m.dy, w, h, 0, 0, w, h);
      ctx.drawImage(tc, m.x0, m.y0);
    };
    const stroke = (ctx, color, wStage, fn) => {
      ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = lw(wStage); ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath(); fn(ctx); ctx.stroke(); ctx.restore();
    };
    const INK = "rgba(52,38,32,.92)";
    const dMouth = (ctx, m) => {
      const x0 = m.x - m.w / 2, x1 = m.x + m.w / 2, y0 = m.y - m.h / 2;
      const path = () => {
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(m.x, y0 - m.h * 0.08, x1, y0);
        ctx.bezierCurveTo(x1, y0 + m.h * 0.9, m.x + m.w * 0.22, y0 + m.h * 1.08, m.x, y0 + m.h * 1.08);
        ctx.bezierCurveTo(m.x - m.w * 0.22, y0 + m.h * 1.08, x0, y0 + m.h * 0.9, x0, y0); ctx.closePath();
      };
      ctx.save(); path(); ctx.fillStyle = "#5b2a26"; ctx.fill(); ctx.clip();
      ctx.fillStyle = "#ff8f8f"; ctx.beginPath(); ctx.ellipse(m.x, y0 + m.h * 1.0, m.w * 0.3, m.h * 0.42, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.save(); path(); ctx.strokeStyle = "#3a1c18"; ctx.lineWidth = lw(1.3); ctx.lineJoin = "round"; ctx.stroke(); ctx.restore();
    };
    const brows = (ctx, kind, side) => {
      faceCfg.eyes.forEach((e) => {
        const isL = e.x < CX, inner = isL ? 1 : -1, L = faceCfg.browLen, bx = e.ex, by = e.ey - e.ery - faceCfg.browGap;
        stroke(ctx, "rgba(78,60,50,.88)", 2.1, (cc) => {
          if (kind === "sad") {
            cc.moveTo(bx - inner * L * 0.5, by + L * 0.12); cc.quadraticCurveTo(bx, by + L * 0.02, bx + inner * L * 0.5, by - L * 0.28);
          } else {
            const up = (isL ? -1 : 1) === side;
            if (up) { cc.moveTo(bx - L * 0.5, by - L * 0.05); cc.quadraticCurveTo(bx, by - L * 0.42, bx + L * 0.5, by - L * 0.05); }
            else { cc.moveTo(bx - L * 0.45, by + L * 0.1); cc.lineTo(bx + L * 0.45, by + L * 0.06); }
          }
        });
      });
    };

    if (id === "laughEyes") {
      if (faceCfg.closedTex) { rt.faceTexCache[id] = false; return false; }
      faceCfg.eyes.forEach((e) => {
        coverPupil(c, e);
        stroke(c, INK, 2.6, (cc) => { cc.moveTo(e.x - e.r * 0.95, e.y + e.r * 0.3); cc.quadraticCurveTo(e.x, e.y - e.r * 0.95, e.x + e.r * 0.95, e.y + e.r * 0.3); });
      });
    } else if (id === "laugh") {
      eraseMouth(c); dMouth(c, faceCfg.mouth);
    } else if (id === "sad") {
      brows(c, "sad");
      const g = faceCfg.gloom;
      for (let i = 0; i < 4; i++) {
        const x = g.x + ((i - 1.5) * g.w) / 3, h = g.h * (i % 2 ? 0.8 : 1);
        const gr = c.createLinearGradient(0, g.y, 0, g.y + h);
        gr.addColorStop(0, "rgba(96,124,210,.78)"); gr.addColorStop(1, "rgba(96,124,210,0)");
        stroke(c, gr, 1.5, (cc) => { cc.moveTo(x, g.y); cc.lineTo(x, g.y + h); });
      }
      if (faceCfg.eraseMouth) {
        eraseMouth(c); const m = faceCfg.mouth, w = m.w * 0.36;
        stroke(c, INK, 2.2, (cc) => { cc.moveTo(m.x - w, m.y + 6); cc.quadraticCurveTo(m.x, m.y - 12, m.x + w, m.y + 6); });
      }
    } else if (id === "thinkL" || id === "thinkR") {
      const side = id === "thinkL" ? -1 : 1;
      brows(c, "think", side);
      faceCfg.eyes.forEach((e) => movePupil(c, e, faceCfg.lookUp[0] * side, faceCfg.lookUp[1]));
      if (faceCfg.eraseMouth) {
        eraseMouth(c); const m = faceCfg.mouth, w = m.w * 0.3;
        stroke(c, INK, 2.1, (cc) => {
          for (let i = 0; i <= 24; i++) {
            const t = i / 24, x = m.x - w + 2 * w * t, y = m.y + Math.sin(t * Math.PI * 4) * 4.5;
            if (i) cc.lineTo(x, y); else cc.moveTo(x, y);
          }
        });
      }
    } else if (id === "cute") {
      if (faceCfg.closedTex) { rt.faceTexCache[id] = false; return false; }
      faceCfg.eyes.forEach((e) => {
        coverPupil(c, e); const d = e.x < CX ? 1 : -1, r = e.r;
        stroke(c, INK, 2.6, (cc) => { cc.moveTo(e.x - d * r * 0.7, e.y - r * 0.62); cc.lineTo(e.x + d * r * 0.62, e.y); cc.lineTo(e.x - d * r * 0.7, e.y + r * 0.62); });
      });
      eraseMouth(c); const m = faceCfg.mouth, r = m.w * 0.13;
      stroke(c, INK, 2.2, (cc) => { cc.moveTo(m.x - 2 * r, m.y - 2); cc.quadraticCurveTo(m.x - r, m.y + r * 1.6, m.x, m.y - 2); cc.quadraticCurveTo(m.x + r, m.y + r * 1.6, m.x + 2 * r, m.y - 2); });
    }

    const t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.activeTexture(gl.TEXTURE0);
    rt.faceTexCache[id] = t;
    return t;
  }

  /* ---------- 13. 网格形变、四情绪节拍粒子与全姿态状态机 ---------- */
  const KEYS = ["hopY", "rot", "sx", "sy", "breath", "headRot", "headTx", "headTy", "earL", "earR", "lean", "wClosed", "wDoze", "shS", "shO"];
  function makePose(o) {
    const p = { hopY: 0, rot: 0, sx: 1, sy: 1, breath: 0, headRot: 0, headTx: 0, headTy: 0, earL: 0, earR: 0, lean: 0, wClosed: 0, wDoze: 0, shS: 1, shO: 1 };
    if (o) for (const k in o) if (Object.prototype.hasOwnProperty.call(o, k)) p[k] = o[k];
    return p;
  }
  function mixPose(a, b, t) { const p = makePose(); KEYS.forEach((k) => { p[k] = lerp(a[k], b[k], t); }); return p; }
  function kf(list, u) {
    const cu = clamp(u, 0, 1); let a = list[0], b = list[list.length - 1];
    for (let i = 1; i < list.length; i++) if (cu <= list[i].o) { a = list[i - 1]; b = list[i]; break; }
    let t = clamp((cu - a.o) / ((b.o - a.o) || 1), 0, 1);
    t = a.e === "out" ? easeOutCubic(t) : a.e === "in" ? t * t * t : a.e === "back" ? easeOutBack(t) : a.e === "io" ? easeInOut(t) : t;
    return mixPose(makePose(a), makePose(b), t);
  }

  function deformVertex(cfg, x, y, p, eL, eR) {
    const h = cfg.head;
    const hd = Math.sqrt(Math.pow((x - h.x) / h.rx, 2) + Math.pow((y - h.y) / h.ry, 2));
    const earTop = cfg.id === "yutu" ? cfg.earL.y + 82 : cfg.earL.y + 24;
    const earBot = cfg.id === "yutu" ? cfg.earL.y - 18 : cfg.earL.y - 70;
    const out = sstep(0.9, 1.04, hd) * sstep(earTop, earBot, y);
    if (out > 0) {
      const side = sstep(cfg.cx - 30, cfg.cx + 30, x);
      const piv = side < 0.5 ? cfg.earL : cfg.earR;
      const span = cfg.id === "yutu" ? 330 : 80;
      const along = clamp((piv.y - y) / span, 0, 1);
      const ang = lerp(eL, eR, side) * out * (0.55 + 0.45 * along) * (cfg.earAmp || 1);
      const r = rot2d(x, y, piv.x, piv.y, ang); x = r[0]; y = r[1];
    }
    const bSpan = cfg.id === "yutu" ? 140 : h.ry * 0.9;
    x += (x - cfg.cx) * p.breath * Math.exp(-Math.pow((y - cfg.bodyY) / bSpan, 2));

    const wBody = cfg.id === "yutu" ? sstep(cfg.neck.y - 68, cfg.neck.y + 72, y) : sstep(cfg.neck.y - 70, cfg.neck.y + 24, y);
    const neckY = cfg.feetY + (cfg.neck.y - cfg.feetY) * p.sy;
    const feetPin = cfg.id === "yutu" ? sstep(cfg.feetY - 145, cfg.feetY - 25, y) : sstep(cfg.feetY - 130, cfg.feetY - 12, y);
    const kx = lerp(p.sx, 1 + (p.sx - 1) * 0.12, 1 - wBody);
    x = cfg.cx + (x - cfg.cx) * lerp(kx, 1 + (kx - 1) * 0.4, feetPin);
    y = lerp(y + (neckY - cfg.neck.y), cfg.feetY + (y - cfg.feetY) * p.sy, wBody);

    const wh = cfg.id === "yutu" ? sstep(cfg.neck.y + 152, cfg.neck.y - 48, y) : sstep(cfg.neck.y + 36, cfg.neck.y - 80, y);
    if (wh > 0) {
      const r = rot2d(x, y, cfg.neck.x, neckY, p.headRot * wh);
      x = r[0] + p.headTx * wh; y = r[1] + p.headTy * wh;
    }
    const leanAmp = cfg.id === "yutu" ? 20 : 16;
    const leanTop = cfg.id === "yutu" ? cfg.neck.y - 108 : h.y;
    x += p.lean * leanAmp * sstep(cfg.feetY, leanTop, y);
    return [x, y];
  }

  let petPos = { x: CORK_HOME.x, y: CORK_HOME.y };
  let hopMove = null;
  const spring = { r: 0, vr: 0, y: 0, vy: 0, t: -1 };
  let animMode = "idle", modeT0 = performance.now(), nextBlinkAt = modeT0 + 2200, sleepAt = modeT0 + 7500;
  let lastPose = makePose(), blendFrom = null, blendUntil = 0, petLean = 0, scrubLean = 0;
  const emo = { kind: null, side: 1, t0: 0, u: 0, beat: 0, last: null };

  const JUMP_KFS = [
    { o: 0, e: "in", sx: 1, sy: 1 },
    { o: 0.13, e: "out", sx: 1.10, sy: 0.84, earL: -10, earR: 10, shS: 1.15 },
    { o: 0.24, e: "out", sx: 0.93, sy: 1.10, hopY: -65, earL: -22, earR: 22, rot: -1.5, shS: 0.9 },
    { o: 0.44, e: "in", sx: 1.0, sy: 1.02, hopY: -165, earL: -4, earR: 4, rot: 1.5, shS: 0.72, shO: 0.55 },
    { o: 0.70, e: "out", sx: 0.95, sy: 1.07, hopY: -45, earL: 8, earR: -8, rot: -1 },
    { o: 0.80, e: "back", sx: 1.13, sy: 0.84, hopY: 0, earL: -20, earR: 20, shS: 1.18 },
    { o: 0.90, e: "io", sx: 0.97, sy: 1.04, earL: 6, earR: -6 },
    { o: 1, e: "out", sx: 1, sy: 1 }
  ];
  const MINI_KFS = [
    { o: 0, e: "in", hopY: 0, sx: 1, sy: 1, shS: 1, shO: 1 },
    { o: 0.18, e: "out", hopY: 6, sx: 1.08, sy: 0.9, shS: 1.12, shO: 0.9 },
    { o: 0.42, e: "out", hopY: -72, sx: 0.96, sy: 1.06, earL: -10, earR: 10, shS: 0.7, shO: 0.5 },
    { o: 0.78, e: "back", hopY: 4, sx: 1.08, sy: 0.9, shS: 1.12, shO: 0.88 },
    { o: 1, e: "out", hopY: 0, sx: 1, sy: 1, shS: 1, shO: 1 }
  ];
  const EAT_KFS = [
    { o: 0, e: "out", sx: 1, sy: 1, wClosed: 0 },
    { o: 0.14, e: "io", sx: 1.09, sy: 0.91, headTy: 5, headRot: -4, wClosed: 0.95, earL: -10, earR: 10, shS: 1.09 },
    { o: 0.30, e: "io", sx: 0.96, sy: 1.06, headTy: -3, headRot: 4, wClosed: 1, earL: 5, earR: -5, hopY: -16 },
    { o: 0.46, e: "io", sx: 1.09, sy: 0.91, headTy: 5, headRot: -4, wClosed: 1, earL: -10, earR: 10, shS: 1.09 },
    { o: 0.64, e: "io", sx: 0.96, sy: 1.07, headTy: -4, headRot: 3, wClosed: 1, earL: 6, earR: -6, hopY: -28 },
    { o: 0.82, e: "back", sx: 1.05, sy: 0.95, headTy: 1, headRot: 0, wClosed: 0.55, hopY: 0 },
    { o: 1, e: "out", sx: 1, sy: 1, wClosed: 0 }
  ];

  function deskDepthScale(y) {
    if (isFittingOpen || isCustomBgActive()) return 1.04;
    return lerp(0.88, 1.05, clamp((y - 1020) / 360, 0, 1));
  }
  function isWebGLActive() {
    return isFittingOpen || state.roomState === "free_stand";
  }

  function startAnim(nextMode, now) {
    blendFrom = Object.assign({}, lastPose);
    blendUntil = now + 140;
    animMode = nextMode;
    modeT0 = now;
    sleepAt = now + 7500;
    if (nextMode !== "doze") sleepZzEl.hidden = true;
  }

  function getEmoKeys(rt, kind, s) {
    const key = `${rt.id}:${kind}${s > 0 ? "+" : "-"}`;
    if (!rt.emoKeyCache[key]) {
      const fc = rt.faceCfg;
      rt.emoKeyCache[key] = EMO_DEFS[kind].keys(s).map((k) => {
        const cp = Object.assign({}, k);
        if (fc.stalk) {
          const v = (cp.stalk || 0) * (fc.stalkK || 1.5);
          cp.earL = v; cp.earR = v;
        }
        if (!fc.closedTex && cp.wClosed) cp.wClosed = 0;
        return cp;
      });
    }
    return rt.emoKeyCache[key];
  }

  function computeEmotePose(rt, kind, u, s, ms) {
    const def = EMO_DEFS[kind];
    const list = getEmoKeys(rt, kind, s);
    const p = kf(list, u);
    if (def.lag && !rt.faceCfg.stalk) {
      for (const k in def.lag) p[k] = kf(list, u - def.lag[k])[k];
    }
    if (def.add) {
      const a = def.add(u, ms, s);
      for (const k in a) {
        if (k === "stalk") {
          if (rt.faceCfg.stalk) { p.earL += a[k] * rt.faceCfg.stalkK; p.earR += a[k] * rt.faceCfg.stalkK; }
        } else p[k] += a[k];
      }
    }
    return p;
  }

  function petCanvasPtToBoxPx(rt, cxPt, cyPt, pose) {
    const cfg = rt.cfg;
    const S = cfg.baseScale * deskDepthScale(petPos.y);
    const OX = petPos.x - cfg.cx * S;
    const OY = petPos.y - cfg.feetY * S;
    const cr = Math.cos((pose.rot * Math.PI) / 180), sr = Math.sin((pose.rot * Math.PI) / 180);
    const d = deformVertex(cfg, cxPt, cyPt, pose, 0, 0);
    const dx = d[0] - cfg.cx, dy = d[1] - cfg.feetY;
    const px = OX + (cfg.cx + dx * cr - dy * sr) * S;
    const py = OY + (cfg.feetY + dx * sr + dy * cr) * S + pose.hopY;
    return [px * geom.panoScale, py * geom.panoScale];
  }

  let fxUidSeq = 0;
  function buildFxSvg(kind) {
    const uid = ++fxUidSeq;
    if (kind === "heart") {
      return `<svg class="emo-fx-svg emo-fx-svg--heart" viewBox="0 0 40 40" width="28" height="28" aria-hidden="true">
        <defs>
          <radialGradient id="fxH${uid}" cx="34%" cy="28%" r="72%">
            <stop offset="0%" stop-color="#FFD4DE"/>
            <stop offset="46%" stop-color="#F27E98"/>
            <stop offset="100%" stop-color="#C9526D"/>
          </radialGradient>
        </defs>
        <path d="M20 34.2 C18.8 33.2 6.2 24.4 6.2 14.8 C6.2 9.9 10.1 6.2 14.8 6.2 C17.6 6.2 19.3 7.6 20 9.1 C20.7 7.6 22.4 6.2 25.2 6.2 C29.9 6.2 33.8 9.9 33.8 14.8 C33.8 24.4 21.2 33.2 20 34.2 Z" fill="url(#fxH${uid})" stroke="#FFFBF5" stroke-width="2.2" stroke-linejoin="round"/>
        <ellipse cx="13.8" cy="12.6" rx="3.4" ry="2.0" transform="rotate(-28 13.8 12.6)" fill="#FFF7F9" opacity="0.88"/>
        <circle cx="11.4" cy="16.2" r="1.15" fill="#FFF7F9" opacity="0.72"/>
      </svg>`;
    }
    if (kind === "star") {
      return `<svg class="emo-fx-svg emo-fx-svg--star" viewBox="0 0 40 40" width="26" height="26" aria-hidden="true">
        <defs>
          <radialGradient id="fxS${uid}" cx="36%" cy="32%" r="70%">
            <stop offset="0%" stop-color="#FFF9DF"/>
            <stop offset="50%" stop-color="#F5C34B"/>
            <stop offset="100%" stop-color="#D48E1F"/>
          </radialGradient>
        </defs>
        <path d="M20 4.5 C21.4 13.4 26.6 18.6 35.5 20 C26.6 21.4 21.4 26.6 20 35.5 C18.6 26.6 13.4 21.4 4.5 20 C13.4 18.6 18.6 13.4 20 4.5 Z" fill="url(#fxS${uid})" stroke="#FFFDF6" stroke-width="2" stroke-linejoin="round"/>
        <circle cx="18.2" cy="17.5" r="2.2" fill="#FFFFFF" opacity="0.82"/>
      </svg>`;
    }
    if (kind === "q") {
      return `<svg class="emo-fx-svg emo-fx-svg--q" viewBox="0 0 40 40" width="26" height="26" aria-hidden="true">
        <defs>
          <linearGradient id="fxQ${uid}" x1="20%" y1="10%" x2="80%" y2="95%">
            <stop offset="0%" stop-color="#9CBBE6"/>
            <stop offset="55%" stop-color="#6A8FC2"/>
            <stop offset="100%" stop-color="#4A6FA3"/>
          </linearGradient>
        </defs>
        <circle cx="20" cy="20" r="16" fill="#FCF8EF" stroke="#E5D7BF" stroke-width="1.8"/>
        <path d="M15.4 15.2 C15.4 12.2 17.6 10.4 20.3 10.4 C23.1 10.4 25.1 12.1 25.1 14.7 C25.1 17.1 23.3 18.3 21.4 19.4 C20.3 20.1 19.9 20.8 19.9 22.2" fill="none" stroke="url(#fxQ${uid})" stroke-width="3.6" stroke-linecap="round"/>
        <circle cx="20" cy="27.8" r="2.2" fill="url(#fxQ${uid})"/>
      </svg>`;
    }
    if (kind === "bang") {
      return `<svg class="emo-fx-svg emo-fx-svg--bang" viewBox="0 0 40 40" width="28" height="28" aria-hidden="true">
        <defs>
          <linearGradient id="fxB${uid}" x1="20%" y1="10%" x2="80%" y2="95%">
            <stop offset="0%" stop-color="#F7A17E"/>
            <stop offset="55%" stop-color="#E56F4A"/>
            <stop offset="100%" stop-color="#BE4B2A"/>
          </linearGradient>
        </defs>
        <circle cx="20" cy="20" r="16" fill="#FCF8EF" stroke="#E8D2BE" stroke-width="1.8"/>
        <line x1="20" y1="10.5" x2="20" y2="22.2" stroke="url(#fxB${uid})" stroke-width="4" stroke-linecap="round"/>
        <circle cx="20" cy="28" r="2.3" fill="url(#fxB${uid})"/>
      </svg>`;
    }
    if (kind === "tear") {
      return `<svg class="emo-fx-svg emo-fx-svg--tear" viewBox="0 0 24 32" width="14" height="19" aria-hidden="true">
        <defs>
          <radialGradient id="fxT${uid}" cx="36%" cy="58%" r="65%">
            <stop offset="0%" stop-color="#FFFFFF"/>
            <stop offset="45%" stop-color="#8FD0FA"/>
            <stop offset="100%" stop-color="#3E8ED0"/>
          </radialGradient>
        </defs>
        <path d="M12 2.5 C12 2.5 21 14.2 21 20.5 C21 25.5 17 29.5 12 29.5 C7 29.5 3 25.5 3 20.5 C3 14.2 12 2.5 12 2.5 Z" fill="url(#fxT${uid})" stroke="#F5FBFF" stroke-width="1.6"/>
        <ellipse cx="8.8" cy="18.8" rx="1.9" ry="3.4" transform="rotate(-14 8.8 18.8)" fill="#FFFFFF" opacity="0.85"/>
      </svg>`;
    }
    return "";
  }

  function spawnBeatFx(rt, b, s, pose) {
    if (REDUCED_MOTION) return;
    const fc = rt.faceCfg;
    const A = fc.anchors, cx = rt.cfg.cx;
    const topAnchor = (sd) => [cx + (A.top[0] - cx) * (sd || 1), A.top[1]];
    const anchor = (at, sd) => at === "L" ? A.L : at === "R" ? A.R : at === "S" ? (sd > 0 ? A.R : A.L) : topAnchor(sd);

    const n = document.createElement("div");
    n.className = "emo-beat-node";
    let src, frames, dur = 1050;
    if (b.fx === "haha") {
      src = anchor(b.at, s);
      const side = b.at === "L" ? -1 : 1;
      src = [src[0] + side * 14, src[1] - 10];
      n.classList.add("emo-beat-node--haha");
      n.textContent = b.t;
      const dx = side * 18;
      frames = [
        [0, 4, 0.35, 0, -6 * side],
        [dx * 0.45, -10, 1.12, 1, 2 * side],
        [dx * 0.85, -24, 1.0, 0.92, -2 * side],
        [dx, -36, 0.92, 0, 5 * side]
      ];
    } else if (b.fx === "tear") {
      const e = fc.eyes[b.eye]; const out = e.x < cx ? -1 : 1;
      src = [e.ex + out * e.erx * 0.55, e.ey + e.ery * 0.58];
      n.classList.add("emo-beat-node--tear");
      n.innerHTML = buildFxSvg("tear");
      dur = 980;
      frames = [
        [0, 0, 0.45, 0, 0],
        [out * 2, 10, 1.08, 1, out * -4],
        [out * 3.5, 22, 0.98, 0.9, out * 2],
        [out * 5, 34, 0.82, 0, 0]
      ];
    } else if (b.fx === "q") {
      src = b.flip ? (s > 0 ? A.L : A.R) : topAnchor(s);
      src = [src[0], src[1] - 14];
      n.classList.add("emo-beat-node--q");
      if (b.big) n.classList.add("is-big");
      n.innerHTML = buildFxSvg("q");
      dur = 1180;
      frames = [
        [0, 6, 0.25, 0, -16],
        [0, -8, 1.16, 1, 6],
        [3, -16, 1.0, 0.95, 2],
        [6, -26, 0.9, 0, 5]
      ];
    } else if (b.fx === "bang") {
      src = topAnchor(s);
      src = [src[0], src[1] - 16];
      n.classList.add("emo-beat-node--bang");
      n.innerHTML = buildFxSvg("bang");
      dur = 860;
      frames = [
        [0, 8, 0.2, 0, 0],
        [0, -8, 1.24, 1, 0],
        [0, -14, 1.02, 0.96, 0],
        [0, -22, 0.9, 0, 0]
      ];
    } else if (b.fx === "heart") {
      const d = b.at === "L" ? -1 : 1;
      const baseSrc = anchor(b.at, s);
      src = [baseSrc[0] + d * 20, baseSrc[1] - 18];
      n.classList.add("emo-beat-node--heart");
      n.innerHTML = buildFxSvg("heart");
      dur = 1320;
      frames = [
        [0, 6, 0.24, 0, -10 * d],
        [d * 8, -12, 1.18, 1, 8 * d],
        [d * 14, -30, 1.02, 0.92, -6 * d],
        [d * 10, -48, 0.86, 0, 4 * d]
      ];
    } else {
      const baseSrc = anchor(b.at, s);
      const d = b.at === "L" ? -1 : 1;
      src = [baseSrc[0] + d * 12, baseSrc[1] - 12];
      n.classList.add("emo-beat-node--star");
      n.innerHTML = buildFxSvg("star");
      dur = 1040;
      frames = [
        [0, 2, 0.2, 0, -20],
        [0, -6, 1.22, 1, 35],
        [0, -12, 0.96, 0.9, 95],
        [0, -18, 0.55, 0, 145]
      ];
    }
    const st = petCanvasPtToBoxPx(rt, src[0], src[1], pose);
    petFxHostEl.appendChild(n);
    if (typeof n.animate === "function") {
      const an = n.animate(frames.map((f, i) => ({
        transform: `translate(${(st[0] + f[0]).toFixed(1)}px,${(st[1] + f[1]).toFixed(1)}px) translate(-50%,-50%) scale(${f[2]}) rotate(${f[4]}deg)`,
        opacity: f[3],
        offset: i / (frames.length - 1)
      })), { duration: dur, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "forwards" });
      an.onfinish = () => n.remove();
    } else {
      setTimeout(() => n.remove(), dur);
    }
  }

  function triggerFullEmote(sideOverride, kindOverride) {
    const rt = petRuntimes[state.petId];
    if (!rt) return;
    const now = performance.now();
    const kinds = ["laugh", "sad", "think", "cute"].filter((k) => k !== emo.last);
    const chosen = kindOverride || kinds[Math.floor(Math.random() * kinds.length)];
    emo.kind = chosen;
    emo.last = chosen;
    emo.side = sideOverride || (Math.random() < 0.5 ? -1 : 1);
    emo.t0 = now;
    emo.u = 0;
    emo.beat = 0;
    startAnim("emote", now);
    const lines = rt.faceCfg.lines[chosen];
    showSceneFeedback(lines[Math.floor(Math.random() * lines.length)], "dialogue");
  }

  function computePose(rt, now) {
    if (hopMove) {
      const u = clamp((now - hopMove.t0) / hopMove.dur, 0, 1);
      petPos.x = lerp(hopMove.x0, hopMove.x1, easeInOut(u));
      petPos.y = lerp(hopMove.y0, hopMove.y1, easeInOut(u));
      const arc = Math.sin(u * Math.PI);
      const p = makePose({
        hopY: -arc * 108, sx: lerp(1.04, 0.95, arc), sy: lerp(0.96, 1.05, arc),
        rot: clamp((hopMove.x1 - hopMove.x0) * 0.018, -5, 5) * arc,
        shS: lerp(1, 0.74, arc), shO: lerp(1, 0.56, arc)
      });
      if (u >= 1) { hopMove = null; startAnim("idle", now); }
      return p;
    }

    const t = now - modeT0;
    if (animMode === "emote" && emo.kind) {
      const def = EMO_DEFS[emo.kind];
      if (t >= def.ms) {
        startAnim("idle", now);
      } else {
        emo.u = t / def.ms;
        const p = computeEmotePose(rt, emo.kind, emo.u, emo.side, t);
        while (emo.beat < def.beats.length && def.beats[emo.beat].u <= emo.u) {
          spawnBeatFx(rt, def.beats[emo.beat], emo.side, p);
          emo.beat++;
        }
        return p;
      }
    } else if (animMode === "jump") {
      if (t >= 1050) startAnim("idle", now);
      else return kf(JUMP_KFS, t / 1050);
    } else if (animMode === "minihop") {
      if (t >= 580) startAnim("idle", now);
      else return kf(MINI_KFS, t / 580);
    } else if (animMode === "eat") {
      if (t >= 1080) startAnim("idle", now);
      else return kf(EAT_KFS, t / 1080);
    } else if (animMode === "scrub") {
      const w = Math.sin((now / 210) * Math.PI * 2);
      return makePose({
        sx: 1.03 + 0.025 * w, sy: 0.97 - 0.025 * w,
        headRot: scrubLean * 8 + w * 4.5, headTx: scrubLean * 5, headTy: 4,
        rot: w * 1.8, earL: -9 + w * 6, earR: 9 - w * 6,
        lean: scrubLean * 0.75, wClosed: 0.92, wDoze: 0.92, shS: 1.05
      });
    } else if (animMode === "rinse") {
      if (t >= 960) startAnim("idle", now);
      else {
        const u = t / 960;
        if (u < 0.62) {
          const shk = Math.sin((u / 0.62) * Math.PI * 6), env = Math.sin((u / 0.62) * Math.PI);
          return makePose({
            sx: 1 + 0.06 * Math.abs(shk) * env, sy: 1 - 0.05 * Math.abs(shk) * env,
            rot: shk * 6.5 * env, headRot: shk * 12 * env,
            earL: -18 * shk * env, earR: 18 * shk * env, wClosed: 0.85 * env, shS: 1.08
          });
        }
        return kf(MINI_KFS, (u - 0.62) / 0.38);
      }
    } else if (animMode === "pet") {
      return makePose({ sx: 1.04, sy: 0.96, headRot: petLean * 9, headTx: petLean * 6, headTy: 5, earL: -8 + petLean * 4, earR: 8 + petLean * 4, lean: petLean, wClosed: 1, wDoze: 1, shS: 1.06 });
    } else if (animMode === "doze") {
      const b = Math.sin((now / 4400) * Math.PI * 2);
      const isKoi = rt.id === "koi";
      if (isNightSleepingNow() || state.roomState !== "free_stand") {
        sleepZzEl.hidden = true;
      } else {
        sleepZzEl.hidden = false;
        const topPt = petCanvasPtToBoxPx(rt, rt.cfg.cx + 90, rt.cfg.head.y - rt.cfg.head.ry * 0.9, lastPose);
        sleepZzEl.style.left = topPt[0].toFixed(1) + "px";
        sleepZzEl.style.top = topPt[1].toFixed(1) + "px";
      }
      return makePose({ sx: 1.01, sy: 0.985 + 0.008 * b, breath: 0.022 * b, headRot: 6 + 1.2 * b, headTy: isKoi ? 6 : 8, rot: 1, earL: -5 + b, earR: (isKoi ? 8 : 54) + 2.5 * b, wDoze: 1, shS: 1.03 });
    }

    if (!isFittingOpen && careUiMode === "none" && now >= sleepAt) {
      startAnim("doze", now);
      return lastPose;
    }

    let bl = 0;
    if (now >= nextBlinkAt) {
      const bu = (now - nextBlinkAt) / 200;
      if (bu <= 1) bl = bu < 0.25 ? easeOutCubic(bu / 0.25) : bu < 0.5 ? 1 : 1 - easeInOut((bu - 0.5) / 0.5);
      else nextBlinkAt = now + 2200 + Math.random() * 2500;
    }
    const ps = careAll[rt.id] || careAll.koi;
    const isHungry = ps.hunger < 30;
    const isDirty = ps.hygiene < 30;
    const lowMood = isHungry || isDirty;
    const b = Math.sin((now / (lowMood ? 3600 : 2600)) * Math.PI * 2);
    const isKoi = rt.id === "koi";
    const earDroop = lowMood ? (isKoi ? 8 : 22) : 0;
    return makePose({
      sx: 1 - 0.006 * b + (lowMood ? 0.014 : 0),
      sy: (lowMood ? 0.972 : 1) + 0.012 * b,
      breath: (isKoi ? 0.014 : 0.018) * b,
      headRot: (lowMood ? 4.2 : isKoi ? 5.5 : 1.0) * Math.sin((now / 3600) * Math.PI * 2) + (isHungry ? 3 : 0),
      headTy: lowMood ? 9 : 0,
      earL: -0.9 - earDroop + 1.8 * Math.sin((now / 2500) * Math.PI * 2 + 0.3),
      earR: 0.9 + earDroop + 1.8 * Math.sin((now / 2800) * Math.PI * 2 + 1.4),
      wDoze: Math.max(bl, lowMood ? 0.24 : 0)
    });
  }

  function renderPetFrame(rt, p, setId, now, customAnchor) {
    if (!rt) return;
    lastPose = p;
    const dt = spring.t < 0 ? 0 : (now - spring.t) / 1000;
    spring.t = now;
    if (dt <= 0 || dt > 0.1) {
      spring.r = p.headRot; spring.vr = 0; spring.y = p.hopY; spring.vy = 0;
    } else {
      const n = Math.max(1, Math.ceil(dt / 0.008)), h = dt / n;
      for (let i = 0; i < n; i++) {
        spring.vr += (-(spring.r - p.headRot) * 150 - spring.vr * 9) * h; spring.r += spring.vr * h;
        spring.vy += (-(spring.y - p.hopY) * 140 - spring.vy * 9) * h; spring.y += spring.vy * h;
      }
    }

    const cfg = rt.cfg;
    const S = customAnchor ? cfg.baseScale * customAnchor.scaleK : cfg.baseScale * deskDepthScale(petPos.y);
    const ax = customAnchor ? customAnchor.x : petPos.x;
    const ay = customAnchor ? customAnchor.y : petPos.y;
    const OX = ax - cfg.cx * S;
    const OY = ay - cfg.feetY * S;
    const lagR = clamp(spring.r - p.headRot, -25, 25);
    const lagY = clamp((spring.y - p.hopY) * 0.6, -18, 28);
    const eL = p.earL + lagR * 1.1 - lagY * 0.4;
    const eR = p.earR + lagR * 1.1 + lagY * 0.4;
    const cr = Math.cos((p.rot * Math.PI) / 180), sr = Math.sin((p.rot * Math.PI) / 180);

    for (let i = 0; i < NV; i++) {
      const d = deformVertex(cfg, rt.rest[i * 2], rt.rest[i * 2 + 1], p, eL, eR);
      const dx = d[0] - cfg.cx, dy = d[1] - cfg.feetY;
      rt.pos[i * 2] = OX + (cfg.cx + dx * cr - dy * sr) * S;
      rt.pos[i * 2 + 1] = OY + (cfg.feetY + dx * sr + dy * cr) * S + p.hopY;
    }

    const useRoomTint = !customAnchor && !isCustomBgActive();
    const lampLitNow = useRoomTint ? isBedsideLampLit() : false;
    const tint = !useRoomTint || state.period === "day"
      ? [1.0, 1.0, 1.0]
      : lampLitNow
        ? [0.96, 0.93, 0.89]
        : [0.84, 0.88, 0.96];

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(prog);
    gl.uniform3f(loc.uEnvTint, tint[0], tint[1], tint[2]);

    const setPack = (setId && rt.setTexMap[setId]) || rt.defaultTex;
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, setPack.base); gl.uniform1i(loc.t0, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, setPack.closed); gl.uniform1i(loc.t1, 1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, cfg.useEyeShader ? rt.defaultTex.doze : setPack.doze); gl.uniform1i(loc.t2, 2);

    gl.uniform1f(loc.uEye, cfg.useEyeShader ? 1.0 : 0.0);
    if (cfg.useEyeShader) {
      const eLuv = setPack.eyeLUV || cfg.eyeLUV;
      const eRuv = setPack.eyeRUV || cfg.eyeRUV;
      const happyAmt = customAnchor && customAnchor.happy ? 1.0 : clamp(p.wClosed, 0, 1);
      gl.uniform1f(loc.w1, happyAmt);
      gl.uniform1f(loc.w2, happyAmt > 0.2 ? 0.0 : clamp(p.wDoze, 0, 1));
      gl.uniform4f(loc.uEyeL, eLuv[0], eLuv[1], eLuv[2], eLuv[3]);
      gl.uniform4f(loc.uEyeR, eRuv[0], eRuv[1], eRuv[2], eRuv[3]);
    } else {
      const rawW1 = customAnchor && customAnchor.happy ? 1.0 : clamp(p.wClosed, 0, 1);
      const rawW2 = clamp(p.wDoze, 0, 1 - rawW1);
      gl.uniform1f(loc.w1, rawW1);
      gl.uniform1f(loc.w2, rawW2);
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, rt.posBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, rt.pos);
    gl.enableVertexAttribArray(loc.aPos);
    gl.vertexAttribPointer(loc.aPos, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, rt.uvBuf);
    gl.enableVertexAttribArray(loc.aUv);
    gl.vertexAttribPointer(loc.aUv, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bodyIdxBuf);
    gl.drawElements(gl.TRIANGLES, bodyIdx.length, gl.UNSIGNED_SHORT, 0);

    // 绘制原版面部表情叠层（大笑嘴巴、伤心阴云、思考眼珠、卖萌猫嘴）
    const faceAlphas = {};
    if (!customAnchor && animMode === "emote" && emo.kind) {
      const def = EMO_DEFS[emo.kind];
      const ms = emo.u * def.ms;
      const faces = typeof def.faces === "function" ? def.faces(emo.side) : def.faces;
      faces.forEach((f) => {
        const a = f[1] * def.ms, b = f[2] * def.ms, fi = f[3] || 120, fo = f[4] || 120;
        faceAlphas[f[0]] = ms < a ? 0 : ms < a + fi ? easeOutCubic((ms - a) / fi) : ms < b ? 1 : ms < b + fo ? 1 - (ms - b) / fo : 0;
      });
    } else if (customAnchor && customAnchor.faceId) {
      faceAlphas[customAnchor.faceId] = 1.0;
    }

    const fg = rt.faceGrid;
    let drewAnyFace = false;
    for (const fid in faceAlphas) {
      if (faceAlphas[fid] <= 0.005) continue;
      const fTex = getFaceOverlayTex(rt, fid);
      if (!fTex) continue;
      if (!drewAnyFace) {
        drewAnyFace = true;
        for (let i = 0; i < fg.nv; i++) {
          const d = deformVertex(cfg, fg.rest[i * 2], fg.rest[i * 2 + 1], p, 0, 0);
          const dx = d[0] - cfg.cx, dy = d[1] - cfg.feetY;
          fg.pos[i * 2] = OX + (cfg.cx + dx * cr - dy * sr) * S;
          fg.pos[i * 2 + 1] = OY + (cfg.feetY + dx * sr + dy * cr) * S + p.hopY;
        }
        gl.useProgram(progF);
        gl.uniform3f(locF.uEnvTint, tint[0], tint[1], tint[2]);
        gl.bindBuffer(gl.ARRAY_BUFFER, fg.uvBuf);
        gl.enableVertexAttribArray(locF.aUv);
        gl.vertexAttribPointer(locF.aUv, 2, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, fg.posBuf);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, fg.pos);
        gl.enableVertexAttribArray(locF.aPos);
        gl.vertexAttribPointer(locF.aPos, 2, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, fg.idxBuf);
        gl.uniform1i(locF.tF, 3);
      }
      gl.activeTexture(gl.TEXTURE3);
      gl.bindTexture(gl.TEXTURE_2D, fTex);
      gl.uniform1f(locF.uA, clamp(faceAlphas[fid], 0, 1));
      gl.drawElements(gl.TRIANGLES, fg.idxLen, gl.UNSIGNED_SHORT, 0);
    }
    if (drewAnyFace) gl.activeTexture(gl.TEXTURE0);

    if (!customAnchor) {
      const baseW = (rt.id === "yutu" ? 315 : 345) * deskDepthScale(petPos.y);
      panoToBoxStyle(shSoftEl, ax, ay + 12, baseW * p.shS, baseW * 0.34 * p.shS);
      panoToBoxStyle(shConEl, ax, ay + 6, baseW * 0.56 * p.shS, baseW * 0.18 * p.shS);
      const hideShadow = isNightSleepingNow() || state.roomState !== "free_stand";
      shSoftEl.style.opacity = hideShadow ? "0" : String(0.92 * p.shO);
      shConEl.style.opacity = hideShadow ? "0" : String(0.95 * p.shO);
    }
  }

  function mainLoop(now) {
    if (isWebGLActive()) {
      const rt = petRuntimes[state.petId];
      if (rt) {
        let p = computePose(rt, now);
        if (blendFrom && now < blendUntil) {
          p = mixPose(blendFrom, p, easeOutCubic(1 - (blendUntil - now) / 140));
        }
        renderPetFrame(rt, p, state.savedSet[state.petId], now, null);
      }
    }
    requestAnimationFrame(mainLoop);
  }

  /* ---------- 14. 右侧 3D 喂食（拖拽 + 点击飞入）与 3D 搓澡泡泡 ---------- */
  let feedingLock = false;
  let bathProgress = 0;
  let lastBubbleSpawn = 0;

  function positionDirtyFx() {
    if (!dirtyLayerEl) return;
    const wisp1 = dirtyLayerEl.querySelector(".stink-1");
    const wisp2 = dirtyLayerEl.querySelector(".stink-2");
    const wisp3 = dirtyLayerEl.querySelector(".stink-3");
    const flyA = dirtyLayerEl.querySelector(".fly-a");
    const flyB = dirtyLayerEl.querySelector(".fly-b");
    if (wisp1) panoToBoxStyle(wisp1, petPos.x - 135, petPos.y - 385);
    if (wisp2) panoToBoxStyle(wisp2, petPos.x + 125, petPos.y - 405);
    if (wisp3) panoToBoxStyle(wisp3, petPos.x - 10, petPos.y - 475);
    if (flyA) panoToBoxStyle(flyA, petPos.x - 165, petPos.y - 455);
    if (flyB) panoToBoxStyle(flyB, petPos.x + 158, petPos.y - 435);
    if (btnDirtyHintEl) panoToBoxStyle(btnDirtyHintEl, petPos.x - 165, petPos.y - 525);
  }

  function positionHungryFx() {
    if (!hungryLayerEl) return;
    const rumble = hungryLayerEl.querySelector(".hungry-rumble");
    if (rumble) panoToBoxStyle(rumble, petPos.x, petPos.y - 165);
    if (btnHungryThoughtEl) panoToBoxStyle(btnHungryThoughtEl, petPos.x + 185, petPos.y - 515);
  }

  if (btnDirtyHintEl) {
    btnDirtyHintEl.addEventListener("click", (ev) => {
      ev.stopPropagation();
      sfx.tap();
      setToolboxOpen(false);
      setCareUiMode("bath");
    });
  }
  if (btnHungryThoughtEl) {
    btnHungryThoughtEl.addEventListener("click", (ev) => {
      ev.stopPropagation();
      sfx.tap();
      setToolboxOpen(false);
      setCareUiMode("feed");
    });
  }

  function setCareUiMode(nextMode) {
    if (careUiMode === "bath" && nextMode !== "bath") {
      if (animMode === "scrub") startAnim("idle", performance.now());
      soapBubbleLayerEl.innerHTML = "";
    }
    careUiMode = careUiMode === nextMode ? "none" : nextMode;
    appEl.classList.toggle("is-bathing", careUiMode === "bath");
    if (careUiMode !== "none" && state.roomState !== "free_stand") {
      applyRoomState("free_stand", true);
    } else if (careUiMode !== "none") {
      scrollToPanoX(petPos.x, true);
    }

    dockBtnFeedEl.classList.toggle("is-active", careUiMode === "feed");
    dockBtnBathEl.classList.toggle("is-active", careUiMode === "bath");
    feedPanelEl.hidden = careUiMode !== "feed";
    bathPanelEl.hidden = careUiMode !== "bath";

    if (careUiMode === "feed") renderSnackTray();
    if (careUiMode === "bath") {
      bathProgress = 0;
      bathPctTextEl.textContent = "0%";
      bathFillBarEl.style.width = "0%";
      soapBubbleLayerEl.innerHTML = "";
    }
    syncCareIndicators();
  }

  dockBtnFeedEl.addEventListener("click", () => {
    sfx.tap();
    setToolboxOpen(false);
    triggerRebound(dockBtnFeedEl);
    if (isPetSleepingNow()) {
      promptPatToWake("feed");
      return;
    }
    setCareUiMode("feed");
  });
  dockBtnBathEl.addEventListener("click", () => {
    sfx.tap();
    setToolboxOpen(false);
    triggerRebound(dockBtnBathEl);
    if (isPetSleepingNow()) {
      promptPatToWake("bath");
      return;
    }
    setCareUiMode("bath");
  });
  dockBtnWardrobeEl.addEventListener("click", () => {
    sfx.tap();
    setToolboxOpen(false);
    setCareUiMode("none");
    triggerRebound(dockBtnWardrobeEl);
    if (isPetSleepingNow()) {
      promptPatToWake("wardrobe");
      return;
    }
    enterFittingRoom();
  });
  $("btn-close-feed").addEventListener("click", () => { sfx.tap(); setCareUiMode("none"); });
  $("btn-close-bath").addEventListener("click", () => { sfx.tap(); setCareUiMode("none"); });

  function getPetMouthClientPt() {
    const rect = panoBoxEl.getBoundingClientRect();
    const rt = petRuntimes[state.petId];
    const mouthOffsetPano = rt && rt.id === "yutu" ? 265 : 230;
    return {
      x: rect.left + ((petPos.x / PANO_W) * rect.width),
      y: rect.top + (((petPos.y - mouthOffsetPano) / PANO_H) * rect.height)
    };
  }

  function consumeSnack(snack) {
    if (!snack || feedingLock) return;
    feedingLock = true;
    setTimeout(() => { feedingLock = false; }, 620);

    const ps = careAll[state.petId];
    const wasHungry = ps.hunger < 30;
    ps.hunger = clamp(ps.hunger + snack.hunger, 0, 100);
    Store.recordDailyEvent(crossStore, Store.getUtc8DateKey(), state.petId, { snackId: snack.id });
    if (state.petId === "yutu" && snack.id === "osmanthus_cake") unlockKeepsake("jade_rabbit_osmanthus_branch", "feed:osmanthus_cake");
    if (state.petId === "koi" && snack.id === "star_candy") unlockKeepsake("boon_koi_fortune_bead", "feed:star_candy");
    saveCareAll();

    sfx.munch();
    startAnim("eat", performance.now());
    const rt = petRuntimes[state.petId];
    if (rt) {
      spawnBeatFx(rt, { fx: "heart", at: "L" }, -1, lastPose);
      spawnBeatFx(rt, { fx: "heart", at: "R" }, 1, lastPose);
    }

    grantCareStars(1);
    if (snack.crafted && Store.consumeCraftedSnack) {
      Store.consumeCraftedSnack(crossStore, snack.id);
      renderSnackTray();
      if (typeof syncAltRoomProps === "function") syncAltRoomProps();
    }
    renderMoodTab();
    showSceneFeedback(wasHungry ? sayAsPet("feed_recover", snack.reply) : snack.reply, "dialogue");
  }

  function launchFlyingSnack(snack, startX, startY) {
    if (feedingLock) return;
    const dst = getPetMouthClientPt();
    flyingSnackImgEl.src = snack.icon;
    flyingSnackEl.style.transition = "none";
    flyingSnackEl.style.left = startX + "px";
    flyingSnackEl.style.top = startY + "px";
    flyingSnackEl.hidden = false;
    void flyingSnackEl.offsetWidth;
    flyingSnackEl.style.transition = "left 0.32s cubic-bezier(0.22, 1, 0.36, 1), top 0.32s cubic-bezier(0.22, 1, 0.36, 1)";
    flyingSnackEl.style.left = dst.x + "px";
    flyingSnackEl.style.top = dst.y + "px";
    setTimeout(() => {
      flyingSnackEl.hidden = true;
      consumeSnack(snack);
    }, 330);
  }

  let snackDrag = null;
  function renderSnackTray() {
    const baseList = SNACKS_BY_PET[state.petId] || SNACKS_BY_PET.koi;
    const craftedList = [];
    if (P5Data && crossStore.house && crossStore.house.craftedSnacks) {
      P5Data.CRAFTED_SNACKS.forEach((cs) => {
        const qty = Number(crossStore.house.craftedSnacks[cs.id] || 0);
        if (qty > 0) {
          craftedList.push({
            id: cs.id,
            name: `${cs.name} ×${qty}`,
            icon: cs.img,
            hunger: cs.hungerGain,
            crafted: true,
            reply: `刚出炉的${cs.name}真香呀！捧着脸颊开心得摇晃起来～`
          });
        }
      });
    }
    const list = craftedList.concat(baseList);
    snackGridEl.innerHTML = "";
    list.forEach((sn) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "snack-3d-card";
      card.innerHTML =
        `<img src="${sn.icon}" alt="${sn.name}" />` +
        `<span class="snack-3d-card__name">${sn.name}</span>`;

      card.addEventListener("pointerdown", (ev) => {
        ev.preventDefault();
        snackDrag = { snack: sn, x0: ev.clientX, y0: ev.clientY, x: ev.clientX, y: ev.clientY, moved: false, overPet: false };
      });
      snackGridEl.appendChild(card);
    });
  }

  window.addEventListener("pointermove", (ev) => {
    if (!snackDrag) return;
    snackDrag.x = ev.clientX;
    snackDrag.y = ev.clientY;
    if (!snackDrag.moved && Math.hypot(ev.clientX - snackDrag.x0, ev.clientY - snackDrag.y0) > 10) {
      snackDrag.moved = true;
      dragSnackImgEl.src = snackDrag.snack.icon;
      dragSnackEl.hidden = false;
    }
    if (snackDrag.moved) {
      dragSnackEl.style.left = ev.clientX + "px";
      dragSnackEl.style.top = ev.clientY + "px";
      const pt = clientToPano(ev.clientX, ev.clientY);
      snackDrag.overPet = isPanoPointOnPet(pt.x, pt.y, 65);
      dragSnackEl.classList.toggle("is-over-pet", snackDrag.overPet);
    }
  });

  window.addEventListener("pointerup", () => {
    if (!snackDrag) return;
    const d = snackDrag;
    snackDrag = null;
    dragSnackEl.hidden = true;
    dragSnackEl.classList.remove("is-over-pet");
    if (!d.moved) {
      launchFlyingSnack(d.snack, d.x0, d.y0);
    } else if (d.overPet) {
      consumeSnack(d.snack);
    }
  });

  /* ---------- 15. 桌面互动、搓澡揉搓与居家贴片热区 ---------- */
  function clientToPano(clientX, clientY) {
    const rect = panoBoxEl.getBoundingClientRect();
    if (!rect.width || !rect.height) return { x: CORK_HOME.x, y: CORK_HOME.y };
    return {
      x: ((clientX - rect.left) / rect.width) * PANO_W,
      y: ((clientY - rect.top) / rect.height) * PANO_H
    };
  }

  function isPanoPointOnPet(px, py, padPano) {
    const rt = petRuntimes[state.petId];
    if (!rt) return false;
    const S = rt.cfg.baseScale * deskDepthScale(petPos.y);
    const halfW = 240 * S + (padPano || 0);
    const topY = petPos.y - rt.cfg.feetY * S - (padPano || 0);
    return Math.abs(px - petPos.x) <= halfW && py >= topY && py <= petPos.y + 35 + (padPano || 0);
  }

  function spawnSoapBubble(px, py) {
    const b = document.createElement("span");
    b.className = "soap-bubble";
    const sz = 16 + Math.round(Math.random() * 18);
    b.style.width = sz + "px";
    b.style.height = sz + "px";
    panoToBoxStyle(b, px + (Math.random() - 0.5) * 90, py + (Math.random() - 0.5) * 70);
    soapBubbleLayerEl.appendChild(b);
    if (soapBubbleLayerEl.children.length > 26) {
      soapBubbleLayerEl.firstElementChild.remove();
    }
  }

  function completeBath() {
    careUiMode = "none";
    appEl.classList.remove("is-bathing");
    dockBtnBathEl.classList.remove("is-active");
    bathPanelEl.hidden = true;

    Array.from(soapBubbleLayerEl.children).forEach((el) => el.classList.add("is-popping"));
    setTimeout(() => { soapBubbleLayerEl.innerHTML = ""; }, 450);

    rinseFlashEl.hidden = false;
    setTimeout(() => { rinseFlashEl.hidden = true; }, 920);

    const ps = careAll[state.petId];
    ps.hygiene = 100;
    Store.recordDailyEvent(crossStore, Store.getUtc8DateKey(), state.petId, { bathed: true });
    unlockKeepsake(state.petId === "yutu" ? "k_r01_yellow_rubber_duck" : "k_k04_origami_paper_boat", "bath:complete");
    saveCareAll();
    sfx.splash();
    startAnim("rinse", performance.now());
    grantCareStars(3);
    renderMoodTab();
    showSceneFeedback(sayAsPet("bath_recover", "洗完蓬松多了。"), "dialogue");
  }

  let petTouch = null;
  let lastPetStarAt = 0;

  panoBoxEl.addEventListener("pointerdown", (ev) => {
    if (!isWebGLActive()) return;
    if (ev.target && ev.target.closest && ev.target.closest("button")) return;
    const pt = clientToPano(ev.clientX, ev.clientY);
    const pad = careUiMode === "bath" ? 75 : 30;
    if (isPanoPointOnPet(pt.x, pt.y, pad)) {
      if (careUiMode === "bath") ev.preventDefault();
      petTouch = { x0: ev.clientX, y0: ev.clientY, lastX: ev.clientX, lastY: ev.clientY, pt0: pt, moved: false };
    }
  });

  // 手机端搓澡时阻止 Safari/Chrome 接管横向滚动
  window.addEventListener("touchmove", (ev) => {
    if (careUiMode === "bath" && petTouch) {
      ev.preventDefault();
    }
  }, { passive: false });

  window.addEventListener("pointermove", (ev) => {
    if (!petTouch || !isWebGLActive()) return;
    const dx = ev.clientX - petTouch.x0;
    const stepDist = Math.hypot(ev.clientX - petTouch.lastX, ev.clientY - petTouch.lastY);
    petTouch.lastX = ev.clientX;
    petTouch.lastY = ev.clientY;

    if (careUiMode === "bath") {
      if (stepDist > 2.5) {
        petTouch.moved = true;
        const pt = clientToPano(ev.clientX, ev.clientY);
        scrubLean = clamp((pt.x - petPos.x) / 160, -1, 1);
        if (animMode !== "scrub") startAnim("scrub", performance.now());
        bathProgress = Math.min(100, bathProgress + stepDist * 0.28);
        bathPctTextEl.textContent = Math.round(bathProgress) + "%";
        bathFillBarEl.style.width = Math.round(bathProgress) + "%";

        const now = Date.now();
        if (now - lastBubbleSpawn > 65) {
          lastBubbleSpawn = now;
          spawnSoapBubble(pt.x, pt.y);
          sfx.bubble();
        }
        if (bathProgress >= 100) {
          petTouch = null;
          completeBath();
        }
      }
      return;
    }

    if (Math.abs(dx) > 14) {
      petTouch.moved = true;
      petLean = clamp(dx / 55, -1, 1);
      if (animMode !== "pet") startAnim("pet", performance.now());
      const now = Date.now();
      if (now - lastPetStarAt > 8500) {
        lastPetStarAt = now;
        sfx.star();
        Store.recordDailyEvent(crossStore, Store.getUtc8DateKey(), state.petId, { visitedState: "petted" });
        grantCareStars(2);
        renderMoodTab();
        showSceneFeedback(sayAsPet("petted", "头顶暖暖的，刚刚好。"), "dialogue");
      }
    }
  });

  function resetPetTouchState() {
    if (!petTouch) return;
    petTouch = null;
    petLean = 0;
    scrubLean = 0;
    if (animMode === "pet" || animMode === "scrub") startAnim("idle", performance.now());
  }
  window.addEventListener("pointercancel", resetPetTouchState);

  window.addEventListener("pointerup", () => {
    if (!petTouch) return;
    const t = petTouch;
    petTouch = null;
    petLean = 0;
    scrubLean = 0;

    if (t.moved) {
      if (animMode === "pet" || animMode === "scrub") startAnim("idle", performance.now());
      return;
    }
    if (careUiMode === "bath") {
      showSceneFeedback("在身上左右来回滑动就能搓出泡泡哦～", "system");
      return;
    }
    const rt = petRuntimes[state.petId];
    if (!rt) return;
    if (animMode === "doze") {
      sfx.hop();
      startAnim("minihop", performance.now());
      return;
    }
    // 很饿 / 很臭优先级路由：按当前伙伴人格说出专属状态台词
    const hungryNow = isPetHungryNow();
    const dirtyNow = isPetDirtyNow();
    if (hungryNow || dirtyNow) {
      const sceneKey = hungryNow && dirtyNow ? "hungry_and_dirty" : hungryNow ? "hungry" : "dirty";
      sfx.tap();
      startAnim("minihop", performance.now());
      showSceneFeedback(sayAsPet(sceneKey), "dialogue");
      return;
    }
    const S = rt.cfg.baseScale * deskDepthScale(petPos.y);
    const neckPanoY = petPos.y - (rt.cfg.feetY - rt.cfg.neck.y) * S;
    if (t.pt0.y < neckPanoY + 35) {
      sfx.tap();
      triggerFullEmote(t.pt0.x < petPos.x ? -1 : 1);
    } else {
      sfx.hop();
      startAnim("jump", performance.now());
    }
  });

  function clampSafeDeskTarget(px, py) {
    if (isCustomBgActive()) return { x: clamp(px, 980, 1820), y: clamp(py, 1060, 1320) };
    let x = clamp(px, 1185, 2120);
    let y = clamp(py, 1035, 1430);
    const dx = x - 1815, dy = y - 1095;
    if (Math.hypot(dx, dy) < 205) {
      const ang = Math.atan2(dy || 1, dx || -1);
      x = clamp(1815 + Math.cos(ang) * 210, 1185, 2120);
      y = clamp(1095 + Math.sin(ang) * 210, 1035, 1430);
    }
    if (x < 1230 && y > 1300) x = 1245;
    return { x, y };
  }

  panoBoxEl.addEventListener("click", (ev) => {
    if (ev.target && ev.target.closest && ev.target.closest("button")) return;
    if ((mousePan && mousePan.moved) || isFittingOpen || careUiMode !== "none" || state.roomState !== "free_stand") return;
    const pt = clientToPano(ev.clientX, ev.clientY);
    if (isPanoPointOnPet(pt.x, pt.y, 24) || pt.y < 970) return;

    const dst = clampSafeDeskTarget(pt.x, pt.y);
    sfx.hop();
    const rip = document.createElement("span");
    rip.className = "desk-ripple";
    panoToBoxStyle(rip, dst.x, dst.y);
    panoBoxEl.appendChild(rip);
    setTimeout(() => rip.remove(), 600);

    hopMove = {
      x0: petPos.x, y0: petPos.y, x1: dst.x, y1: dst.y,
      t0: performance.now(),
      dur: clamp(280 + Math.hypot(dst.x - petPos.x, dst.y - petPos.y) * 0.42, 300, 620)
    };
  });

  function getLivingRoomModules() {
    Store.ensureModularAndClockDefaults(crossStore);
    return crossStore.house.roomModules.living_room;
  }

  function isBedsideLampLit() {
    const mods = getLivingRoomModules();
    const st = mods.mod_lamp && mods.mod_lamp.state;
    if (st === "on") return true;
    if (st === "off") return false;
    // 默认：白天关灯，夜晚默认关灯好眠（点击小灯开灯则亮起暖灯、玉兔起床继续陪你）
    return false;
  }

  function isNightSleepingNow() {
    const sleepSrc = COZY_SCENE_CONFIG.sleepSprites && COZY_SCENE_CONFIG.sleepSprites[state.petId];
    return Boolean(
      sleepSrc &&
      !isCustomBgActive() &&
      !isFittingOpen &&
      state.roomState === "free_stand" &&
      state.period === "night" &&
      !isBedsideLampLit()
    );
  }

  function isPetSleepingNow() {
    return isNightSleepingNow() || state.roomState === "sleep";
  }

  let pendingWakeAction = null;
  let wakeGuideTimer = 0;
  let wakeAnimBusy = false;

  function clearWakeGuideHint() {
    if (wakeGuideTimer) {
      clearTimeout(wakeGuideTimer);
      wakeGuideTimer = 0;
    }
    if (hitSleepPetEl) hitSleepPetEl.classList.remove("is-guided");
  }

  function promptPatToWake(actionType) {
    const petName = state.petId === "yutu" ? "玉兔" : "锦鲤";
    const actionLabelMap = {
      feed: "吃零食",
      bath: "洗香香",
      wardrobe: "试新衣服"
    };
    const actText = actionLabelMap[actionType] || "玩耍";
    pendingWakeAction = { type: actionType, expiresAt: Date.now() + 15000 };

    const bedX = (COZY_SCENE_CONFIG.anchors && COZY_SCENE_CONFIG.anchors.bedCenter && COZY_SCENE_CONFIG.anchors.bedCenter.x) || 580;
    scrollToPanoX(bedX, true);
    showSceneFeedback(sayAsPet("sleep_blocked", `${petName}正在被窝里睡觉呢～拍一拍叫醒再${actText}吧 💤`), "dialogue");

    if (hitSleepPetEl) {
      hitSleepPetEl.hidden = false;
      hitSleepPetEl.classList.remove("is-guided");
      void hitSleepPetEl.offsetWidth;
      hitSleepPetEl.classList.add("is-guided");
      if (wakeGuideTimer) clearTimeout(wakeGuideTimer);
      wakeGuideTimer = setTimeout(() => {
        if (hitSleepPetEl) hitSleepPetEl.classList.remove("is-guided");
        wakeGuideTimer = 0;
      }, 3600);
    }
  }

  function wakePetWithPatAnimation() {
    if (wakeAnimBusy || !isPetSleepingNow()) return;
    wakeAnimBusy = true;
    clearWakeGuideHint();

    const petName = state.petId === "yutu" ? "玉兔" : "锦鲤";
    const wasNightBedSleep = isNightSleepingNow();
    const pending = (pendingWakeAction && pendingWakeAction.expiresAt > Date.now()) ? pendingWakeAction.type : null;
    pendingWakeAction = null;

    // Stage 1 (0–260ms): 轻拍软弹微抖 + 醒啦气泡
    sfx.tap();
    if (petSleepSpriteEl && wasNightBedSleep) {
      petSleepSpriteEl.classList.remove("is-waking-fade");
      petSleepSpriteEl.classList.add("is-waking-pat");
    }
    showSceneFeedback(sayAsPet("wake_pat", `唔，揉揉眼睛醒啦。`), "dialogue");

    const step2Delay = REDUCED_MOTION ? 40 : 260;
    const step3Delay = REDUCED_MOTION ? 80 : 540;
    const doneDelay = REDUCED_MOTION ? 120 : 900;

    // Stage 2 (260–540ms): 开灯掀被淡出 + 镜头移回软木垫
    setTimeout(() => {
      if (petSleepSpriteEl && wasNightBedSleep) {
        petSleepSpriteEl.classList.remove("is-waking-pat");
        petSleepSpriteEl.classList.add("is-waking-fade");
      }
      if (wasNightBedSleep) {
        const mods = getLivingRoomModules();
        mods.mod_lamp.state = "on";
        sfx.lampClick(true);
        syncPanoramaImage(false);
        persistState();
      } else if (state.roomState === "sleep") {
        applyRoomState("free_stand", false);
      }
      scrollToPanoX(CORK_HOME.x, true);
    }, step2Delay);

    // Stage 3 (540–900ms): 站立宠物蹦跳落回软木垫
    setTimeout(() => {
      if (petSleepSpriteEl) {
        petSleepSpriteEl.classList.remove("is-waking-pat", "is-waking-fade");
      }
      wakeAnimBusy = false;
      syncRoomModules();
      layoutScenePropsAndHotspots();
      if (glCanvas) {
        glCanvas.classList.remove("is-waking-arrive");
        void glCanvas.offsetWidth;
        glCanvas.classList.add("is-waking-arrive");
      }
      sfx.hop();
      startAnim("minihop", performance.now());
    }, step3Delay);

    // 完成：落稳后衔接原本意图或打招呼
    setTimeout(() => {
      if (glCanvas) glCanvas.classList.remove("is-waking-arrive");
      if (pending === "feed") {
        setCareUiMode("feed");
      } else if (pending === "bath") {
        setCareUiMode("bath");
      } else if (pending === "wardrobe") {
        enterFittingRoom();
      } else {
        showSceneFeedback(sayAsPet("wake_done", `${petName}起床陪你啦。`), "dialogue");
      }
    }, doneDelay);
  }

  function syncRoomModules() {
    // ① 床头暖光灯：夜晚开灯切真实暖灯底图 cozy_room_night_lit.png，白天开灯叠柔光晕
    const lampLit = isBedsideLampLit();
    appEl.dataset.lampLit = String(lampLit);
    roomLampGlowEl.hidden = !lampLit;

    // ② 书架未读来信轻气泡（类似《动物去哪儿》信箱气泡）
    const inLivingRoom = !isCustomBgActive();
    if (booksMailBubbleEl) {
      const showBubble = inLivingRoom && !isFittingOpen && state.unreadMail && (state.roomState === "free_stand" || state.roomState === "away");
      booksMailBubbleEl.hidden = !showBubble;
    }
    const modBooksDiaryMarkEl = $("mod-books-diary-mark");
    if (modBooksDiaryMarkEl) {
      const hasDiaries = Array.isArray(crossStore.diaries) && crossStore.diaries.length > 0;
      const todayKey = Store.getUtc8DateKey();
      const todayLog = crossStore.dailyEventLog && crossStore.dailyEventLog[todayKey];
      const hasTodayActivity = DiaryEngine && todayLog && (
        DiaryEngine.hasRealInteraction(todayLog.yutu) || DiaryEngine.hasRealInteraction(todayLog.koi)
      );
      modBooksDiaryMarkEl.hidden = !(hasDiaries || hasTodayActivity);
    }
    if (typeof syncBookshelfCurioMinis === "function") {
      syncBookshelfCurioMinis();
    }

    // ③ 夜晚关灯时呈现整床无缝入睡贴片（玉兔/锦鲤各自对齐）；夜晚开灯时隐藏入睡贴片，宠物站回软木垫继续陪伴
    const sleepSrc = COZY_SCENE_CONFIG.sleepSprites && COZY_SCENE_CONFIG.sleepSprites[state.petId];
    const showNightSleep = isNightSleepingNow();
    appEl.classList.toggle("is-night-sleeping", showNightSleep);
    if (petSleepSpriteEl && !wakeAnimBusy) {
      petSleepSpriteEl.hidden = !showNightSleep;
      const box = (COZY_SCENE_CONFIG.sleepBoxes && COZY_SCENE_CONFIG.sleepBoxes[state.petId]) || [92, 443, 1161, 1012];
      panoToBoxStyle(petSleepSpriteEl, box[0], box[1], box[2], box[3], "top-left");
      if (showNightSleep && petSleepSpriteImgEl && petSleepSpriteImgEl.getAttribute("src") !== sleepSrc) {
        petSleepSpriteImgEl.src = sleepSrc;
      }
    }
    if (hitSleepPetEl) {
      const showSleepPatHit = isPetSleepingNow() && !isFittingOpen && !wakeAnimBusy;
      hitSleepPetEl.hidden = !showSleepPatHit;
      if (!showSleepPatHit) clearWakeGuideHint();
    }

    // ④ 窗台天气/时段小摆件（白天展示晴天小多肉盆栽，夜晚展示微光星光瓶）
    if (sillWeatherPropEl && sillWeatherPropImgEl) {
      const showSill = inLivingRoom && (isFittingOpen || state.roomState === "free_stand" || state.roomState === "away");
      sillWeatherPropEl.hidden = !showSill;
      if (showSill) {
        const sillKey = state.period === "night" ? "night" : "sunny";
        const sillSrc = COZY_SCENE_CONFIG.sillProps[sillKey];
        if (sillWeatherPropImgEl.getAttribute("src") !== sillSrc) {
          sillWeatherPropImgEl.src = sillSrc;
        }
        sillWeatherPropEl.dataset.sillKind = sillKey;
      }
    }

    // ⑤ 外出旅行（away）留条气泡
    if (awayNoteBubbleEl) {
      const showAway = inLivingRoom && !isFittingOpen && state.roomState === "away";
      awayNoteBubbleEl.hidden = !showAway;
      if (showAway) {
        const petLabel = state.petId === "yutu" ? "玉兔" : "锦鲤";
        const txtEl = awayNoteBubbleEl.querySelector(".scene-away-note__text");
        if (txtEl) txtEl.textContent = `${petLabel}背着小包出门采风啦 📮`;
      }
    }
  }

  function layoutScenePropsAndHotspots() {
    const inLivingRoom = !isCustomBgActive();
    const isCozyInteractive = inLivingRoom && (isFittingOpen || state.roomState === "free_stand" || state.roomState === "away");
    const cfg = COZY_SCENE_CONFIG;

    // z:6 夜晚整床无缝入睡贴片 + 窗台小摆件 + z:7 台灯暖光光晕
    if (petSleepSpriteEl) {
      const box = (cfg.sleepBoxes && cfg.sleepBoxes[state.petId]) || [92, 443, 1161, 1012];
      panoToBoxStyle(petSleepSpriteEl, box[0], box[1], box[2], box[3], "top-left");
    }
    if (sillWeatherPropEl) {
      panoToBoxStyle(sillWeatherPropEl, cfg.slots.sillProp[0], cfg.slots.sillProp[1], cfg.slots.sillProp[2], cfg.slots.sillProp[3], "center");
    }
    if (awayNoteBubbleEl) {
      panoToBoxStyle(awayNoteBubbleEl, cfg.slots.awayNote[0], cfg.slots.awayNote[1]);
    }
    panoToBoxStyle(roomLampGlowEl, cfg.slots.lampGlow[0], cfg.slots.lampGlow[1], cfg.slots.lampGlow[2], cfg.slots.lampGlow[3], "center");

    // 床头顶板左侧留白槽《奶肚黑猫警长发条钟》
    bedsideCatClockEl.hidden = !inLivingRoom;
    if (inLivingRoom) {
      panoToBoxStyle(bedsideCatClockEl, cfg.slots.catClock[0], cfg.slots.catClock[1], cfg.slots.catClock[2], cfg.slots.catClock[3], "center");
      hitCatClockEl.hidden = isFittingOpen;
      panoToBoxStyle(hitCatClockEl, cfg.slots.catClockHit[0], cfg.slots.catClockHit[1], cfg.slots.catClockHit[2], cfg.slots.catClockHit[3], "center");
    } else {
      hitCatClockEl.hidden = true;
    }

    // 核心透明交互热区（台灯、书架、桌面原木小立镜、黑猫钟、床上睡觉拍醒热区）
    const showModHits = isCozyInteractive && !isFittingOpen;
    hitBedLampEl.hidden = !showModHits;
    hitBookshelfEl.hidden = !showModHits;
    hitDeskMirrorEl.hidden = !(showModHits && state.roomState === "free_stand");
    if (showModHits) {
      panoToBoxStyle(hitBedLampEl, cfg.hotspots.lamp[0], cfg.hotspots.lamp[1], cfg.hotspots.lamp[2], cfg.hotspots.lamp[3], "top-left");
      panoToBoxStyle(hitBookshelfEl, cfg.hotspots.bookshelf[0], cfg.hotspots.bookshelf[1], cfg.hotspots.bookshelf[2], cfg.hotspots.bookshelf[3], "top-left");
      panoToBoxStyle(hitDeskMirrorEl, cfg.hotspots.deskMirror[0], cfg.hotspots.deskMirror[1], cfg.hotspots.deskMirror[2], cfg.hotspots.deskMirror[3], "top-left");
    }
    if (hitSleepPetEl) {
      const showSleepPatHit = isPetSleepingNow() && !isFittingOpen && !wakeAnimBusy;
      hitSleepPetEl.hidden = !showSleepPatHit;
      if (showSleepPatHit && cfg.hotspots.sleepPet) {
        const sp = cfg.hotspots.sleepPet;
        panoToBoxStyle(hitSleepPetEl, sp[0], sp[1], sp[2], sp[3], "top-left");
      }
    }

    // 墙面微缩拍立得落位书本上方干净白墙留白槽
    wallPolaroidEl.hidden = !inLivingRoom || state.postcards.length === 0;
    if (!wallPolaroidEl.hidden) {
      panoToBoxStyle(wallPolaroidEl, cfg.slots.wallPolaroid[0], cfg.slots.wallPolaroid[1], cfg.slots.wallPolaroid[2], cfg.slots.wallPolaroid[3], "center");
    }

    // 居家态折叠毛衣右移至安全区 (2430, 1110)，与床头黑猫警长钟零重叠
    const def = ROOM_STATES[state.roomState];
    const showFolded = !isFittingOpen && def && def.track === "baked" && !!state.savedSet[state.petId];
    foldedOutfitPropEl.hidden = !showFolded;
    if (showFolded) panoToBoxStyle(foldedOutfitPropEl, 2430, 1110, 168, 168, "center");

    if (!isFittingOpen && def && (def.track === "baked" || def.track === "away")) {
      const anc = def.anchors[state.petId];
      if (anc && anc.c) {
        charHotspotEl.hidden = false;
        panoToBoxStyle(charHotspotEl, anc.c[0], anc.c[1], 390, 460, "center");
      } else {
        charHotspotEl.hidden = true;
      }
      const actKey = `${state.petId}:${state.roomState}`;
      if (anc && anc.a && !state.actedStates[actKey]) {
        actionGlowEl.hidden = false;
        panoToBoxStyle(actionGlowEl, anc.a[0], anc.a[1], 106, 106, "center");
      } else {
        actionGlowEl.hidden = true;
      }
    } else {
      charHotspotEl.hidden = true;
      actionGlowEl.hidden = true;
    }
    syncRoomModules();
    syncCareIndicators();
    if (dirtyLayerEl && !dirtyLayerEl.hidden) positionDirtyFx();
    if (hungryLayerEl && !hungryLayerEl.hidden) positionHungryFx();
    updateClockDutyHintVisibility();
  }

  // 核心热点 1：床头黑猫警长钟点击 → 600ms FLIP 飞入居中翻转弹窗
  hitCatClockEl.addEventListener("click", (ev) => {
    ev.stopPropagation();
    if (mousePan && mousePan.moved) return;
    sfx.tap();
    openClockModal();
  });

  // 睡眠拍醒热区：拍一拍床上的玉兔/锦鲤 → 播放三段式起床小动画
  if (hitSleepPetEl) {
    hitSleepPetEl.addEventListener("click", (ev) => {
      ev.stopPropagation();
      if (mousePan && mousePan.moved) return;
      wakePetWithPatAnimation();
    });
  }

  // 核心热点 2：床头暖光灯透明热区点击（夜晚：开灯起床陪你 ↔ 关灯盖被睡觉）
  hitBedLampEl.addEventListener("click", (ev) => {
    ev.stopPropagation();
    if (mousePan && mousePan.moved) return;
    const mods = getLivingRoomModules();
    const nextLit = !isBedsideLampLit();
    const petName = state.petId === "yutu" ? "玉兔" : "锦鲤";
    if (state.period === "night" && nextLit && isNightSleepingNow()) {
      wakePetWithPatAnimation();
      return;
    }
    mods.mod_lamp.state = nextLit ? "on" : "off";
    sfx.lampClick(nextLit);
    syncPanoramaImage(false);
    syncRoomModules();
    persistState();
    if (state.period === "night") {
      showSceneFeedback(
        nextLit ? sayAsPet("lamp_on", `暖灯亮起，${petName}起床陪你聊聊天啦。`) : sayAsPet("lamp_off", `关灯了，${petName}钻回被窝睡觉。`),
        "dialogue"
      );
    } else {
      showSceneFeedback(nextLit ? "咔哒～床头暖光灯亮起来啦" : "咔哒～已轻按关掉床头灯", "system");
    }
  });

  // 核心热点 3：床边立书/书架热区 → 打开三层原木书架中枢弹窗（PRD-0003 P3 手帐日记 + #40 听你说互动匣）
  hitBookshelfEl.addEventListener("click", (ev) => {
    ev.stopPropagation();
    if (mousePan && mousePan.moved) return;
    sfx.tap();
    openBookshelfHub();
  });

  // 书架未读来信气泡 & 外出旅行留条气泡 → 优先查看未读来信，否则打开书架中枢
  async function handleMailOrAwayBubbleClick(ev) {
    ev.stopPropagation();
    if (mousePan && mousePan.moved) return;
    sfx.tap();
    if (state.unreadMail) {
      await openLetterOverlay(state.stageBgId !== "living_room" ? state.stageBgId : "bg_sunset_meadow", true);
    } else {
      openBookshelfHub();
    }
  }
  if (booksMailBubbleEl) {
    booksMailBubbleEl.addEventListener("click", handleMailOrAwayBubbleClick);
  }
  if (awayNoteBubbleEl) {
    awayNoteBubbleEl.addEventListener("click", handleMailOrAwayBubbleClick);
  }

  // 核心热点 5：桌面原木小立镜透明热区 → 镜面闪光+星芒微反馈 → 进入试衣间（睡觉时先引导拍醒）
  let mirrorTapTimer = 0;
  hitDeskMirrorEl.addEventListener("click", (ev) => {
    ev.stopPropagation();
    if (mousePan && mousePan.moved) return;
    sfx.tap();
    hitDeskMirrorEl.classList.remove("is-tapped");
    void hitDeskMirrorEl.offsetWidth;
    hitDeskMirrorEl.classList.add("is-tapped");
    if (mirrorTapTimer) clearTimeout(mirrorTapTimer);
    mirrorTapTimer = setTimeout(() => {
      hitDeskMirrorEl.classList.remove("is-tapped");
      mirrorTapTimer = 0;
    }, 420);
    if (isPetSleepingNow()) {
      promptPatToWake("wardrobe");
      return;
    }
    setTimeout(() => {
      if (!isFittingOpen && !isPetSleepingNow()) enterFittingRoom();
    }, REDUCED_MOTION ? 0 : 210);
  });
  foldedOutfitPropEl.addEventListener("click", (ev) => {
    ev.stopPropagation(); sfx.tap();
    const name = getSetName(state.petId, state.savedSet[state.petId]) || "外套";
    showSceneFeedback(`脱下来的「${name}」叠好放在窗边小桌旁啦`, "system");
  });
  charHotspotEl.addEventListener("click", (ev) => {
    ev.stopPropagation(); sfx.tap();
    const def = ROOM_STATES[state.roomState];
    if (def) showSceneFeedback(def.line, "dialogue");
  });
  actionGlowEl.addEventListener("click", (ev) => {
    ev.stopPropagation();
    const def = ROOM_STATES[state.roomState];
    if (!def) return;
    const dk = Store.getUtc8DateKey();
    const slotKey = `${dk}_${state.petId}_${state.roomState}`;
    if (!Array.isArray(crossStore.companion.actedSlotKeys)) crossStore.companion.actedSlotKeys = [];
    const alreadyActedToday = crossStore.companion.actedSlotKeys.includes(slotKey);
    if (!alreadyActedToday) {
      crossStore.companion.actedSlotKeys.push(slotKey);
      if (crossStore.companion.actedSlotKeys.length > 60) {
        crossStore.companion.actedSlotKeys = crossStore.companion.actedSlotKeys.slice(-60);
      }
    }
    state.actedStates[`${state.petId}:${state.roomState}`] = true;
    actionGlowEl.hidden = true;
    sfx.star();

    const petRoomDropMap = {
      sleep: "retained_sugar_painting_ladle",
      reading: state.petId === "yutu" ? "k_r05_vintage_moon_rabbit_newspaper" : "k_k01_lotus_leaf_bookmark",
      drawing: state.petId === "koi" ? "k_k07_dried_paint_palette" : "short_pencil",
      gaming: state.petId === "yutu" ? "k_r07_rabbit_silhouette_badge" : "cork_coaster",
      window: state.petId === "yutu" ? "jade_rabbit_moon_phase_cards" : "boon_koi_lotus_lantern"
    };
    const dropId = petRoomDropMap[state.roomState] || def.keepsakeId;
    if (dropId) unlockKeepsake(dropId, "scene:" + state.roomState);
    if (def.keepsakeId && def.keepsakeId !== dropId) unlockKeepsake(def.keepsakeId, "scene:" + state.roomState);

    Store.recordDailyEvent(crossStore, dk, state.petId, {
      visitedState: state.roomState,
      keepsakeId: dropId || def.keepsakeId
    });
    if (!alreadyActedToday) {
      animateStarsTo(state.stars + 3, 3);
    } else {
      persistState();
    }
    renderMoodTab();
    if (def.actionFeedback) showSceneFeedback(def.actionFeedback, "dialogue");
  });

  /* ---------- 16. 角色切换、状态切换与右下 3D 百宝箱 ---------- */
  function renderContextEntry() {
    const showEnvelope = state.unreadMail || state.roomState === "away";
    btnContextEntryEl.classList.toggle("scene-action-button--flat-envelope", showEnvelope);
    btnContextEntryEl.classList.toggle("scene-action-button--companion-chat", !showEnvelope);
    contextIconEl.classList.toggle("scene-action-icon-image--flat-envelope", showEnvelope);
    contextIconEl.classList.toggle("scene-action-icon-image--companion-chat", !showEnvelope);
    if (showEnvelope) {
      contextIconEl.src = "./living-room-dress/ui/envelope.png";
      contextUnreadDotEl.hidden = !state.unreadMail;
      letterPlaneFxEl.hidden = !state.unreadMail;
    } else {
      contextIconEl.src = state.petId === "yutu" ? "./living-room-dress/ui/chat_yutu.png" : "./living-room-dress/ui/chat_koi.png";
      contextUnreadDotEl.hidden = true;
      letterPlaneFxEl.hidden = true;
    }
  }

  function applyRoomState(nextKey, smoothScroll) {
    if (!ROOM_STATES[nextKey]) return;
    if (nextKey !== "free_stand" && careUiMode !== "none") setCareUiMode("none");
    state.roomState = nextKey;
    const def = ROOM_STATES[nextKey];
    appEl.dataset.state = nextKey;
    appEl.classList.toggle("is-baked-action", def.track === "baked");
    sleepZzEl.hidden = true;

    if (nextKey === "free_stand") {
      petPos = { x: CORK_HOME.x, y: CORK_HOME.y };
      hopMove = null;
    }
    if (nextKey === "away") state.unreadMail = true;

    syncPanoramaImage(false);
    layoutScenePropsAndHotspots();
    renderContextEntry();
    renderMoodTab();
    updateDevTesterLabels();
    if (def.screen !== undefined && !isCustomBgActive()) {
      scrollToScreen(def.screen, smoothScroll !== false);
    }
  }

  async function switchPet(nextPet) {
    if (!catalog.pets[nextPet]) return;
    state.petId = nextPet;
    petFxHostEl.innerHTML = "";
    sleepZzEl.hidden = true;
    await initPet(nextPet);
    if (state.savedSet[nextPet]) await ensureSetLoaded(petRuntimes[nextPet], state.savedSet[nextPet]);
    startAnim("minihop", performance.now());
    syncPanoramaImage(false);
    layoutScenePropsAndHotspots();
    renderMoodTab();
    renderContextEntry();
    updateDevTesterLabels();
    if (careUiMode === "feed") renderSnackTray();
    document.querySelectorAll("[data-fit-pet]").forEach((b) => b.classList.toggle("is-active", b.dataset.fitPet === nextPet));
    if (isFittingOpen) {
      renderWardrobeGrid();
      applyFittingCameraTransform();
    }
    persistState();
  }

  let toolboxOpen = false;
  function setToolboxOpen(open) {
    if (toolboxOpen === open) return;
    toolboxOpen = open;
    btnToolboxEl.setAttribute("aria-expanded", String(open));
    toolboxEl.setAttribute("aria-hidden", String(!open));
    actionDockEl.classList.toggle("scene-action-dock--toolbox-open", open);
    toolboxDismissEl.hidden = !open;
    chestClosedEl.classList.toggle("companion-toolbox-button__lid--visible", !open);
    chestOpenEl.classList.toggle("companion-toolbox-button__lid--visible", open);
    triggerRebound(toolboxBtnMotionEl);
    toolboxEl.className = open ? "companion-toolbox companion-toolbox--opening" : "companion-toolbox companion-toolbox--closing";
    setTimeout(() => {
      if (toolboxOpen === open) toolboxEl.className = "companion-toolbox companion-toolbox--" + (open ? "open" : "closed");
    }, open ? 290 : 165);
  }
  btnToolboxEl.addEventListener("click", () => { sfx.tap(); setToolboxOpen(!toolboxOpen); });
  toolboxDismissEl.addEventListener("click", () => setToolboxOpen(false));

  $("tb-btn-spaces")?.addEventListener("click", () => {
    setToolboxOpen(false);
    openHouseGuide("bgs");
  });
  $("tb-btn-album").addEventListener("click", () => {
    setToolboxOpen(false);
    tbAlbumDotEl.hidden = true;
    openKeepsakeAlbum("postcards");
  });
  $("tb-btn-wallpaper").addEventListener("click", async () => {
    setToolboxOpen(false);
    await exportLockscreenWallpaperJpg();
  });
  const settingsPanel = window.EggBabeSettingsPanel && settingsOverlayEl
    ? window.EggBabeSettingsPanel.createSettingsPanel({
        overlayEl: settingsOverlayEl,
        storeApi: Store,
        getStore: () => crossStore,
        persist: () => persistState(),
        getSfxOn: () => !!state.sfxOn,
        setSfxOn: (next) => {
          state.sfxOn = !!next;
        },
        getTickNoiseOn: () => !!getClockWidget().tickWhiteNoiseOn,
        setTickNoiseOn: (next) => {
          const cw = getClockWidget();
          cw.tickWhiteNoiseOn = !!next;
          renderBlackCatClockUI();
          if (cw.tickWhiteNoiseOn && state.sfxOn) {
            sfx.clockTick(true);
          }
        },
        getOutfitName: (petId, setId) => getSetName(petId, setId),
        onOpenProfile: () => openProfileModal(),
        onOpenAlbum: (petId) => {
          if (petId === "koi" || petId === "yutu") {
            activeDetailStoryPet = petId;
          }
          openKeepsakeAlbum("keepsakes");
        },
        onOpenHoloCard: (petId) => {
          const pid = petId === "yutu" ? "yutu" : "koi";
          if (window.EggBabeHoloCardShowcase) {
            const setId = (crossStore.pets && crossStore.pets[pid] && crossStore.pets[pid].equippedSetId) || "";
            const moodInfo = Store.computeDailyMood(Store.getUtc8DateKey(), pid, careAll[pid]);
            window.EggBabeHoloCardShowcase.openEntityEggCard({
              petId: pid,
              store: crossStore,
              catalog: catalog,
              assetPrefix: "./",
              outfitName: getSetName(pid, setId),
              moodQuote: moodInfo && moodInfo.text ? `“${moodInfo.text}”` : "",
              isOrdinary: crossStore.profileMode === "wx-mp-ordinary",
              onTap: () => sfx.tap(),
              onOpenCurio: () => {
                activeDetailStoryPet = pid;
                openKeepsakeAlbum("keepsakes");
              }
            });
          } else {
            openKeepsakeAlbum("keepsakes");
          }
        },
        onPlayTap: () => sfx.tap(),
        onShowSceneFeedback: (msg, type) => showSceneFeedback(msg, type),
        Voice: Voice,
        onPersonaChange: () => {
          syncCareIndicators();
          renderMoodTab();
        }
      })
    : null;

  const tbSettingsBtn = $("tb-btn-settings");
  if (tbSettingsBtn) {
    tbSettingsBtn.addEventListener("click", () => {
      sfx.tap();
      setToolboxOpen(false);
      if (settingsPanel) settingsPanel.open("home");
    });
  }

  /* ---------- 17. 全量开放衣橱抽屉（套装 12/24 + 背景 12）与 780×1688 壁纸导出 ---------- */
  let activeWardrobeTab = "items"; // "items" | "bgs"

  function applyFittingCameraTransform() {
    if (!isFittingOpen) {
      cameraRigEl.style.transform = "none";
      return;
    }
    scrollToPanoX(CORK_HOME.x, false);
    const rt = petRuntimes[state.petId];
    const petPanoH = rt ? (rt.cfg.feetY * rt.cfg.baseScale * 0.94) : 530;
    const petScreenH = petPanoH * geom.panoScale;
    const topClearY = 58;
    const sheetTopY = geom.vh * 0.59;
    const availH = Math.max(180, sheetTopY - topClearY);
    const z = clamp((availH - 26) / Math.max(petScreenH, 1), 1.04, 1.32);

    const petMidPanoY = CORK_HOME.y - petPanoH * 0.50;
    const curMidScreenY = geom.oy + petMidPanoY * geom.panoScale;
    const targetMidY = topClearY + availH * 0.53;
    const originX = geom.ox + CORK_HOME.x * geom.panoScale;

    cameraRigEl.style.transformOrigin = `${originX.toFixed(1)}px ${curMidScreenY.toFixed(1)}px`;
    cameraRigEl.style.transform = `translate3d(0px, ${(targetMidY - curMidScreenY).toFixed(1)}px, 0) scale(${z.toFixed(3)})`;
  }

  async function enterFittingRoom() {
    if (isFittingOpen) return;
    if (state.roomState !== "free_stand") applyRoomState("free_stand", false);
    isFittingOpen = true;
    petPos = { x: CORK_HOME.x, y: CORK_HOME.y };
    hopMove = null;
    sleepZzEl.hidden = true;

    await initPet(state.petId);
    appEl.classList.add("is-fitting");
    fittingTopbarEl.setAttribute("aria-hidden", "false");
    wardrobeSheetEl.setAttribute("aria-hidden", "false");
    document.querySelectorAll("[data-fit-pet]").forEach((b) => b.classList.toggle("is-active", b.dataset.fitPet === state.petId));

    syncPanoramaImage(false);
    layoutScenePropsAndHotspots();
    applyFittingCameraTransform();
    renderWardrobeGrid();
    sfx.hop();
    startAnim("minihop", performance.now());
  }

  function exitFittingRoom() {
    if (!isFittingOpen) return;
    isFittingOpen = false;
    appEl.classList.remove("is-fitting");
    fittingTopbarEl.setAttribute("aria-hidden", "true");
    wardrobeSheetEl.setAttribute("aria-hidden", "true");
    cameraRigEl.style.transform = "none";
    layoutScenePropsAndHotspots();
    renderMoodTab();
    scrollToPanoX(CORK_HOME.x, true);
  }

  $("btn-exit-fitting").addEventListener("click", () => { sfx.tap(); exitFittingRoom(); });
  $("sheet-grabber").addEventListener("click", () => { sfx.tap(); exitFittingRoom(); });
  $("btn-confirm-outfit").addEventListener("click", () => {
    sfx.tap();
    exitFittingRoom();
    const eqName = getSetName(state.petId, state.savedSet[state.petId]);
    showSceneFeedback(eqName ? sayAsPet("outfit_done", `已换好「${eqName}」`) : "已恢复原生毛绒造型", eqName ? "dialogue" : "system");
  });

  document.querySelectorAll("[data-fit-pet]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      sfx.tap();
      await switchPet(btn.dataset.fitPet);
    });
  });

  document.querySelectorAll("[data-wtab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      sfx.tap();
      activeWardrobeTab = btn.dataset.wtab;
      document.querySelectorAll("[data-wtab]").forEach((b) => b.classList.toggle("is-active", b === btn));
      renderWardrobeGrid();
    });
  });

  function renderWardrobeGrid() {
    const pCfg = catalog.pets[state.petId];
    if (!pCfg) return;
    tabWardrobeItemsEl.textContent = `套装 (${pCfg.items.length})`;
    if (tabWardrobeBgsEl) {
      const bgTotal = 1 + (catalog.backgrounds ? catalog.backgrounds.length : 0);
      tabWardrobeBgsEl.textContent = `背景 (${bgTotal})`;
    }
    wardrobeGridEl.innerHTML = "";

    if (activeWardrobeTab === "items" || !tabWardrobeBgsEl) {
      const curSet = state.savedSet[state.petId];
      const bareCard = document.createElement("button");
      bareCard.type = "button";
      bareCard.className = "outfit-card" + (!curSet ? " is-selected" : "");
      bareCard.innerHTML =
        `<span class="outfit-card__plush-dot">原生毛绒</span>` +
        `<span class="outfit-card__name">不穿外套</span>` +
        (!curSet ? `<span class="outfit-card__check">✓</span>` : "");
      bareCard.addEventListener("click", () => {
        sfx.tap();
        state.savedSet[state.petId] = null;
        persistState();
        startAnim("minihop", performance.now());
        renderWardrobeGrid();
      });
      wardrobeGridEl.appendChild(bareCard);

      pCfg.items.forEach((item) => {
        const selected = state.savedSet[state.petId] === item.id;
        const card = document.createElement("button");
        card.type = "button";
        card.className = "outfit-card" + (selected ? " is-selected" : "");
        card.innerHTML =
          (selected ? `<span class="outfit-card__check">✓</span>` : "") +
          `<img class="outfit-card__thumb" src="${sharedUrl(item.thumb)}" alt="${item.name}" loading="lazy" />` +
          `<span class="outfit-card__name">${item.name}</span>`;

        card.addEventListener("click", async () => {
          sfx.tap();
          if (state.savedSet[state.petId] === item.id) {
            state.savedSet[state.petId] = null;
          } else {
            state.savedSet[state.petId] = item.id;
            Store.recordDailyEvent(crossStore, Store.getUtc8DateKey(), state.petId, {
              outfitId: item.id,
              countsAsEffective: false
            });
            await ensureSetLoaded(petRuntimes[state.petId], item.id);
            sfx.hop();
            startAnim("minihop", performance.now());
          }
          persistState();
          renderWardrobeGrid();
        });
        wardrobeGridEl.appendChild(card);
      });
    } else {
      // 背景页签：破壳起居室实景 + 11 套插画小屋背景
      const allBgs = [{ id: "living_room", name: "破壳起居室", thumbUrl: `./living-room-dress/panoramas/empty_${state.period}.png` }]
        .concat((catalog.backgrounds || []).map((b) => ({ id: b.id, name: b.name, thumbUrl: sharedUrl(b.file) })));

      allBgs.forEach((bg) => {
        const selected = state.stageBgId === bg.id;
        const card = document.createElement("button");
        card.type = "button";
        card.className = "outfit-card" + (selected ? " is-selected" : "");
        card.innerHTML =
          (selected ? `<span class="outfit-card__check">✓</span>` : "") +
          `<img class="outfit-card__bg-thumb" src="${bg.thumbUrl}" alt="${bg.name}" loading="lazy" />` +
          `<span class="outfit-card__name">${bg.name}</span>`;
        card.addEventListener("click", () => {
          sfx.tap();
          state.stageBgId = bg.id;
          persistState();
          syncCustomStageBg();
          layoutScenePropsAndHotspots();
          renderWardrobeGrid();
        });
        wardrobeGridEl.appendChild(card);
      });
    }
  }

  // 复用 wallpaperExporter.js 规格导出 780×1688 高清手机锁屏壁纸
  const htmlImgCache = new Map();
  function loadHtmlImg(src) {
    if (htmlImgCache.has(src)) return Promise.resolve(htmlImgCache.get(src));
    return new Promise((resolve, reject) => {
      const im = new Image();
      im.crossOrigin = "anonymous";
      im.onload = () => { htmlImgCache.set(src, im); resolve(im); };
      im.onerror = reject;
      im.src = src;
    });
  }

  async function exportLockscreenWallpaperJpg() {
    sfx.star();
    const W = 780, H = 1688;
    const pCfg = catalog.pets[state.petId];
    const setId = state.savedSet[state.petId];
    const setItem = setId ? pCfg.items.find((x) => x.id === setId) : null;
    const bodyUrl = sharedUrl(setItem ? setItem.tex : pCfg.textures.base);

    let bgUrl = `./living-room-dress/panoramas/empty_${state.period}.png`;
    let shadowRgba = "rgba(52, 32, 16, 0.34)";
    let cropCenter = true;
    if (state.stageBgId && state.stageBgId !== "living_room") {
      const foundBg = (catalog.backgrounds || []).find((b) => b.id === state.stageBgId);
      if (foundBg) {
        bgUrl = sharedUrl(foundBg.file);
        shadowRgba = foundBg.exportShadowRgba || shadowRgba;
        cropCenter = false;
      }
    }

    const [bgImg, bodyImg] = await Promise.all([loadHtmlImg(bgUrl), loadHtmlImg(bodyUrl)]);
    const cnv = document.createElement("canvas");
    cnv.width = W; cnv.height = H;
    const ctx = cnv.getContext("2d");

    const sc = Math.max(W / bgImg.width, H / bgImg.height);
    const nw = bgImg.width * sc, nh = bgImg.height * sc;
    ctx.drawImage(bgImg, cropCenter ? -(nw - W) * 0.49 : (W - nw) / 2, (H - nh) / 2, nw, nh);

    const fx = pCfg.exportFeetX || 390, fy = pCfg.exportFeetY || 1312;
    ctx.save();
    ctx.translate(fx + 10, fy - 4);
    ctx.scale(1, 0.28);
    const grad = ctx.createRadialGradient(0, 0, 12, 0, 0, 170);
    grad.addColorStop(0, shadowRgba);
    grad.addColorStop(0.55, "rgba(40, 26, 16, 0.12)");
    grad.addColorStop(1, "rgba(40, 26, 16, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(0, 0, 170, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    const es = pCfg.exportScale || (state.petId === "yutu" ? 0.7 : 0.88);
    ctx.drawImage(bodyImg, fx - pCfg.cx * es, fy - pCfg.feetY * es, pCfg.canvasW * es, pCfg.canvasH * es);

    const a = document.createElement("a");
    a.href = cnv.toDataURL("image/jpeg", 0.92);
    a.download = `eggbabe_wallpaper_${state.petId}_${state.stageBgId}.jpg`;
    a.click();
    showSceneFeedback("780×1688 高清手机壁纸已保存", "system");
  }

  $("btn-export-wallpaper").addEventListener("click", exportLockscreenWallpaperJpg);
  $("btn-snap-lookbook").addEventListener("click", async () => {
    sfx.tap();
    exitFittingRoom();
    const targetScene = state.stageBgId && state.stageBgId !== "living_room" ? state.stageBgId : "living_room";
    await openLetterOverlay(targetScene, false);
  });

  /* ---------- 18. 零 Token 带妆插画拍立得 × 红线折角信笺 × 纪念册 ---------- */
  const postcardArtCache = new Map();

  async function composeCleanIllustrationUrl(petId, setId, sceneId) {
    const cacheKey = `${petId}|${setId || "bare"}|${sceneId}|${state.period}`;
    if (postcardArtCache.has(cacheKey)) return postcardArtCache.get(cacheKey);

    const scenes = getAllPostcardScenes();
    const sc = scenes.find((s) => s.id === sceneId) || scenes[0];
    const rt = await initPet(petId);
    if (setId) await ensureSetLoaded(rt, setId);
    const bgImg = await loadHtmlImg(sc.src);

    const W = 800, H = 920;
    const out = document.createElement("canvas");
    out.width = W; out.height = H;
    const ctx = out.getContext("2d");

    const bScale = Math.max(W / bgImg.width, H / bgImg.height);
    const bw = bgImg.width * bScale, bh = bgImg.height * bScale;
    ctx.drawImage(bgImg, sc.cropCenter ? -(bw - W) * 0.49 : (W - bw) / 2, (H - bh) / 2, bw, bh);

    const footY = H * 0.86;
    const gSoft = ctx.createRadialGradient(W * 0.5, footY + 6, 8, W * 0.5, footY + 6, 155);
    gSoft.addColorStop(0, sc.shadowRgba);
    gSoft.addColorStop(1, "rgba(0,0,0,0)");
    ctx.save();
    ctx.translate(W * 0.5, footY + 6);
    ctx.scale(1, 0.30);
    ctx.translate(-W * 0.5, -(footY + 6));
    ctx.fillStyle = gSoft;
    ctx.beginPath(); ctx.arc(W * 0.5, footY + 6, 155, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    spring.t = -1;
    let snapPose = makePose({ headRot: 5.5, earL: 3, earR: 6 });
    let happy = false;
    let faceId = null;
    if (sc.pose === "cute") { snapPose = makePose({ headRot: -4, sy: 0.98, sx: 1.02 }); happy = true; }
    else if (sc.pose === "jump") { snapPose = makePose({ hopY: -36, sy: 1.03, sx: 0.97, earL: 6, earR: -6 }); happy = true; faceId = petId === "koi" ? "laugh" : null; }

    renderPetFrame(rt, snapPose, setId, performance.now(), {
      x: PANO_W * 0.5, y: PANO_H * 0.84, scaleK: 1.32, happy, faceId
    });

    const petLayer = document.createElement("canvas");
    petLayer.width = W; petLayer.height = H;
    const pCtx = petLayer.getContext("2d");
    const cropH = glCanvas.height;
    const cropW = Math.round(cropH * (W / H));
    pCtx.drawImage(glCanvas, Math.round((glCanvas.width - cropW) / 2), 0, cropW, cropH, 0, Math.round(H * 0.02), W, H);
    pCtx.globalCompositeOperation = "source-atop";
    pCtx.fillStyle = sc.tint;
    pCtx.fillRect(0, 0, W, H);
    ctx.drawImage(petLayer, 0, 0);

    const url = out.toDataURL("image/jpeg", 0.90);
    postcardArtCache.set(cacheKey, url);
    return url;
  }

  async function exportFullPolaroidCardJpg(meta) {
    const artUrl = await composeCleanIllustrationUrl(meta.petId, meta.setId, meta.sceneId);
    const artImg = await loadHtmlImg(artUrl);
    const scenes = getAllPostcardScenes();
    const sc = scenes.find((s) => s.id === meta.sceneId) || scenes[0];
    const outfitName = getSetName(meta.petId, meta.setId) || "原生毛绒";
    const story = sc.copy[meta.petId];

    const W = 880, H = 1190;
    const cnv = document.createElement("canvas");
    cnv.width = W; cnv.height = H;
    const c = cnv.getContext("2d");

    c.fillStyle = "#FFFDF8";
    c.fillRect(0, 0, W, H);
    c.drawImage(artImg, 40, 40, 800, 920);

    c.fillStyle = "#002900";
    c.font = "600 30px 'PingFang SC', sans-serif";
    c.fillText(sc.label, 44, 1012);

    c.fillStyle = "#8C8C88";
    c.font = "500 22px 'PingFang SC', sans-serif";
    const tag = `身穿 · ${outfitName}`;
    c.fillText(tag, W - 44 - c.measureText(tag).width, 1010);

    c.fillStyle = "#35483C";
    c.font = "24px 'Kaiti SC', 'STKaiti', serif";
    let line = "", y = 1064;
    for (const ch of story) {
      if (c.measureText(line + ch).width > 790) {
        c.fillText(line, 44, y);
        line = ch; y += 36;
      } else line += ch;
    }
    if (line) c.fillText(line, 44, y);

    c.fillStyle = "#8C8C88";
    c.font = "20px 'PingFang SC', sans-serif";
    c.fillText(meta.dateText || "", 44, H - 30);

    const a = document.createElement("a");
    a.href = cnv.toDataURL("image/jpeg", 0.92);
    a.download = `eggbabe_postcard_${meta.sceneId}_${Date.now()}.jpg`;
    a.click();
  }

  let activeLetterMeta = null;
  let letterGivesStar = false;

  async function updateLetterScene(sceneId) {
    const scenes = getAllPostcardScenes();
    const sc = scenes.find((s) => s.id === sceneId) || scenes[0];
    const petId = state.petId;
    const setId = state.savedSet[petId];
    const outfitName = getSetName(petId, setId) || "原生毛绒";
    const now = new Date();
    const dateText = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}`;

    activeLetterMeta = { id: `pc_${Date.now()}`, sceneId: sc.id, petId, setId, dateText, createdAt: Date.now() };
    postcardScenePillsEl.innerHTML = "";
    scenes.forEach((item) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "postcard-scene-pill" + (item.id === sc.id ? " is-active" : "");
      b.textContent = item.label;
      b.addEventListener("click", () => { sfx.tap(); updateLetterScene(item.id); });
      postcardScenePillsEl.appendChild(b);
    });

    letterTitleEl.textContent = `寄自 · ${sc.label}`;
    letterLineEl.textContent = `“${sc.copy[petId]}”`;
    polaroidPlaceEl.textContent = sc.label;
    polaroidOutfitEl.textContent = `身穿 · ${outfitName}`;
    letterPolaroidImgEl.src = await composeCleanIllustrationUrl(petId, setId, sc.id);
  }

  async function openLetterOverlay(defaultSceneId, awardUnreadStars) {
    letterGivesStar = !!awardUnreadStars;
    letterAwardBoxEl.hidden = !letterGivesStar;
    if (letterGivesStar) {
      letterAwardPlusEl.textContent = "+8";
      sfx.star();
    }
    letterOverlayEl.hidden = false;
    await updateLetterScene(defaultSceneId || "bg_sunset_meadow");
  }

  btnContextEntryEl.addEventListener("click", async () => {
    sfx.tap();
    triggerRebound(btnContextEntryEl);
    await openLetterOverlay(state.stageBgId !== "living_room" ? state.stageBgId : "bg_sunset_meadow", state.unreadMail);
  });
  $("btn-close-letter").addEventListener("click", () => { sfx.tap(); letterOverlayEl.hidden = true; });
  $("btn-download-polaroid").addEventListener("click", async () => {
    if (!activeLetterMeta) return;
    sfx.tap();
    await exportFullPolaroidCardJpg(activeLetterMeta);
    showSceneFeedback("拍立得相片已保存", "system");
  });
  $("btn-collect-letter").addEventListener("click", async () => {
    if (!activeLetterMeta) return;
    sfx.star();
    const postcardMeta = {
      id: activeLetterMeta.id || ("pc_" + Date.now()),
      petId: activeLetterMeta.petId,
      outfitId: activeLetterMeta.outfitId || activeLetterMeta.setId,
      setId: activeLetterMeta.setId || activeLetterMeta.outfitId,
      sceneId: activeLetterMeta.sceneId,
      text: activeLetterMeta.text || "",
      dateText: activeLetterMeta.dateText || "",
      createdAt: Store.getUtc8IsoString()
    };
    state.postcards.unshift(postcardMeta);
    state.postcards = state.postcards.slice(0, 60);
    state.unreadMail = false;
    crossStore.companion.dailyLetterClaimedDate = Store.getUtc8DateKey();
    Store.recordDailyEvent(crossStore, Store.getUtc8DateKey(), postcardMeta.petId, {
      outfitId: postcardMeta.outfitId
    });
    tbAlbumDotEl.hidden = false;

    const artUrl = await composeCleanIllustrationUrl(postcardMeta.petId, postcardMeta.setId, postcardMeta.sceneId);
    wallPolaroidImgEl.src = artUrl;
    letterOverlayEl.hidden = true;

    if (state.roomState === "away") applyRoomState("free_stand", true);
    else {
      renderContextEntry();
      layoutScenePropsAndHotspots();
    }
    if (letterGivesStar) animateStarsTo(state.stars + 8, 8);
    else persistState();
    renderMoodTab();
    showSceneFeedback("明信片已收进纪念册", "system");
  });

  wallPolaroidEl.addEventListener("click", (ev) => {
    ev.stopPropagation(); sfx.tap();
    if (state.postcards.length > 0) openDetailView("postcard", state.postcards[0]);
  });

  /* ---------- 19. 全屏 #FAFAF8 纪念册、P2 木质博古收藏格与详情页 ---------- */
  let currentAlbumTab = "keepsakes";
  let activeDetailPostcard = null;
  let activeDetailKeepsake = null;
  let activeDetailStoryPet = "yutu";
  let curioArrangeMode = false;
  let curioSelectedSlotIdx = -1;
  let curioPickerTargetSlot = -1;
  const SHELF_SLOT_COUNT = (Store && Store.SHELF_SLOT_COUNT) || 50;

  function getAllCatalogKeepsakes() {
    if (catalog && Array.isArray(catalog.keepsakes) && catalog.keepsakes.length > 0) {
      return catalog.keepsakes;
    }
    return Object.values(KEPSAKE_DEFS).map((k) => ({
      id: Store.keepsakeAliasNormalizer([k.id]).unlockedIds[0] || k.id,
      name: k.name,
      category: "daily",
      categoryLabel: "旅途日常",
      img: k.img,
      lineImg: k.img,
      sourceHint: "日常回忆",
      clue: "多在房间里陪它待一会儿，也许就会遇见它。",
      story: k.story
    }));
  }

  function getKeepsakeById(rawId) {
    if (!rawId) return null;
    const norm = Store.keepsakeAliasNormalizer([rawId]);
    const cid = norm.unlockedIds[0] || rawId;
    return getAllCatalogKeepsakes().find((k) => k.id === cid) || null;
  }

  function ensureShelfSlots() {
    if (!Array.isArray(crossStore.curioCabinet.shelfSlots) || crossStore.curioCabinet.shelfSlots.length !== SHELF_SLOT_COUNT) {
      crossStore.curioCabinet.shelfSlots = Store.buildShelfSlots(state.keepsakes, crossStore.curioCabinet.shelfSlots);
    }
    return crossStore.curioCabinet.shelfSlots;
  }

  function unlockKeepsake(rawId, source) {
    if (!rawId) return false;
    const norm = Store.keepsakeAliasNormalizer([rawId]);
    const cid = norm.unlockedIds[0] || rawId;
    if (state.keepsakes.includes(cid)) return false;
    state.keepsakes.unshift(cid);
    const slots = ensureShelfSlots();
    if (!slots.includes(cid)) {
      const emptyIdx = slots.indexOf(null);
      if (emptyIdx >= 0) slots[emptyIdx] = cid;
    }
    crossStore.curioCabinet.unlockedMeta[cid] = {
      unlockedAt: Store.getUtc8IsoString(),
      source: source || "companion",
      isNew: true
    };
    tbAlbumDotEl.hidden = false;
    persistState();
    return true;
  }

  function renderCurioShelf() {
    const slots = ensureShelfSlots();
    const placedCount = slots.filter(Boolean).length;
    curioPlacedCountEl.textContent = `已摆 ${placedCount}/${SHELF_SLOT_COUNT} 格`;
    btnCurioArrangeEl.textContent = curioArrangeMode ? "✓ 完成摆放" : "✨ 摆放收藏品";
    btnCurioArrangeEl.classList.toggle("is-active", curioArrangeMode);
    curioArrangeHintEl.hidden = !curioArrangeMode;

    curioShelfGridEl.innerHTML = "";
    for (let i = 0; i < SHELF_SLOT_COUNT; i++) {
      const kid = slots[i];
      const item = kid ? getKeepsakeById(kid) : null;
      const cell = document.createElement("button");
      cell.type = "button";
      cell.dataset.slotIdx = String(i);
      cell.className = "oak-slot" + (item ? "" : " oak-slot--empty") + (curioSelectedSlotIdx === i ? " is-selected" : "");

      if (item) {
        cell.setAttribute("aria-label", `第 ${i + 1} 格：${item.name}`);
        cell.innerHTML =
          `<span class="oak-slot__figure"><img class="oak-slot__img" src="${sharedUrl(item.img)}" alt="${item.name}" loading="lazy" /></span>` +
          `<span class="oak-slot__plate">${item.name}</span>`;
      } else {
        cell.setAttribute("aria-label", `第 ${i + 1} 格：空木格，点击摆入收藏品`);
        cell.innerHTML = `<span class="oak-slot__plus">+</span><span class="oak-slot__empty-label">空木格</span>`;
      }

      cell.addEventListener("click", () => {
        sfx.tap();
        handleCurioSlotClick(i);
      });
      curioShelfGridEl.appendChild(cell);
    }
    if (typeof syncBookshelfCurioMinis === "function") {
      syncBookshelfCurioMinis();
    }
  }

  function handleCurioSlotClick(slotIdx) {
    const slots = ensureShelfSlots();
    const currentId = slots[slotIdx];

    if (curioArrangeMode) {
      if (curioSelectedSlotIdx === -1) {
        curioSelectedSlotIdx = slotIdx;
        renderCurioShelf();
        if (!currentId) {
          openCurioPicker(slotIdx);
          curioSelectedSlotIdx = -1;
          renderCurioShelf();
        }
      } else if (curioSelectedSlotIdx === slotIdx) {
        curioSelectedSlotIdx = -1;
        renderCurioShelf();
        openCurioPicker(slotIdx);
      } else {
        const prevIdx = curioSelectedSlotIdx;
        const tmp = slots[prevIdx];
        slots[prevIdx] = slots[slotIdx];
        slots[slotIdx] = tmp;
        curioSelectedSlotIdx = -1;
        persistState();
        renderCurioShelf();
        showSceneFeedback("已调换多宝格陈列位置", "system");
      }
      return;
    }

    if (currentId) {
      const item = getKeepsakeById(currentId);
      if (item) openDetailView("keepsake", item);
    } else {
      openCurioPicker(slotIdx);
    }
  }

  function openCurioPicker(slotIdx) {
    curioPickerTargetSlot = slotIdx;
    const slots = ensureShelfSlots();
    const curId = slots[slotIdx];
    curioPickerTitleEl.textContent = `选择摆入第 ${slotIdx + 1} 格的小物件`;
    btnCurioClearSlotEl.hidden = !curId;
    curioPickerListEl.innerHTML = "";

    const unlockedItems = state.keepsakes.map((id) => getKeepsakeById(id)).filter(Boolean);
    if (unlockedItems.length === 0) {
      curioPickerListEl.innerHTML = `<p style="grid-column:1/-1;text-align:center;color:#8C8274;font-size:12px;">还没有小物件，先在房间陪它玩一会儿吧</p>`;
    } else {
      unlockedItems.forEach((it) => {
        const placedIdx = slots.indexOf(it.id);
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "curio-picker-opt" + (placedIdx >= 0 ? " is-placed" : "");
        btn.innerHTML =
          `<img src="${sharedUrl(it.img)}" alt="${it.name}" />` +
          `<span>${it.name}${placedIdx >= 0 ? ` (#${placedIdx + 1})` : ""}</span>`;
        btn.addEventListener("click", () => {
          sfx.tap();
          placeKeepsakeInSlot(it.id, slotIdx);
          curioPickerOverlayEl.hidden = true;
        });
        curioPickerListEl.appendChild(btn);
      });
    }
    curioPickerOverlayEl.hidden = false;
  }

  function placeKeepsakeInSlot(keepsakeId, targetIdx) {
    const slots = ensureShelfSlots();
    const oldIdx = slots.indexOf(keepsakeId);
    if (oldIdx >= 0 && oldIdx !== targetIdx) {
      slots[oldIdx] = slots[targetIdx];
    }
    slots[targetIdx] = keepsakeId;
    persistState();
    renderCurioShelf();
    showSceneFeedback("已摆进暖橡木多宝格", "system");
  }

  let activeClueItem = null;
  function openKeepsakeClue(item) {
    activeClueItem = item;
    clueLineImgEl.src = sharedUrl(item.lineImg);
    clueLineImgEl.alt = item.name;
    clueCategoryTagEl.textContent = item.categoryLabel || "旅途日常";
    clueTitleEl.textContent = item.name;
    clueTextEl.textContent = item.clue || "多在房间里陪它待一会儿，也许就会遇见它。";
    clueSourceEl.textContent = item.sourceHint ? `拾物途径：${item.sourceHint}` : "";
    keepsakeClueOverlayEl.hidden = false;
  }

  async function renderAlbumGrid() {
    document.querySelectorAll("[data-album-tab]").forEach((t) => t.classList.toggle("keepsake-tab--active", t.dataset.albumTab === currentAlbumTab));
    const lookbookViewEl = $("lookbook-album-view");
    const diaryViewEl = $("diary-book-view");
    keepsakeGridEl.innerHTML = "";
    if (lookbookViewEl) lookbookViewEl.hidden = currentAlbumTab !== "album";
    if (diaryViewEl) diaryViewEl.hidden = currentAlbumTab !== "diary";
    curioCabinetViewEl.hidden = currentAlbumTab !== "keepsakes";

    if (currentAlbumTab === "keepsakes") {
      keepsakeEmptyEl.hidden = true;
      keepsakeGridEl.hidden = true;
      renderCurioShelf();
    } else if (currentAlbumTab === "album") {
      keepsakeEmptyEl.hidden = true;
      keepsakeGridEl.hidden = true;
      if (typeof renderLookbookAlbum === "function") renderLookbookAlbum();
    } else if (currentAlbumTab === "diary") {
      keepsakeEmptyEl.hidden = true;
      keepsakeGridEl.hidden = true;
      if (typeof renderDiaryView === "function") await renderDiaryView();
    } else {
      keepsakeGridEl.hidden = false;
      const list = state.postcards;
      const scenes = getAllPostcardScenes();
      keepsakeEmptyEl.hidden = list.length > 0;
      list.forEach((pc) => {
        const sc = scenes.find((s) => s.id === pc.sceneId) || scenes[0];
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "keepsake-cell keepsake-cell--postcard";
        cell.innerHTML = `<div class="keepsake-cell__media"><img alt="${sc.label}" /></div><div class="keepsake-cell__label">${sc.label}</div>`;
        composeCleanIllustrationUrl(pc.petId, pc.setId, pc.sceneId).then((url) => {
          const im = cell.querySelector("img");
          if (im) im.src = url;
        });
        cell.addEventListener("click", () => { sfx.tap(); openDetailView("postcard", pc); });
        keepsakeGridEl.appendChild(cell);
      });
    }
  }

  function openKeepsakeAlbum(tab) {
    currentAlbumTab = tab || "keepsakes";
    curioArrangeMode = false;
    curioSelectedSlotIdx = -1;
    albumViewEl.hidden = false;
    renderAlbumGrid();
  }

  function renderDetailKeepsakeStory() {
    if (!activeDetailKeepsake) return;
    const item = activeDetailKeepsake;
    if (item.stories && item.stories.yutu && item.stories.koi) {
      detailPetStorySegEl.hidden = false;
      document.querySelectorAll("[data-story-pet]").forEach((b) => {
        b.classList.toggle("is-active", b.dataset.storyPet === activeDetailStoryPet);
      });
      detailStoryEl.textContent = item.stories[activeDetailStoryPet] || item.stories.yutu;
    } else {
      detailPetStorySegEl.hidden = true;
      detailStoryEl.textContent = item.story || "";
    }
    const slots = ensureShelfSlots();
    const placedIdx = slots.indexOf(item.id);
    detailPlaceCabinetTextEl.textContent = placedIdx >= 0 ? `已摆在第 ${placedIdx + 1} 格` : "摆进多宝格";
  }

  async function openDetailView(kind, item) {
    detailViewEl.hidden = false;
    if (kind === "keepsake") {
      activeDetailPostcard = null;
      activeDetailKeepsake = item;
      activeDetailStoryPet = state.petId === "koi" ? "koi" : "yutu";
      detailNavTitleEl.textContent = "收藏品详情";
      detailHeroImgEl.src = sharedUrl(item.img);
      detailTitleEl.textContent = item.name;
      detailBadgeEl.textContent = item.categoryLabel || "日常回忆";
      const meta = crossStore.curioCabinet.unlockedMeta && crossStore.curioCabinet.unlockedMeta[item.id];
      const dateStr = meta && meta.unlockedAt ? String(meta.unlockedAt).slice(0, 10) : "";
      detailDateEl.textContent = dateStr ? `留存日期 · ${dateStr}` : "";
      detailKeepsakeActionsEl.hidden = false;
      detailDownloadWrapEl.hidden = true;
      renderDetailKeepsakeStory();
    } else {
      activeDetailPostcard = item;
      activeDetailKeepsake = null;
      detailPetStorySegEl.hidden = true;
      detailKeepsakeActionsEl.hidden = true;
      const scenes = getAllPostcardScenes();
      const sc = scenes.find((s) => s.id === item.sceneId) || scenes[0];
      const outfitName = getSetName(item.petId, item.setId) || "原生毛绒";
      detailNavTitleEl.textContent = "明信片";
      detailHeroImgEl.src = await composeCleanIllustrationUrl(item.petId, item.setId, item.sceneId);
      detailTitleEl.textContent = sc.label;
      detailBadgeEl.textContent = `身穿 · ${outfitName}`;
      detailStoryEl.textContent = sc.copy[item.petId];
      detailDateEl.textContent = item.dateText || "";
      detailDownloadWrapEl.hidden = false;
    }
  }

  document.querySelectorAll("[data-album-tab]").forEach((b) => b.addEventListener("click", () => {
    sfx.tap();
    currentAlbumTab = b.dataset.albumTab;
    renderAlbumGrid();
  }));
  btnCurioArrangeEl.addEventListener("click", () => {
    sfx.tap();
    curioArrangeMode = !curioArrangeMode;
    curioSelectedSlotIdx = -1;
    renderCurioShelf();
  });
  $("btn-close-curio-picker").addEventListener("click", () => { sfx.tap(); curioPickerOverlayEl.hidden = true; });
  curioPickerOverlayEl.addEventListener("click", (ev) => {
    if (ev.target === curioPickerOverlayEl) { sfx.tap(); curioPickerOverlayEl.hidden = true; }
  });
  btnCurioClearSlotEl.addEventListener("click", () => {
    if (curioPickerTargetSlot >= 0) {
      sfx.tap();
      const slots = ensureShelfSlots();
      slots[curioPickerTargetSlot] = null;
      persistState();
      renderCurioShelf();
      showSceneFeedback("已从当前木格移下", "system");
    }
    curioPickerOverlayEl.hidden = true;
  });
  $("btn-close-clue").addEventListener("click", () => { sfx.tap(); keepsakeClueOverlayEl.hidden = true; });
  keepsakeClueOverlayEl.addEventListener("click", (ev) => {
    if (ev.target === keepsakeClueOverlayEl) { sfx.tap(); keepsakeClueOverlayEl.hidden = true; }
  });
  document.querySelectorAll("[data-story-pet]").forEach((btn) => {
    btn.addEventListener("click", () => {
      sfx.tap();
      activeDetailStoryPet = btn.dataset.storyPet === "koi" ? "koi" : "yutu";
      renderDetailKeepsakeStory();
    });
  });
  $("btn-detail-place-cabinet").addEventListener("click", () => {
    if (!activeDetailKeepsake) return;
    sfx.tap();
    const slots = ensureShelfSlots();
    if (slots.includes(activeDetailKeepsake.id)) {
      showSceneFeedback("这件小物件已经在多宝格中展示啦", "system");
      return;
    }
    const emptyIdx = slots.indexOf(null);
    const targetIdx = emptyIdx >= 0 ? emptyIdx : SHELF_SLOT_COUNT - 1;
    placeKeepsakeInSlot(activeDetailKeepsake.id, targetIdx);
    renderDetailKeepsakeStory();
  });
  $("btn-detail-holo-view")?.addEventListener("click", () => {
    if (!activeDetailKeepsake || !window.EggBabeHoloCardShowcase) return;
    sfx.tap();
    const allKs = getAllCatalogKeepsakes();
    const idx = allKs.findIndex((k) => k.id === activeDetailKeepsake.id);
    const serial = idx >= 0
      ? `${String(idx + 1).padStart(3, "0")}/${String(allKs.length).padStart(3, "0")}`
      : "001/041";
    window.EggBabeHoloCardShowcase.openKeepsakeCard(activeDetailKeepsake, {
      assetPrefix: "./",
      serial,
      activePetId: activeDetailStoryPet || state.petId,
      isOrdinary: crossStore.profileMode === "wx-mp-ordinary",
      onTap: () => sfx.tap()
    });
  });
  $("btn-curio-open-pack")?.addEventListener("click", () => {
    sfx.tap();
    const packAct = ACTIVITIES.find((a) => a.id === "holo-pack");
    if (packAct) {
      albumViewEl.hidden = true;
      openActivityPlayer(packAct);
    }
  });

  $("btn-close-album").addEventListener("click", () => { sfx.tap(); albumViewEl.hidden = true; });
  $("btn-close-detail").addEventListener("click", () => { sfx.tap(); detailViewEl.hidden = true; });
  $("btn-detail-download").addEventListener("click", async () => {
    if (!activeDetailPostcard) return;
    sfx.tap();
    await exportFullPolaroidCardJpg(activeDetailPostcard);
    showSceneFeedback("高清拍立得已保存", "system");
  });

  /* ---------- 20. 右上 DEV-ONLY 验收工具菜单 ---------- */
  function buildDevTesterMenus() {
    const menuPeriod = $("menu-period");
    menuPeriod.innerHTML = "";
    [{ key: "day", label: "白天" }, { key: "night", label: "夜晚" }].forEach((o) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "tester-option" + (state.period === o.key ? " tester-option--active" : "");
      b.innerHTML = `<span>${o.label}</span><span>${state.period === o.key ? "✓" : ""}</span>`;
      b.addEventListener("click", () => {
        state.period = o.key;
        appEl.dataset.period = o.key;
        syncPanoramaImage(false);
        syncRoomModules();
        renderBlackCatClockUI();
        closeAllTesterMenus();
        buildDevTesterMenus();
      });
      menuPeriod.appendChild(b);
    });

    const menuState = $("menu-state");
    menuState.innerHTML = "";
    Object.values(ROOM_STATES).forEach((st) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "tester-option" + (state.roomState === st.key ? " tester-option--active" : "");
      b.innerHTML = `<span>${st.label}</span><span>${state.roomState === st.key ? "✓" : ""}</span>`;
      b.addEventListener("click", () => {
        if (st.key !== "free_stand") state.stageBgId = "living_room";
        applyRoomState(st.key, true);
        closeAllTesterMenus();
        buildDevTesterMenus();
      });
      menuState.appendChild(b);
    });
    [
      {
        label: "模拟很饿（咕噜噜）",
        active: isPetHungryNow(),
        run: () => { careAll[state.petId].hunger = 15; saveCareAll(); renderMoodTab(); }
      },
      {
        label: "模拟很臭（脏兮兮）",
        active: isPetDirtyNow(),
        run: () => { careAll[state.petId].hygiene = 15; saveCareAll(); renderMoodTab(); }
      },
      {
        label: "恢复香香饱饱",
        active: !isPetHungryNow() && !isPetDirtyNow(),
        run: () => { careAll[state.petId].hunger = 92; careAll[state.petId].hygiene = 94; saveCareAll(); renderMoodTab(); }
      }
    ].forEach((demo) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "tester-option" + (demo.active ? " tester-option--active" : "");
      b.innerHTML = `<span>${demo.label}</span><span>${demo.active ? "✓" : ""}</span>`;
      b.addEventListener("click", () => {
        demo.run();
        closeAllTesterMenus();
        buildDevTesterMenus();
      });
      menuState.appendChild(b);
    });

    const menuPet = $("menu-pet");
    menuPet.innerHTML = "";
    [{ key: "koi", label: "锦鲤 (12套)" }, { key: "yutu", label: "玉兔 (24套)" }].forEach((p) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "tester-option" + (state.petId === p.key ? " tester-option--active" : "");
      b.innerHTML = `<span>${p.label}</span><span>${state.petId === p.key ? "✓" : ""}</span>`;
      b.addEventListener("click", async () => {
        await switchPet(p.key);
        closeAllTesterMenus();
        buildDevTesterMenus();
      });
      menuPet.appendChild(b);
    });

    const menuCare = $("menu-care");
    menuCare.innerHTML = "";
    [
      { label: "模拟变饿 + 变脏", fn: () => { ["koi", "yutu"].forEach((id) => { careAll[id].hunger = 18; careAll[id].hygiene = 18; }); saveCareAll(); renderMoodTab(); showSceneFeedback("已模拟 8 小时后变饿变脏提醒", "system"); } },
      { label: "恢复满状态", fn: () => { ["koi", "yutu"].forEach((id) => { careAll[id].hunger = 95; careAll[id].hygiene = 98; }); saveCareAll(); renderMoodTab(); showSceneFeedback("已恢复饱满干净状态", "system"); } },
      {
        label: "模拟解锁 8 件藏品",
        fn: () => {
          ["k_a01_prayer_stick", "k_a02_copper_coin", "k_r01_yellow_rubber_duck", "jade_rabbit_helmet", "k_k01_lotus_leaf_bookmark", "k_k07_dried_paint_palette", "old_wooden_button", "dried_tea_tag"].forEach((id) => unlockKeepsake(id, "demo_tester"));
          renderMoodTab();
          syncRoomModules();
          if (!albumViewEl.hidden) renderAlbumGrid();
          showSceneFeedback("已模拟解锁 8 件含 A/B/D 线藏品", "system");
        }
      },
      {
        label: "模拟陪伴 +7 天 & +180✦（测厨房/小院）",
        fn: () => {
          crossStore.companion.totalCompanionDays = Math.max(7, Number(crossStore.companion.totalCompanionDays || 1) + 7);
          crossStore.companion.companionDays = Math.max(7, Number(crossStore.companion.companionDays || 1) + 7);
          state.totalCompanionDays = crossStore.companion.totalCompanionDays;
          state.companionDays = crossStore.companion.companionDays;
          state.stars = Number(state.stars || 0) + 180;
          crossStore.companion.starBalance = state.stars;
          persistState();
          renderMoodTab();
          updateEdgeRoomSigns();
          showSceneFeedback("已模拟累计陪伴 +7 天与 +180✦，可测试解锁小厨房与小院子", "system");
        }
      }
    ].forEach((act) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "tester-option";
      b.innerHTML = `<span>${act.label}</span>`;
      b.addEventListener("click", () => { act.fn(); closeAllTesterMenus(); });
      menuCare.appendChild(b);
    });

    const menuProfileMode = $("menu-profileMode");
    if (menuProfileMode) {
      menuProfileMode.innerHTML = "";
      Store.PROFILE_MODES.forEach((m) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "tester-option" + (crossStore.profileMode === m ? " tester-option--active" : "");
        b.innerHTML = `<span>${m}</span><span>${crossStore.profileMode === m ? "✓" : ""}</span>`;
        b.addEventListener("click", () => {
          crossStore.profileMode = m;
          crossStore.user.authProvider = m;
          persistState();
          renderMoodTab();
          if (!profileModalEl.hidden) renderProfileModal();
          if (!albumViewEl.hidden) renderAlbumGrid();
          closeAllTesterMenus();
          buildDevTesterMenus();
          showSceneFeedback(`已切换 profileMode：${m}`, "system");
        });
        menuProfileMode.appendChild(b);
      });
    }
    updateDevTesterLabels();
  }

  function updateDevTesterLabels() {
    const pMap = { day: "白天", night: "夜晚" };
    $("tester-period-label").textContent = pMap[state.period] || "白天";
    $("tester-state-label").textContent = (ROOM_STATES[state.roomState] || ROOM_STATES.free_stand).label;
    $("tester-pet-label").textContent = state.petId === "yutu" ? "玉兔" : "锦鲤";
    const pmLabel = $("tester-profile-mode-label");
    if (pmLabel) pmLabel.textContent = crossStore.profileMode || "h5";
  }

  function closeAllTesterMenus() {
    ["menu-period", "menu-state", "menu-pet", "menu-care", "menu-profileMode"].forEach((id) => {
      const el = $(id);
      if (el) el.hidden = true;
    });
  }
  btnAcceptanceToggleEl.addEventListener("click", () => {
    const open = acceptanceStackEl.hidden;
    acceptanceStackEl.hidden = !open;
    acceptanceChevronEl.textContent = open ? "⌃" : "⌄";
    if (!open) closeAllTesterMenus();
  });
  document.querySelectorAll("[data-tester]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = $("menu-" + btn.dataset.tester);
      if (!target) return;
      const wasHidden = target.hidden;
      closeAllTesterMenus();
      target.hidden = !wasHidden;
    });
  });

  /* ---------- 21. P3 原木书架中枢、缝线手帐日记 & P5 软装/多房间/轻小游戏 ---------- */
  let activeDiaryIndex = 0;
  let pendingWelcomeBackNote = "";
  let activeHouseTab = "rooms";
  let activeMiniGameCleanup = null;

  function syncBookshelfCurioMinis() {
    const slots = ensureShelfSlots();
    const top3 = slots.slice(0, 3);
    const roomMiniEl = $("mod-books-curio-minis");
    const hubMiniEl = $("shelf-hub-curio-preview");
    const renderInto = (container, isHub) => {
      if (!container) return;
      container.innerHTML = "";
      top3.forEach((id) => {
        if (!id) return;
        const item = getKeepsakeById(id);
        if (!item) return;
        if (isHub) {
          const im = document.createElement("img");
          im.src = sharedUrl(item.img);
          im.alt = item.name;
          container.appendChild(im);
        } else {
          const wrap = document.createElement("span");
          wrap.className = "mod-books__curio-mini";
          wrap.innerHTML = `<img src="${sharedUrl(item.img)}" alt="${item.name}" />`;
          container.appendChild(wrap);
        }
      });
      if (isHub && container.children.length === 0) {
        container.innerHTML = `<span class="bookshelf-slot__icon">🏺</span>`;
      }
    };
    renderInto(roomMiniEl, false);
    renderInto(hubMiniEl, true);
  }

  const bookshelfHubOverlayEl = $("bookshelf-hub-overlay");
  function openBookshelfHub() {
    if (!bookshelfHubOverlayEl) return;
    syncBookshelfCurioMinis();
    const isOrdinary = crossStore.profileMode === "wx-mp-ordinary";
    const diaryCount = Array.isArray(crossStore.diaries) ? crossStore.diaries.length : 0;
    const unlockedCount = (crossStore.curioCabinet && crossStore.curioCabinet.unlockedIds || []).length;
    const lookbookCount = Array.isArray(crossStore.lookbookPhotos) ? crossStore.lookbookPhotos.length : 0;
    const unlockedRooms = (crossStore.house && crossStore.house.unlockedRoomIds || ["living_room"]).length;

    const shelfDiarySub = $("shelf-diary-sub");
    const shelfMailSub = $("shelf-mail-sub");
    const shelfCurioSub = $("shelf-curio-sub");
    const shelfAlbumSub = $("shelf-album-sub");
    const shelfGamesTitle = $("shelf-games-title");
    const shelfHouseSub = $("shelf-house-sub");

    if (shelfDiarySub) shelfDiarySub.textContent = diaryCount > 0 ? `已装订 ${diaryCount} 篇冷幽默手帐` : "轻触翻开缝线手帐本";
    if (shelfMailSub) shelfMailSub.textContent = state.unreadMail ? "✨ 有一封待拆新来信" : `已收藏 ${state.postcards.length} 张明信片`;
    if (shelfCurioSub) shelfCurioSub.textContent = isOrdinary ? `已留存 ${unlockedCount} 件` : `已收集 ${unlockedCount} / ${getAllKeepsakes().length}`;
    if (shelfAlbumSub) shelfAlbumSub.textContent = lookbookCount > 0 ? `已定格 ${lookbookCount} 张定妆照` : "36 套穿搭零 Token 随时拍";
    if (shelfGamesTitle) shelfGamesTitle.textContent = isOrdinary ? "陪伴互动匣" : "小游戏玩具木盒";
    if (shelfHouseSub) shelfHouseSub.textContent = `已开放 ${unlockedRooms} 处空间 · 软装升级`;

    bookshelfHubOverlayEl.hidden = false;
  }

  function closeBookshelfHub() {
    if (bookshelfHubOverlayEl) bookshelfHubOverlayEl.hidden = true;
  }

  $("btn-close-bookshelf-hub")?.addEventListener("click", () => { sfx.tap(); closeBookshelfHub(); });
  bookshelfHubOverlayEl?.addEventListener("click", (ev) => { if (ev.target === bookshelfHubOverlayEl) closeBookshelfHub(); });

  $("shelf-slot-diary")?.addEventListener("click", () => { sfx.tap(); closeBookshelfHub(); openDiaryCover(); });
  $("shelf-slot-mail")?.addEventListener("click", async () => {
    sfx.tap();
    closeBookshelfHub();
    if (state.unreadMail) {
      await openLetterOverlay(state.stageBgId !== "living_room" ? state.stageBgId : "bg_sunset_meadow", true);
    } else {
      openKeepsakeAlbum("postcards");
    }
  });
  $("shelf-slot-curio")?.addEventListener("click", () => { sfx.tap(); closeBookshelfHub(); openKeepsakeAlbum("keepsakes"); });
  $("shelf-slot-album")?.addEventListener("click", () => { sfx.tap(); closeBookshelfHub(); openKeepsakeAlbum("album"); });
  $("shelf-slot-games")?.addEventListener("click", () => { sfx.tap(); closeBookshelfHub(); openActivityModal(); });
  $("shelf-slot-house")?.addEventListener("click", () => { sfx.tap(); closeBookshelfHub(); openHouseGuide("rooms"); });

  /* ---------- P3 缝线布面手帐飞出动效 + 800×920 零 Token 拍立得日记内页 ---------- */
  const diaryCoverOverlayEl = $("diary-cover-overlay");
  const diaryCoverBookEl = $("diary-cover-book");
  const diaryCoverCrestEl = $("diary-cover-crest");
  const diaryCoverPetTagEl = $("diary-cover-pet-tag");
  const diaryCoverHintEl = $("diary-cover-hint");

  function openDiaryCover() {
    if (!diaryCoverOverlayEl || !diaryCoverBookEl) {
      openKeepsakeAlbum("diary");
      return;
    }
    const isYutu = state.petId === "yutu";
    diaryCoverBookEl.dataset.petTheme = isYutu ? "yutu" : "koi";
    diaryCoverBookEl.classList.remove("is-opening");
    if (diaryCoverCrestEl) diaryCoverCrestEl.textContent = isYutu ? "🐰" : "🐟";
    if (diaryCoverPetTagEl) diaryCoverPetTagEl.textContent = `${getPetName(state.petId)}的桌角记录`;

    const hasDiaries = Array.isArray(crossStore.diaries) && crossStore.diaries.length > 0;
    const todayKey = Store.getUtc8DateKey();
    const todayLog = crossStore.dailyEventLog && crossStore.dailyEventLog[todayKey];
    const hasTodayAct = DiaryEngine && todayLog && (
      DiaryEngine.hasRealInteraction(todayLog.yutu) || DiaryEngine.hasRealInteraction(todayLog.koi)
    );
    if (diaryCoverHintEl) {
      diaryCoverHintEl.textContent = (hasDiaries || hasTodayAct)
        ? "轻触布搭扣「啪嗒」翻开手帐"
        : "还没有写下第一页手帐，先喂块小点心或陪它待一会儿吧";
    }
    diaryCoverOverlayEl.hidden = false;
  }

  function flipOpenDiaryFromCover() {
    if (!diaryCoverBookEl || !diaryCoverOverlayEl) return;
    sfx.tap();
    diaryCoverBookEl.classList.add("is-opening");
    setTimeout(() => {
      diaryCoverOverlayEl.hidden = true;
      diaryCoverBookEl.classList.remove("is-opening");
      openKeepsakeAlbum("diary");
    }, REDUCED_MOTION ? 40 : 340);
  }

  diaryCoverBookEl?.addEventListener("click", flipOpenDiaryFromCover);
  diaryCoverBookEl?.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); flipOpenDiaryFromCover(); }
  });
  $("btn-close-diary-cover")?.addEventListener("click", () => { sfx.tap(); if (diaryCoverOverlayEl) diaryCoverOverlayEl.hidden = true; });
  diaryCoverOverlayEl?.addEventListener("click", (ev) => { if (ev.target === diaryCoverOverlayEl) diaryCoverOverlayEl.hidden = true; });

  async function writeTodayDiary(silent) {
    if (!DiaryEngine) return null;
    const todayKey = Store.getUtc8DateKey();
    const todayLog = crossStore.dailyEventLog && crossStore.dailyEventLog[todayKey];
    const hasAct = todayLog && (DiaryEngine.hasRealInteraction(todayLog.yutu) || DiaryEngine.hasRealInteraction(todayLog.koi));
    if (!hasAct) {
      // 若尚无互动，先记录当前穿搭与到访以便玩家主动写下今日第一页
      Store.recordDailyEvent(crossStore, todayKey, state.petId, {
        outfitId: state.savedSet[state.petId] || Store.DEFAULT_SET_BY_PET[state.petId],
        visitedState: state.roomState || "free_stand",
        countsAsEffective: true
      });
    }
    const existingIdx = (crossStore.diaries || []).findIndex((d) => d && d.dateKey === todayKey);
    if (existingIdx >= 0) {
      activeDiaryIndex = existingIdx;
      if (!silent) showSceneFeedback("今天的手帐已经装订好啦", "system");
      await renderDiaryView();
      return crossStore.diaries[existingIdx];
    }
    const res = await DiaryEngine.checkAndSettleDiary(crossStore, catalog, {
      forceToday: true,
      todayOnly: true,
      weather: state.period === "sunset" ? "sunset" : state.period === "night" ? "night" : "sunny"
    });
    if (res && res.generated) {
      activeDiaryIndex = 0;
      persistState();
      syncRoomModules();
      if (!silent) {
        sfx.star();
        showSceneFeedback(`沙沙～《${res.generated.title}》已写进陪伴手帐`, "dialogue");
      }
      await renderDiaryView();
      return res.generated;
    }
    return null;
  }

  async function renderDiaryView() {
    if (!DiaryEngine) return;
    // 若晚间 >=21:00 且有当日互动则自动结算
    const autoRes = await DiaryEngine.checkAndSettleDiary(crossStore, catalog, {
      weather: state.period === "sunset" ? "sunset" : state.period === "night" ? "night" : "sunny"
    });
    if (autoRes && autoRes.generated) {
      persistState();
      syncRoomModules();
    }
    if (autoRes && autoRes.welcomeBackNote) {
      pendingWelcomeBackNote = autoRes.welcomeBackNote;
    }

    const diaries = Array.isArray(crossStore.diaries) ? crossStore.diaries : [];
    const welcomeEl = $("diary-welcome-note");
    const emptyEl = $("diary-empty-state");
    const spreadEl = $("diary-spread");
    const countNumEl = $("diary-count-num");
    const btnPrev = $("btn-diary-prev");
    const indexDrawer = $("diary-index-drawer");

    if (welcomeEl) {
      const note = pendingWelcomeBackNote || (diaries[0] && diaries[0].welcomeBackNote) || "";
      welcomeEl.textContent = note ? `🌿 等门小涂鸦：${note}` : "";
      welcomeEl.hidden = !note;
    }
    if (countNumEl) countNumEl.textContent = String(diaries.length);

    if (diaries.length === 0) {
      if (emptyEl) emptyEl.hidden = false;
      if (spreadEl) spreadEl.hidden = true;
      if (btnPrev) btnPrev.disabled = true;
      if (indexDrawer) indexDrawer.hidden = true;
      return;
    }

    if (emptyEl) emptyEl.hidden = true;
    if (spreadEl) spreadEl.hidden = false;
    activeDiaryIndex = clamp(activeDiaryIndex, 0, diaries.length - 1);
    const entry = diaries[activeDiaryIndex];

    const weatherMap = { sunny: "☀️ 晴", sunset: "🌇 落日", rain: "🌧️ 雨", night: "🌙 夜" };
    const dateLabelEl = $("diary-date-label");
    const dayPillEl = $("diary-day-pill");
    const polaroidImgEl = $("diary-polaroid-img");
    const tagsListEl = $("diary-tags-list");
    const archChipEl = $("diary-archetype-chip");
    const titleEl = $("diary-entry-title");
    const salEl = $("diary-entry-salutation");
    const bodyEl = $("diary-entry-body");
    const psEl = $("diary-entry-ps");
    const signEl = $("diary-entry-signoff");

    if (dateLabelEl) dateLabelEl.textContent = `📅 ${String(entry.dateKey || "").replace(/-/g, ".")} · ${weatherMap[entry.weather] || "☀️ 晴"}`;
    if (dayPillEl) dayPillEl.textContent = `陪伴第 ${state.totalCompanionDays || 1} 天`;
    if (titleEl) titleEl.textContent = `《${entry.title || "桌角小记"}》`;
    if (salEl) salEl.textContent = entry.salutation || `${crossStore.user.nickname || "蛋宝好友"}，`;
    if (bodyEl) bodyEl.textContent = entry.body || "";
    if (psEl) psEl.textContent = entry.ps ? `P.S. ${entry.ps}` : "";
    if (signEl) signEl.textContent = `${entry.signOff || getPetName(entry.petId)} 🐾`;
    if (archChipEl) archChipEl.textContent = `冷幽默 · ${DiaryEngine.ARCHETYPE_LABELS[entry.humorArchetype] || "桌角微观察"}`;

    if (tagsListEl) {
      tagsListEl.innerHTML = (entry.tags || []).map((t) => `<span class="diary-tag-pill">🏷️ ${t}</span>`).join("");
    }
    if (polaroidImgEl) {
      composeCleanIllustrationUrl(entry.petId || state.petId, entry.outfitId, entry.sceneId || "living_room").then((url) => {
        polaroidImgEl.src = url;
      });
    }
    if (btnPrev) btnPrev.disabled = activeDiaryIndex >= diaries.length - 1;

    if (indexDrawer) {
      indexDrawer.innerHTML = diaries.map((d, idx) => `
        <button class="diary-index-item${idx === activeDiaryIndex ? " is-active" : ""}" type="button" data-diary-idx="${idx}">
          <span>${d.dateKey} · 《${d.title}》</span>
          <span>${d.petId === "yutu" ? "🐰" : "🐟"}</span>
        </button>
      `).join("");
      indexDrawer.querySelectorAll("[data-diary-idx]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          sfx.tap();
          activeDiaryIndex = Number(btn.dataset.diaryIdx) || 0;
          indexDrawer.hidden = true;
          await renderDiaryView();
        });
      });
    }
  }

  $("btn-diary-write-empty")?.addEventListener("click", () => { sfx.tap(); writeTodayDiary(false); });
  $("btn-diary-write-today")?.addEventListener("click", () => { sfx.tap(); writeTodayDiary(false); });
  $("btn-diary-prev")?.addEventListener("click", async () => {
    const diaries = crossStore.diaries || [];
    if (activeDiaryIndex < diaries.length - 1) {
      sfx.tap();
      activeDiaryIndex += 1;
      await renderDiaryView();
    }
  });
  $("btn-diary-index")?.addEventListener("click", () => {
    sfx.tap();
    const drawer = $("diary-index-drawer");
    if (drawer) drawer.hidden = !drawer.hidden;
  });
  $("btn-diary-share")?.addEventListener("click", async () => {
    const diaries = crossStore.diaries || [];
    const entry = diaries[activeDiaryIndex];
    if (!entry) return;
    sfx.tap();
    const artUrl = await composeCleanIllustrationUrl(entry.petId, entry.outfitId, entry.sceneId || "living_room");
    const a = document.createElement("a");
    a.href = artUrl;
    a.download = `eggbabe_diary_${entry.dateKey}_${entry.petId}.png`;
    a.click();
    showSceneFeedback("当日手帐拍立得已保存到本地", "system");
  });

  /* ---------- P3 穿搭定妆相册（仅存轻配方元数据，零 Base64） ---------- */
  function snapLookbookPhoto() {
    if (!Array.isArray(crossStore.lookbookPhotos)) crossStore.lookbookPhotos = [];
    const setId = state.savedSet[state.petId] || Store.DEFAULT_SET_BY_PET[state.petId];
    const sceneId = state.stageBgId || "living_room";
    const rec = {
      id: "lb_" + Date.now(),
      petId: state.petId,
      outfitId: setId,
      setId: setId,
      sceneId: sceneId,
      dateText: Store.getUtc8DateKey(),
      createdAt: Store.getUtc8IsoString()
    };
    crossStore.lookbookPhotos.unshift(rec);
    if (crossStore.lookbookPhotos.length > 40) crossStore.lookbookPhotos.length = 40;
    Store.recordDailyEvent(crossStore, Store.getUtc8DateKey(), state.petId, {
      outfitId: setId,
      countsAsEffective: true
    });
    persistState();
    renderLookbookAlbum();
    showSceneFeedback("已定格今日穿搭定妆照 📸", "dialogue");
  }

  function renderLookbookAlbum() {
    const list = Array.isArray(crossStore.lookbookPhotos) ? crossStore.lookbookPhotos : [];
    const gridEl = $("lookbook-album-grid");
    const emptyEl = $("lookbook-album-empty");
    if (!gridEl || !emptyEl) return;
    gridEl.innerHTML = "";
    emptyEl.hidden = list.length > 0;
    list.forEach((ph) => {
      const outfitName = getSetName(ph.petId, ph.outfitId || ph.setId) || "原生毛绒";
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "keepsake-cell keepsake-cell--postcard";
      cell.innerHTML = `<div class="keepsake-cell__media"><img alt="${outfitName}" /></div><div class="keepsake-cell__label">${outfitName}</div>`;
      composeCleanIllustrationUrl(ph.petId, ph.outfitId || ph.setId, ph.sceneId || "living_room").then((url) => {
        const im = cell.querySelector("img");
        if (im) im.src = url;
      });
      cell.addEventListener("click", () => {
        sfx.tap();
        openDetailView("postcard", Object.assign({ setId: ph.outfitId || ph.setId }, ph));
      });
      gridEl.appendChild(cell);
    });
  }
  $("btn-album-snap-now")?.addEventListener("click", () => { sfx.tap(); snapLookbookPhoto(); });

  /* ---------- P5 房间切换、边缘木门牌、小厨房 & 小院子（含户外原木信箱） ---------- */
  const houseGuideOverlayEl = $("house-guide-overlay");
  const houseRoomsPaneEl = $("house-rooms-pane");
  const houseBgsPaneEl = $("house-bgs-pane");
  const houseDecorPaneEl = $("house-decor-pane");
  const roomSwitcherPillEl = $("room-switcher-pill");
  const roomSwitcherLabelEl = $("room-switcher-label");
  const roomTransitionVeilEl = $("room-transition-veil");
  const altRoomStageEl = $("alt-room-stage");
  const kitchenRoomPropsEl = $("kitchen-room-props");
  const yardRoomPropsEl = $("yard-room-props");
  const edgeSignKitchenEl = $("edge-sign-kitchen");
  const edgeSignYardEl = $("edge-sign-yard");

  function getActiveRoomId() {
    Store.ensureModularAndClockDefaults(crossStore);
    return crossStore.house.activeRoomId || "living_room";
  }

  function ensureDailyYardMailboxDelivery() {
    if (!P5Data || !crossStore.house) return;
    if ((crossStore.house.unlockedRoomIds || []).indexOf("sunlit_yard") < 0) return;
    const todayKey = Store.getUtc8DateKey();
    if (crossStore.house.lastMailboxDeliveryDate === todayKey) return;
    const list = P5Data.YARD_MAILBOX_DELIVERIES;
    const picked = list[Math.floor(Math.random() * list.length)];
    Store.deliverYardMailboxItem(crossStore, {
      id: `yard_mail_${todayKey}`,
      dateKey: todayKey,
      sceneId: picked.sceneId,
      title: picked.title,
      text: picked.text,
      starBonus: picked.starBonus,
      keepsakeHint: picked.keepsakeHint,
      petId: state.petId,
      outfitId: state.savedSet[state.petId] || Store.DEFAULT_SET_BY_PET[state.petId]
    });
    crossStore.house.lastMailboxDeliveryDate = todayKey;
    persistState();
  }

  function syncAltRoomProps() {
    const roomId = getActiveRoomId();
    const roomDef = P5Data ? P5Data.getRoomById(roomId) : { icon: "🏠", shortName: "起居室" };
    if (roomSwitcherLabelEl) roomSwitcherLabelEl.textContent = `${roomDef.icon} ${roomDef.shortName}`;

    const isKitchen = roomId === "cozy_kitchen";
    const isYard = roomId === "sunlit_yard";
    if (altRoomStageEl) altRoomStageEl.hidden = !(isKitchen || isYard);
    if (kitchenRoomPropsEl) kitchenRoomPropsEl.hidden = !isKitchen;
    if (yardRoomPropsEl) yardRoomPropsEl.hidden = !isYard;

    if (isKitchen) {
      const unlockedCount = (crossStore.curioCabinet && crossStore.curioCabinet.unlockedIds || []).length;
      const fridgeSub = $("kitchen-fridge-sub");
      if (fridgeSub) fridgeSub.textContent = `已贴 ${Math.min(12, unlockedCount)} 枚回忆磁贴`;
      const crafted = (crossStore.house && crossStore.house.craftedSnacks) || {};
      const jarSub = $("kitchen-jar-sub");
      if (jarSub) jarSub.textContent = `松饼 ${crafted.osmanthus_pancake || 0} · 鲷鱼烧 ${crafted.crispy_taiyaki || 0}`;
    }

    if (isYard) {
      ensureDailyYardMailboxDelivery();
      const unread = (crossStore.house && crossStore.house.mailboxUnreadIds) || [];
      const flagEl = $("yard-mailbox-flag");
      const subEl = $("yard-mailbox-sub");
      if (flagEl) flagEl.hidden = unread.length === 0;
      if (subEl) subEl.textContent = unread.length > 0 ? `小红旗翘起啦 · ${unread.length} 封新邮袋` : "查看历史院子明信片";
    }

    // 拓展房间渲染背景 + 实时 WebGL 伙伴
    if (isKitchen || isYard) {
      const bgRel = isYard && state.period === "day" && roomDef.dayBgFile ? roomDef.dayBgFile : roomDef.bgFile;
      appEl.classList.add("has-custom-bg");
      customStageBgEl.src = sharedUrl(bgRel);
      customStageBgEl.hidden = false;
      screenDotsEl.style.display = "none";
      if (clockDutyHintEl) clockDutyHintEl.classList.add("is-hidden-edge");
    } else {
      syncCustomStageBg();
      updateClockDutyHintVisibility();
    }
    updateEdgeRoomSigns();
  }

  function updateEdgeRoomSigns() {
    if (!edgeSignKitchenEl || !edgeSignYardEl) return;
    const roomId = getActiveRoomId();
    if (roomId !== "living_room" || isCustomBgActive() || isFittingOpen) {
      edgeSignKitchenEl.classList.add("is-hidden-edge");
      edgeSignYardEl.classList.add("is-hidden-edge");
      return;
    }
    const maxS = worldTrackEl.offsetWidth - worldScrollEl.clientWidth;
    if (maxS <= 6) {
      edgeSignKitchenEl.classList.add("is-hidden-edge");
      edgeSignYardEl.classList.add("is-hidden-edge");
      return;
    }
    const r = worldScrollEl.scrollLeft / maxS;
    const kUnlocked = (crossStore.house.unlockedRoomIds || []).includes("cozy_kitchen");
    const yUnlocked = (crossStore.house.unlockedRoomIds || []).includes("sunlit_yard");
    $("edge-sign-kitchen-text").textContent = kUnlocked ? "🍳 去小厨房" : "🔒 小厨房";
    $("edge-sign-yard-text").textContent = yUnlocked ? "🌿 去小院子" : "🔒 小院子";
    edgeSignKitchenEl.classList.toggle("is-hidden-edge", r > 0.14);
    edgeSignYardEl.classList.toggle("is-hidden-edge", r < 0.86);
  }
  worldScrollEl.addEventListener("scroll", updateEdgeRoomSigns);

  function switchActiveRoom(roomId, skipTransition) {
    if (!P5Data) return;
    const def = P5Data.getRoomById(roomId);
    if (!def) return;
    const unlocked = (crossStore.house.unlockedRoomIds || []).includes(def.id);
    if (!unlocked) {
      openHouseGuide("rooms");
      return;
    }
    const apply = () => {
      crossStore.house.activeRoomId = def.id;
      if (def.id === "living_room") {
        state.stageBgId = "living_room";
      }
      Store.recordDailyEvent(crossStore, Store.getUtc8DateKey(), state.petId, { roomId: def.id, countsAsEffective: true });
      persistState();
      syncAltRoomProps();
      layoutScenePropsAndHotspots();
      showSceneFeedback(`推开门，来到「${def.name}」${def.icon}`, "system");
    };
    if (skipTransition || REDUCED_MOTION || !roomTransitionVeilEl) {
      apply();
      return;
    }
    roomTransitionVeilEl.hidden = false;
    void roomTransitionVeilEl.offsetWidth;
    roomTransitionVeilEl.classList.add("is-active");
    setTimeout(() => {
      apply();
      roomTransitionVeilEl.classList.remove("is-active");
      setTimeout(() => { roomTransitionVeilEl.hidden = true; }, 240);
    }, 240);
  }

  edgeSignKitchenEl?.addEventListener("click", () => { sfx.tap(); switchActiveRoom("cozy_kitchen"); });
  edgeSignYardEl?.addEventListener("click", () => { sfx.tap(); switchActiveRoom("sunlit_yard"); });
  roomSwitcherPillEl?.addEventListener("click", () => { sfx.tap(); openHouseGuide("rooms"); });

  $("kitchen-oven-btn")?.addEventListener("click", () => { sfx.tap(); openNativeMinigame("bakery-tap"); });
  $("kitchen-fridge-btn")?.addEventListener("click", () => {
    sfx.tap();
    openKeepsakeAlbum("keepsakes");
    showSceneFeedback("旅途冰箱贴与多宝格同步珍藏中 🧲", "system");
  });
  $("kitchen-jar-btn")?.addEventListener("click", () => {
    sfx.tap();
    openCarePanel("feed");
  });
  $("yard-chair-btn")?.addEventListener("click", () => { sfx.tap(); openNativeMinigame("meadow-breeze"); });
  $("yard-mailbox-btn")?.addEventListener("click", () => { sfx.tap(); openYardMailboxModal(); });

  const yardMailboxOverlayEl = $("yard-mailbox-overlay");
  const yardMailboxListEl = $("yard-mailbox-list");
  function openYardMailboxModal() {
    if (!yardMailboxOverlayEl || !yardMailboxListEl) return;
    ensureDailyYardMailboxDelivery();
    const items = (crossStore.house && crossStore.house.mailboxItems) || [];
    if (items.length === 0) {
      yardMailboxListEl.innerHTML = `<div class="mg-result-box"><p class="mg-result-box__sub">信箱里暂时还没有新邮袋，明天再来院子看看红旗吧。</p></div>`;
    } else {
      yardMailboxListEl.innerHTML = items.map((m) => `
        <div class="room-tour-card${m.claimed ? "" : " is-active"}">
          <div class="room-tour-card__body">
            <div class="room-tour-card__title">📮 ${m.title} ${m.claimed ? "" : "· 新"}</div>
            <p class="room-tour-card__desc">${m.text}</p>
            <span class="room-tour-card__cond">${m.dateKey} · 附赠 +${m.starBonus || 6}✦ 与明信片</span>
          </div>
          <button class="room-tour-card__btn${m.claimed ? " room-tour-card__btn--locked" : ""}" type="button" data-claim-mail="${m.id}" ${m.claimed ? "disabled" : ""}>
            ${m.claimed ? "已收信" : "收下邮袋"}
          </button>
        </div>
      `).join("");
      yardMailboxListEl.querySelectorAll("[data-claim-mail]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const claimed = Store.claimYardMailboxItem(crossStore, btn.dataset.claimMail);
          if (!claimed) return;
          sfx.star();
          state.stars = Number(crossStore.companion.starBalance || state.stars);
          state.postcards.unshift({
            id: "pc_yard_" + Date.now(),
            petId: claimed.petId || state.petId,
            setId: claimed.outfitId || state.savedSet[state.petId],
            outfitId: claimed.outfitId || state.savedSet[state.petId],
            sceneId: claimed.sceneId || "bg_moon_courtyard",
            text: claimed.text,
            dateText: claimed.dateKey || Store.getUtc8DateKey(),
            createdAt: Store.getUtc8IsoString()
          });
          if (claimed.keepsakeHint) unlockKeepsake(claimed.keepsakeHint, "yard_mailbox");
          persistState();
          renderMoodTab();
          syncAltRoomProps();
          openYardMailboxModal();
          showSceneFeedback(`收到小院来信「${claimed.title}」+${claimed.starBonus || 6}✦ 并收入明信片册！`, "dialogue");
        });
      });
    }
    yardMailboxOverlayEl.hidden = false;
  }
  $("btn-close-yard-mailbox")?.addEventListener("click", () => { sfx.tap(); if (yardMailboxOverlayEl) yardMailboxOverlayEl.hidden = true; });
  yardMailboxOverlayEl?.addEventListener("click", (ev) => { if (ev.target === yardMailboxOverlayEl) yardMailboxOverlayEl.hidden = true; });

  /* ---------- P5 家园软装改造与多房间导览弹窗 ---------- */
  function openHouseGuide(tab) {
    if (!houseGuideOverlayEl || !P5Data) return;
    activeHouseTab = tab || "rooms";
    renderHouseGuide();
    houseGuideOverlayEl.hidden = false;
  }
  function closeHouseGuide() {
    if (houseGuideOverlayEl) houseGuideOverlayEl.hidden = true;
  }
  function renderHouseGuide() {
    const balEl = $("house-guide-balance");
    if (balEl) balEl.textContent = `当前星星：${state.stars} ✦ · 累计陪伴 ${state.totalCompanionDays || 1} 天`;
    document.querySelectorAll("[data-house-tab]").forEach((b) => {
      b.classList.toggle("is-active", b.dataset.houseTab === activeHouseTab);
    });
    if (houseRoomsPaneEl) houseRoomsPaneEl.hidden = activeHouseTab !== "rooms";
    if (houseBgsPaneEl) houseBgsPaneEl.hidden = activeHouseTab !== "bgs";
    if (houseDecorPaneEl) houseDecorPaneEl.hidden = activeHouseTab !== "decor";
    if (activeHouseTab === "rooms") renderHouseRoomsPane();
    else if (activeHouseTab === "bgs") renderHouseBgsPane();
    else renderHouseDecorPane();
  }

  function renderHouseBgsPane() {
    if (!houseBgsPaneEl) return;
    const livingThumb = state.period === "night"
      ? COZY_SCENE_CONFIG.panoramas.night
      : COZY_SCENE_CONFIG.panoramas.day;
    const allBgs = [{ id: "living_room", name: "破壳起居室", thumbUrl: livingThumb }]
      .concat((catalog.backgrounds || []).map((b) => ({ id: b.id, name: b.name, thumbUrl: sharedUrl(b.file) })));

    const curRoom = getActiveRoomId();
    houseBgsPaneEl.innerHTML = `<div class="house-bgs-grid">${allBgs.map((bg) => {
      const selected = curRoom === "living_room" && state.stageBgId === bg.id;
      return `
        <button class="house-bg-card${selected ? " is-selected" : ""}" type="button" data-house-bg="${bg.id}">
          ${selected ? `<span class="house-bg-card__check">✓</span>` : ""}
          <img class="house-bg-card__thumb" src="${bg.thumbUrl}" alt="${bg.name}" loading="lazy" />
          <span class="house-bg-card__name">${bg.name}</span>
        </button>
      `;
    }).join("")}</div>`;

    houseBgsPaneEl.querySelectorAll("[data-house-bg]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const bgId = btn.dataset.houseBg;
        const picked = allBgs.find((b) => b.id === bgId);
        sfx.tap();
        if (crossStore && crossStore.house) {
          crossStore.house.activeRoomId = "living_room";
        }
        state.stageBgId = bgId;
        persistState();
        syncAltRoomProps();
        syncCustomStageBg();
        layoutScenePropsAndHotspots();
        renderHouseBgsPane();
        if (picked) showSceneFeedback(`已切换场景背景「${picked.name}」`, "system");
      });
    });
  }

  function renderHouseRoomsPane() {
    if (!houseRoomsPaneEl || !P5Data) return;
    const curRoom = getActiveRoomId();
    houseRoomsPaneEl.innerHTML = P5Data.ROOMS_CATALOG.map((room) => {
      const check = Store.canUnlockRoom(crossStore, room);
      const isHere = curRoom === room.id;
      let btnLabel = "进入房间";
      let btnCls = "room-tour-card__btn";
      let condText = "已开放 · 随时切换";
      if (isHere) {
        btnLabel = "当前所在";
        btnCls += " room-tour-card__btn--locked";
      } else if (!check.unlocked) {
        if (check.comingSoon) {
          btnLabel = "远期筹备";
          btnCls += " room-tour-card__btn--locked";
          condText = `累计陪伴 ${room.minDays} 天 + ${room.starCost}✦（即将开放）`;
        } else if (check.eligible) {
          btnLabel = `${room.starCost}✦ 开启`;
          condText = `已达标！累计陪伴满 ${room.minDays} 天`;
        } else {
          btnLabel = "待解锁";
          btnCls += " room-tour-card__btn--locked";
          const parts = [];
          if (check.missingDays > 0) parts.push(`再相伴 ${check.missingDays} 天`);
          if (check.missingStars > 0) parts.push(`再攒 ${check.missingStars}✦`);
          condText = `条件：陪伴 ${room.minDays} 天 + ${room.starCost}✦（${parts.join(" · ")}）`;
        }
      }
      return `
        <div class="room-tour-card${isHere ? " is-active" : ""}">
          <img class="room-tour-card__thumb" src="${sharedUrl(room.bgFile)}" alt="${room.name}" />
          <div class="room-tour-card__body">
            <div class="room-tour-card__title">${room.icon} ${room.name}</div>
            <p class="room-tour-card__desc">${room.desc}</p>
            <span class="room-tour-card__cond">${condText}</span>
          </div>
          <button class="${btnCls}" type="button" data-room-action="${room.id}">${btnLabel}</button>
        </div>
      `;
    }).join("");

    houseRoomsPaneEl.querySelectorAll("[data-room-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const room = P5Data.getRoomById(btn.dataset.roomAction);
        if (!room) return;
        sfx.tap();
        const check = Store.canUnlockRoom(crossStore, room);
        if (check.unlocked) {
          closeHouseGuide();
          switchActiveRoom(room.id);
          return;
        }
        if (check.comingSoon) {
          showSceneFeedback("阁楼茶室与陈列馆正在软装筹备中，敬请期待 ✨", "system");
          return;
        }
        const res = Store.unlockRoom(crossStore, room);
        if (!res.ok) {
          if (res.reason === "insufficient_days") {
            showSceneFeedback(`再相伴 ${res.missingDays} 天，就能一起推开「${room.name}」的门啦`, "system");
          } else {
            showSceneFeedback(`还差 ${res.missingStars}✦ 星星，玩会儿小游戏就能攒够啦`, "system");
          }
          return;
        }
        state.stars = Number(crossStore.companion.starBalance || 0);
        persistState();
        renderMoodTab();
        sfx.star();
        closeHouseGuide();
        switchActiveRoom(room.id);
      });
    });
  }

  function renderHouseDecorPane() {
    if (!houseDecorPaneEl || !P5Data) return;
    const unlockedSet = new Set((crossStore.house && crossStore.house.unlockedDecorIds) || []);
    const mods = getLivingRoomModules();
    houseDecorPaneEl.innerHTML = P5Data.DECOR_SLOTS.map((slot) => {
      const items = P5Data.getDecorBySlot(slot.id);
      const equippedId = mods[slot.id] && mods[slot.id].styleId;
      return `
        <div class="decor-slot-group">
          <div class="decor-slot-group__title">${slot.icon} ${slot.label}</div>
          <div class="decor-items-row">
            ${items.map((it) => {
              const owned = unlockedSet.has(it.id);
              const equipped = equippedId === it.id;
              const meta = equipped ? "已布置" : owned ? "已拥有 · 点击换上" : `${it.price}✦ 解锁`;
              return `
                <button class="decor-item-card${equipped ? " is-equipped" : ""}" type="button" data-decor-id="${it.id}">
                  <span class="decor-item-card__swatch" style="background:${it.swatch}"></span>
                  <span class="decor-item-card__name">${it.name}</span>
                  <span class="decor-item-card__meta">${meta}</span>
                </button>
              `;
            }).join("")}
          </div>
        </div>
      `;
    }).join("");

    houseDecorPaneEl.querySelectorAll("[data-decor-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const def = P5Data.getDecorById(btn.dataset.decorId);
        if (!def) return;
        sfx.tap();
        const res = Store.unlockDecorItem(crossStore, def);
        if (!res.ok) {
          showSceneFeedback(`星星还差 ${res.missing}✦，去玩「一起画」或「听你说」赚星星吧`, "system");
          return;
        }
        state.stars = Number(crossStore.companion.starBalance || 0);
        persistState();
        renderMoodTab();
        syncRoomModules();
        renderHouseGuide();
        if (!res.alreadyOwned) sfx.star();
        showSceneFeedback(res.alreadyOwned ? `已换上「${def.name}」` : `已解锁并布置「${def.name}」✨`, "dialogue");
      });
    });
  }

  document.querySelectorAll("[data-house-tab]").forEach((b) => {
    b.addEventListener("click", () => {
      sfx.tap();
      activeHouseTab = b.dataset.houseTab;
      renderHouseGuide();
    });
  });
  $("btn-close-house-guide")?.addEventListener("click", () => { sfx.tap(); closeHouseGuide(); });
  houseGuideOverlayEl?.addEventListener("click", (ev) => { if (ev.target === houseGuideOverlayEl) closeHouseGuide(); });

  /* ---------- P5 内置轻小游戏（《听你说》《寻宝翻翻乐》《暖炉烘焙拍》《小院牧歌》） ---------- */
  const nativeMgOverlayEl = $("native-minigame-overlay");
  const nativeMgTitleEl = $("native-mg-title");
  const nativeMgSubEl = $("native-mg-sub");
  const nativeMgBodyEl = $("native-mg-body");

  function getTodayMiniGameStarsEarned() {
    const dk = Store.getUtc8DateKey();
    const map = crossStore.companion && crossStore.companion.dailyMiniGameStars;
    return Math.max(0, Number(map && map[dk] || 0));
  }

  function closeNativeMinigame() {
    if (typeof activeMiniGameCleanup === "function") {
      try { activeMiniGameCleanup(); } catch (_) {}
      activeMiniGameCleanup = null;
    }
    if (nativeMgOverlayEl) nativeMgOverlayEl.hidden = true;
  }
  $("btn-close-native-mg")?.addEventListener("click", () => { sfx.tap(); closeNativeMinigame(); });
  nativeMgOverlayEl?.addEventListener("click", (ev) => { if (ev.target === nativeMgOverlayEl) closeNativeMinigame(); });

  function finishNativeMinigame(miniGameId, rawStars, summaryTitle, extraHtml) {
    const res = Store.awardActivityStars(crossStore, rawStars, {
      petId: state.petId,
      miniGameId
    });
    state.stars = Number(crossStore.companion.starBalance || state.stars);
    persistState();
    renderMoodTab();
    if (typeof syncAltRoomProps === "function") syncAltRoomProps();
    if (res.starsAwarded > 0) {
      sfx.star();
      animateStarsTo(state.stars, res.starsAwarded);
    }
    const rewardText = res.starsAwarded > 0
      ? `获得 +${res.starsAwarded}✦ 星星（今日游艺 ${res.earnedToday}/${res.cap}✦）`
      : `今日游艺星星已满 ${res.cap}✦，感谢你的陪伴 ✨`;
    if (nativeMgSubEl) nativeMgSubEl.textContent = `今日游艺获星 ${res.earnedToday} / ${res.cap} ✦`;
    if (nativeMgBodyEl) {
      nativeMgBodyEl.innerHTML = `
        <div class="mg-result-box">
          <div class="mg-result-box__big">${summaryTitle}</div>
          <p class="mg-result-box__sub">${rewardText}</p>
          ${extraHtml || ""}
          <button id="btn-mg-finish-close" class="btn btn--primary btn--small" type="button"><span class="btn-text">回到小屋</span></button>
        </div>
      `;
      $("btn-mg-finish-close")?.addEventListener("click", () => { sfx.tap(); closeNativeMinigame(); });
    }
  }

  function openNativeMinigame(gameId) {
    if (gameId === "listen-qa") {
      const listenAct = ACTIVITIES.find((a) => a.id === "listen-qa");
      if (listenAct) {
        openActivityPlayer(listenAct);
        return;
      }
    }
    if (!nativeMgOverlayEl || !nativeMgBodyEl || !P5Data) return;
    closeNativeMinigame();
    const earned = getTodayMiniGameStarsEarned();
    if (nativeMgSubEl) nativeMgSubEl.textContent = `今日游艺获星 ${earned} / ${Store.DAILY_MINIGAME_STAR_CAP} ✦`;
    nativeMgOverlayEl.hidden = false;

    if (gameId === "listen-qa-legacy") {
      if (nativeMgTitleEl) nativeMgTitleEl.textContent = "💬 听你说";
      const questions = P5Data.pickListenSessionQuestions(Store.getUtc8DateKey() + ":" + Date.now());
      let step = 0;
      const tags = [];
      const renderStep = () => {
        const q = questions[step];
        nativeMgBodyEl.innerHTML = `
          <div class="mg-question-card">
            <span class="mg-question-cat">${q.category} · 第 ${step + 1} / ${questions.length} 题</span>
            <p class="mg-question-text">${q.question}</p>
            <div class="mg-option-list">
              ${q.options.map((opt, idx) => `<button class="mg-option-btn" type="button" data-opt-idx="${idx}">${opt.text}</button>`).join("")}
            </div>
            <div id="mg-listen-reply" class="mg-pet-reply" hidden style="margin-top:10px;"></div>
          </div>
        `;
        nativeMgBodyEl.querySelectorAll("[data-opt-idx]").forEach((btn) => {
          btn.addEventListener("click", () => {
            const opt = q.options[Number(btn.dataset.optIdx)];
            if (!opt) return;
            sfx.tap();
            tags.push(opt.tag);
            const rep = $("mg-listen-reply");
            if (rep) {
              rep.textContent = `${getPetName(state.petId)}：${opt.reply}`;
              rep.hidden = false;
            }
            nativeMgBodyEl.querySelectorAll("[data-opt-idx]").forEach((b) => { b.disabled = true; });
            setTimeout(() => {
              step += 1;
              if (step < questions.length) {
                renderStep();
              } else {
                const dk = Store.getUtc8DateKey();
                const firstToday = crossStore.companion.dailyListenClaimedDate !== dk;
                crossStore.companion.dailyListenClaimedDate = dk;
                const reward = firstToday ? 10 : 0;
                const tagHtml = `<p class="mg-result-box__sub">今日伙伴印象签：${tags.map((t) => `「${t}」`).join(" ")}</p>`;
                finishNativeMinigame("listen_qa", reward, firstToday ? "听你说完成 +10✦" : "今天已经聊过一轮啦", tagHtml);
              }
            }, 680);
          });
        });
      };
      renderStep();
      return;
    }

    if (gameId === "treasure-memory") {
      if (nativeMgTitleEl) nativeMgTitleEl.textContent = "🃏 寻宝翻翻乐";
      const allKs = getAllKeepsakes();
      const pool = allKs.slice().sort(() => Math.random() - 0.5).slice(0, 6);
      const deck = pool.concat(pool).map((item, idx) => ({ idx, item, open: false, matched: false })).sort(() => Math.random() - 0.5);
      let firstCard = null;
      let lockBoard = false;
      let matchedPairs = 0;

      const renderBoard = () => {
        nativeMgBodyEl.innerHTML = `
          <p class="bookshelf-hub-head__sub" style="margin:0;">翻开相同的 6 对纪念小物（已配对 ${matchedPairs} / 6）</p>
          <div class="mg-memory-grid">
            ${deck.map((c, i) => `
              <button class="mg-memory-card${c.open ? " is-open" : ""}${c.matched ? " is-matched" : ""}" type="button" data-card-i="${i}">
                ${(c.open || c.matched) ? `<img src="${sharedUrl(c.item.img)}" alt="${c.item.name}" />` : "🪵"}
              </button>
            `).join("")}
          </div>
        `;
        nativeMgBodyEl.querySelectorAll("[data-card-i]").forEach((btn) => {
          btn.addEventListener("click", () => {
            if (lockBoard) return;
            const c = deck[Number(btn.dataset.cardI)];
            if (!c || c.open || c.matched) return;
            sfx.tap();
            c.open = true;
            if (!firstCard) {
              firstCard = c;
              renderBoard();
              return;
            }
            if (firstCard.item.id === c.item.id) {
              firstCard.matched = true;
              c.matched = true;
              firstCard = null;
              matchedPairs += 1;
              renderBoard();
              if (matchedPairs >= 6) {
                setTimeout(() => finishNativeMinigame("treasure_memory", 10, "寻宝翻翻乐通关！"), 260);
              }
            } else {
              lockBoard = true;
              renderBoard();
              setTimeout(() => {
                firstCard.open = false;
                c.open = false;
                firstCard = null;
                lockBoard = false;
                renderBoard();
              }, 520);
            }
          });
        });
      };
      renderBoard();
      return;
    }

    if (gameId === "bakery-tap") {
      if (nativeMgTitleEl) nativeMgTitleEl.textContent = "🔥 暖炉烘焙拍";
      let hits = 0;
      let pos = 10;
      let dir = 1;
      let rafId = 0;
      const targetHits = 3;
      const craftedSnack = Math.random() < 0.5 ? P5Data.CRAFTED_SNACKS[0] : P5Data.CRAFTED_SNACKS[1];

      nativeMgBodyEl.innerHTML = `
        <div class="mg-bakery-oven">
          <div style="font-size:32px;">🧁</div>
          <div style="font-weight:800;font-size:15px;margin-top:4px;">正在烤制「${craftedSnack.name}」</div>
          <p id="mg-bakery-status" class="bookshelf-hub-head__sub">火候指针落进绿色甜香区时拍一下！（0 / ${targetHits}）</p>
          <div class="mg-bakery-track">
            <div class="mg-bakery-sweet"></div>
            <div id="mg-bakery-cursor" class="mg-bakery-cursor" style="left:10%;"></div>
          </div>
          <button id="btn-mg-bakery-tap" class="btn btn--primary btn--small" type="button"><span class="btn-text">🔥 拍一下翻烤</span></button>
        </div>
      `;
      const cursorEl = $("mg-bakery-cursor");
      const statusEl = $("mg-bakery-status");
      const tick = () => {
        pos += dir * 1.45;
        if (pos >= 94) { pos = 94; dir = -1; }
        if (pos <= 6) { pos = 6; dir = 1; }
        if (cursorEl) cursorEl.style.left = pos.toFixed(1) + "%";
        rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);
      activeMiniGameCleanup = () => cancelAnimationFrame(rafId);

      $("btn-mg-bakery-tap")?.addEventListener("click", () => {
        if (pos >= 36 && pos <= 64) {
          sfx.star();
          hits += 1;
          if (statusEl) statusEl.textContent = `火候刚刚好！香喷喷～（${hits} / ${targetHits}）`;
          if (hits >= targetHits) {
            cancelAnimationFrame(rafId);
            Store.addCraftedSnack(crossStore, craftedSnack.id, 1);
            renderSnackTray();
            finishNativeMinigame(
              "bakery_tap",
              10,
              `${craftedSnack.name} 出炉啦！`,
              `<p class="mg-result-box__sub">已存入零食罐，打开「喂食」即可投喂给它～</p>`
            );
          }
        } else {
          sfx.tap();
          if (statusEl) statusEl.textContent = `再等指针滑到中间绿色区拍一下哦（${hits} / ${targetHits}）`;
        }
      });
      return;
    }

    if (gameId === "meadow-breeze") {
      if (nativeMgTitleEl) nativeMgTitleEl.textContent = "🌿 小院牧歌";
      let caught = 0;
      const goal = 5;
      nativeMgBodyEl.innerHTML = `
        <p id="mg-meadow-status" class="bookshelf-hub-head__sub" style="margin:0;">轻触接住 5 朵随风飘来的桂花瓣（0 / ${goal}）</p>
        <div id="mg-meadow-field" class="mg-meadow-field"></div>
      `;
      const fieldEl = $("mg-meadow-field");
      const statusEl = $("mg-meadow-status");
      const spawnPetal = () => {
        if (!fieldEl || caught >= goal) return;
        fieldEl.innerHTML = "";
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "mg-meadow-target";
        btn.textContent = Math.random() < 0.5 ? "🌼" : "🍃";
        btn.style.left = (12 + Math.random() * 72).toFixed(1) + "%";
        btn.style.top = (14 + Math.random() * 64).toFixed(1) + "%";
        btn.addEventListener("click", () => {
          sfx.tap();
          caught += 1;
          if (statusEl) statusEl.textContent = `接住了一朵小院桂花！（${caught} / ${goal}）`;
          if (caught >= goal) {
            finishNativeMinigame("meadow_breeze", 8, "小院微风收集完成！");
          } else {
            spawnPetal();
          }
        });
        fieldEl.appendChild(btn);
      };
      spawnPetal();
    }
  }

  /* ---------- 22. 启动流程 ---------- */
  window.addEventListener("resize", () => {
    Store.injectCapsuleSafeAreaVars(document.documentElement);
    updateViewportGeometry();
  });

  async function boot() {
    const qs = new URLSearchParams(window.location.search);
    const qsPeriod = qs.get("period");
    if (qsPeriod === "day" || qsPeriod === "night") {
      state.period = qsPeriod;
    }

    updateViewportGeometry();
    // 后台尝试拉取最新远程 catalog.json 热更新（失败静默使用内置快照）
    fetch(sharedUrl("assets/shared/catalog.json")).then((r) => r.ok ? r.json() : null).then((remote) => {
      if (remote && remote.pets && remote.backgrounds) catalog = remote;
    }).catch(() => {});

    await initPet(state.petId);
    appEl.dataset.period = state.period;
    currentPanoUrl = resolveTargetPanoramaUrl();
    panoCurrEl.src = currentPanoUrl;

    if (state.postcards.length > 0) {
      composeCleanIllustrationUrl(state.postcards[0].petId, state.postcards[0].setId, state.postcards[0].sceneId).then((url) => {
        wallPolaroidImgEl.src = url;
        layoutScenePropsAndHotspots();
      });
    }

    checkAndSettleFocusSession();
    // 静默检查昨日/历史活跃日补结日记与缺席零愧疚等门小涂鸦（严禁补发空白日）
    if (DiaryEngine) {
      const diaryBoot = await DiaryEngine.checkAndSettleDiary(crossStore, catalog, {
        weather: state.period === "sunset" ? "sunset" : state.period === "night" ? "night" : "sunny"
      });
      if (diaryBoot && diaryBoot.welcomeBackNote) {
        pendingWelcomeBackNote = diaryBoot.welcomeBackNote;
      }
      if (diaryBoot && diaryBoot.generated) {
        persistState();
      }
    }

    buildDevTesterMenus();
    renderMoodTab();
    renderContextEntry();
    layoutScenePropsAndHotspots();
    syncRoomModules();
    syncAltRoomProps();
    renderBlackCatClockUI();
    scrollToScreen(1, false);
    updateClockDutyHintVisibility();
    updateEdgeRoomSigns();

    const openParam = qs.get("open");
    if (openParam === "curio") openKeepsakeAlbum("keepsakes");
    else if (openParam === "diary") openKeepsakeAlbum("diary");
    else if (openParam === "bookshelf") openBookshelfHub();
    else if (openParam === "house") openHouseGuide("rooms");

    requestAnimationFrame(mainLoop);
  }

  /* ---------- 活动列表（小游戏合集 + 每日 ≤45✦ 软上限闭环） ---------- */
  const ACTIVITIES = [
    {
      id: "holo-pack",
      name: "拾物伴手礼袋",
      tag: "每日首袋免费 · 3张",
      desc: "亲手撕开铝箔伴手礼袋，翻开 3 张小物件全息卡自动摆进暖橡木多宝格",
      thumb: "./living-room-dress/ui/tb_keepsakes.png",
      containThumb: true,
      url: "./living-room-dress/holo-pack/"
    },
    {
      id: "doodle-together",
      name: "一起画",
      tag: "拾物临摹 · +10✦",
      desc: "偷看 5 秒简笔线稿凭记忆临摹，解锁小物件自动摆进收藏格",
      thumb: sharedUrl("assets/shared/png/doodle/palette_3d.png"),
      containThumb: true,
      url: "./living-room-dress/doodle/"
    },
    {
      id: "listen-qa",
      name: "听你说",
      tag: "治愈轻聊 · +10✦",
      desc: "5 大生活维度共 26 组轻问答，收下伙伴为你记下的专属心意回信",
      thumb: sharedUrl("assets/shared/png/listen/speech_bubbles_3d.png"),
      containThumb: true,
      url: "./living-room-dress/listen/"
    },
    {
      id: "treasure-memory",
      name: "寻宝翻翻乐",
      tag: "41件藏品配对 · +10✦",
      desc: "用现成 3D 小物件玩 3×4 翻牌记忆配对，轻松赚星星",
      thumb: "./living-room-dress/ui/tb_keepsakes.png",
      containThumb: true,
      native: true
    },
    {
      id: "bakery-tap",
      name: "暖炉烘焙拍",
      tag: "小厨房联动 · +10✦",
      desc: "把握烤箱绿区火候，亲手烤制桂花蜜松饼与香酥鲷鱼烧",
      thumb: "./living-room-dress/ui/snack_cake.png",
      containThumb: true,
      native: true
    },
    {
      id: "danbaobao-meadow",
      name: "蛋宝宝牧场",
      tag: "冰面滑行赶羊 · +12✦",
      desc: "陪穿好新衣的伙伴在晨霜冰场漂移急刹、把打滑小羊与金绒领头羊铲进木圈",
      thumb: sharedUrl("assets/shared/png/meadow/thumb_meadow.png"),
      containThumb: true,
      url: "./living-room-dress/meadow/site/"
    },
    {
      id: "haixinke-bottle-game",
      name: "瓶空一翻",
      tag: "物理挑战",
      desc: "抛瓶立稳闯关，收集技巧勋章与限定瓶身外观",
      thumb: "./prototypes/haixinke-bottle-game/logo.png",
      url: "./prototypes/haixinke-bottle-game/"
    },
    {
      id: "alesia0411-daily-fortune",
      name: "每日一签",
      tag: "每日好运",
      desc: "摇签抽今日签文，宠物陪伴与专属插画解签",
      thumb: "./prototypes/alesia0411-daily-fortune/assets/theme/fortune-cylinder.png",
      url: "./prototypes/alesia0411-daily-fortune/"
    }
  ];

  const activityModalEl = $("activity-modal");
  const activityListEl = $("activity-list");
  const activityPlayerEl = $("activity-player");
  const activityPlayerTitleEl = $("activity-player-title");
  const activityPlayerExtEl = $("activity-player-ext");
  const activityPlayerFrameEl = $("activity-player-frame");

  function syncFromExternalStoreUpdate() {
    const latest = storageAdapter.getJSON(Store.STORAGE_KEY);
    if (!latest || typeof latest !== "object") return;
    if (latest.curioCabinet && Array.isArray(latest.curioCabinet.unlockedIds)) {
      crossStore.curioCabinet = latest.curioCabinet;
      state.keepsakes = latest.curioCabinet.unlockedIds.slice();
    }
    if (latest.companion && typeof latest.companion === "object") {
      crossStore.companion = latest.companion;
      state.stars = Number(latest.companion.starBalance || 0);
      state.companionDays = Number(latest.companion.companionDays || 1);
      state.totalCompanionDays = Number(latest.companion.totalCompanionDays || 1);
    }
    if (latest.pets && typeof latest.pets === "object") {
      ["koi", "yutu"].forEach((pid) => {
        if (latest.pets[pid] && latest.pets[pid].care) {
          careAll[pid] = latest.pets[pid].care;
          crossStore.pets[pid].care = latest.pets[pid].care;
        }
      });
    }
    if (latest.dailyEventLog && typeof latest.dailyEventLog === "object") {
      crossStore.dailyEventLog = latest.dailyEventLog;
    }
    if (latest.listeningState && typeof latest.listeningState === "object") {
      crossStore.listeningState = latest.listeningState;
    }
    renderMoodTab();
    syncRoomModules();
    if (profileModalEl && !profileModalEl.hidden) renderProfileModal();
    if (albumViewEl && !albumViewEl.hidden) renderAlbumGrid();
  }

  function openActivityModal() {
    if (!activityModalEl || !activityListEl) return;
    const isOrdinary = crossStore.profileMode === "wx-mp-ordinary";
    const titleEl = $("activity-modal-title");
    const capBarEl = $("activity-star-cap-bar");
    if (titleEl) titleEl.textContent = isOrdinary ? "陪伴互动匣" : "活动列表";
    const earned = getTodayMiniGameStarsEarned();
    if (capBarEl) {
      capBarEl.textContent = earned >= Store.DAILY_MINIGAME_STAR_CAP
        ? `今日游艺获星已满 ${Store.DAILY_MINIGAME_STAR_CAP}/${Store.DAILY_MINIGAME_STAR_CAP}✦（继续游玩仍可得自制点心）`
        : `今日游艺获星：${earned} / ${Store.DAILY_MINIGAME_STAR_CAP} ✦（满额后仍可随时畅玩）`;
    }
    activityListEl.innerHTML = ACTIVITIES.map((item) => `
      <button class="activity-card" type="button" data-activity-id="${item.id}">
        <img class="activity-card__thumb${item.containThumb ? " activity-card__thumb--contain" : ""}" src="${item.thumb}" alt="" />
        <div class="activity-card__body">
          <div class="activity-card__top">
            <span class="activity-card__name">${item.name}</span>
            <span class="activity-card__tag">${item.tag}</span>
          </div>
          <p class="activity-card__desc">${item.desc}</p>
        </div>
        <span class="activity-card__go">去玩</span>
      </button>
    `).join("");
    activityListEl.querySelectorAll(".activity-card").forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = ACTIVITIES.find((a) => a.id === btn.dataset.activityId);
        if (!target) return;
        sfx.tap();
        closeActivityModal();
        if (target.native) {
          openNativeMinigame(target.id);
        } else {
          openActivityPlayer(target);
        }
      });
    });
    activityModalEl.hidden = false;
    activityModalEl.setAttribute("aria-hidden", "false");
  }

  function closeActivityModal() {
    if (!activityModalEl) return;
    activityModalEl.hidden = true;
    activityModalEl.setAttribute("aria-hidden", "true");
  }

  function openActivityPlayer(item, queryObj) {
    if (!activityPlayerEl || !activityPlayerFrameEl) return;
    const standaloneQs = new URLSearchParams(queryObj || {});
    const embedQs = new URLSearchParams(Object.assign({ embed: "1" }, queryObj || {}));
    const standaloneHref = standaloneQs.toString() ? `${item.url}?${standaloneQs.toString()}` : item.url;
    const frameSrc = `${item.url}${item.url.includes("?") ? "&" : "?"}${embedQs.toString()}`;
    activityPlayerTitleEl.textContent = item.name;
    activityPlayerExtEl.href = standaloneHref;
    activityPlayerFrameEl.src = frameSrc;
    activityPlayerEl.hidden = false;
    activityPlayerEl.setAttribute("aria-hidden", "false");
  }

  function closeActivityPlayer() {
    if (!activityPlayerEl || !activityPlayerFrameEl) return;
    activityPlayerEl.hidden = true;
    activityPlayerEl.setAttribute("aria-hidden", "true");
    syncFromExternalStoreUpdate();
    requestAnimationFrame(() => {
      if (activityPlayerEl.hidden) {
        activityPlayerFrameEl.src = "about:blank";
      }
    });
  }

  const btnClueGoDoodleEl = $("btn-clue-go-doodle");
  if (btnClueGoDoodleEl) {
    btnClueGoDoodleEl.addEventListener("click", () => {
      sfx.tap();
      const targetPropId = activeClueItem ? activeClueItem.id : "";
      keepsakeClueOverlayEl.hidden = true;
      albumViewEl.hidden = true;
      const doodleAct = ACTIVITIES.find((a) => a.id === "doodle-together");
      if (doodleAct) {
        openActivityPlayer(doodleAct, targetPropId ? { propId: targetPropId } : undefined);
      }
    });
  }

  window.addEventListener("message", (ev) => {
    const data = ev && ev.data;
    if (!data || typeof data !== "object") return;
    if (data.type === "eggbabe:doodle-complete") {
      syncFromExternalStoreUpdate();
      if (data.newlyUnlocked) {
        tbAlbumDotEl.hidden = false;
      }
    } else if (data.type === "eggbabe:doodle-nav") {
      closeActivityPlayer();
      if (data.target === "curio") {
        openKeepsakeAlbum("keepsakes");
        if (data.propId) {
          showSceneFeedback("已为你摆入多宝收藏格 ✨", "system");
        }
      }
    } else if (data.type === "eggbabe:listen-complete") {
      syncFromExternalStoreUpdate();
    } else if (data.type === "eggbabe:listen-nav") {
      closeActivityPlayer();
      showSceneFeedback("伙伴已把你说的小事记在心里 ✦", "system");
    } else if (data.type === "eggbabe:meadow-complete") {
      syncFromExternalStoreUpdate();
    } else if (data.type === "eggbabe:meadow-nav") {
      closeActivityPlayer();
      showSceneFeedback("从蛋宝宝牧场回来啦 ✦", "system");
    } else if (data.type === "eggbabe:holo-pack-complete") {
      syncFromExternalStoreUpdate();
      if (data.newlyUnlocked) {
        tbAlbumDotEl.hidden = false;
      }
    } else if (data.type === "eggbabe:holo-pack-nav") {
      closeActivityPlayer();
      if (data.target === "curio") {
        openKeepsakeAlbum("keepsakes");
        showSceneFeedback("新拾取的小物件已摆入多宝收藏格 ✨", "system");
      }
    }
  });

  const dockBtnActivitiesEl = $("dock-btn-activities");
  if (dockBtnActivitiesEl) {
    dockBtnActivitiesEl.addEventListener("click", () => {
      sfx.tap();
      setToolboxOpen(false);
      openActivityModal();
    });
  }
  const btnCloseActivitiesEl = $("btn-close-activities");
  if (btnCloseActivitiesEl) btnCloseActivitiesEl.addEventListener("click", closeActivityModal);
  const activityBackdropEl = $("activity-modal-backdrop");
  if (activityBackdropEl) activityBackdropEl.addEventListener("click", closeActivityModal);
  const btnCloseActivityPlayerEl = $("btn-close-activity-player");
  if (btnCloseActivityPlayerEl) btnCloseActivityPlayerEl.addEventListener("click", () => { sfx.tap(); closeActivityPlayer(); });

  boot().catch((err) => {
    console.error("Failed to boot living-room-dress:", err);
  });
})();
