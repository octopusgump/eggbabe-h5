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
  const CORK_HOME = { x: 1392, y: 1126 };
  const COLS = 30, ROWS = 56, NV = (COLS + 1) * (ROWS + 1);
  const ACC_COLS = 12, ACC_ROWS = 12;
  const PAGES_CDN = "https://octopusgump.github.io/eggbabe-h5";
  const REDUCED_MOTION = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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

  /* ---------- 1. 轻养成小零食（3D 哑光图标）与 careStore 兼容存档 ---------- */
  const CARE_STORAGE_KEY = "eggbabe_care_v1";
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

  function expForNextLevel(lv) { return 60 + (Math.max(1, lv) - 1) * 35; }
  function loadCareAll() {
    const now = Date.now();
    const base = {
      koi: { hunger: 68, hygiene: 72, exp: 15, level: 1, updatedAt: now },
      yutu: { hunger: 68, hygiene: 72, exp: 15, level: 1, updatedAt: now }
    };
    try {
      const raw = localStorage.getItem(CARE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        ["koi", "yutu"].forEach((id) => {
          if (parsed && parsed[id]) {
            const hrs = Math.max(0, (now - Number(parsed[id].updatedAt || now)) / 3600000);
            base[id] = {
              hunger: clamp(Number(parsed[id].hunger ?? 68) - hrs * 5, 0, 100),
              hygiene: clamp(Number(parsed[id].hygiene ?? 72) - hrs * 4, 0, 100),
              exp: Math.max(0, Number(parsed[id].exp ?? 0)),
              level: Math.max(1, Math.floor(Number(parsed[id].level ?? 1))),
              updatedAt: now
            };
          }
        });
      }
    } catch (e) {}
    return base;
  }
  const careAll = loadCareAll();
  function saveCareAll() {
    try {
      careAll.koi.updatedAt = Date.now();
      careAll.yutu.updatedAt = Date.now();
      localStorage.setItem(CARE_STORAGE_KEY, JSON.stringify(careAll));
    } catch (e) {}
  }
  function addCareExp(petId, amount) {
    const ps = careAll[petId];
    ps.exp += amount;
    let leveledUp = false;
    while (ps.exp >= expForNextLevel(ps.level)) {
      ps.exp -= expForNextLevel(ps.level);
      ps.level += 1;
      leveledUp = true;
    }
    saveCareAll();
    return leveledUp;
  }

  /* ---------- 2. 小程序每日心情、10 态房间与遇见配置 ---------- */
  const DAILY_MOODS = {
    JOY: { key: "JOY", label: "愉快", icon: "😊", text: "我想了想，觉得自己运气挺不错的。" },
    CURIOSITY: { key: "CURIOSITY", label: "好奇", icon: "🤔", text: "我今天一直在想一件事，还没想明白。" },
    CALM: { key: "CALM", label: "平静", icon: "😌", text: "今天不想说太多话，就这样待着挺好。" },
    EXCITEMENT: { key: "EXCITEMENT", label: "兴奋", icon: "🤩", text: "我今天一刻都停不下来，坐下三秒又想起来。" },
    CARE: { key: "CARE", label: "关怀", icon: "🤗", text: "我想安静陪一会儿，就在旁边不出声。" },
    FATIGUE: { key: "FATIGUE", label: "小困", icon: "🥱", text: "晒着暖暖的太阳，眼皮有点打架啦。" }
  };

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

  /* ---------- 4. 持久化状态（全量服装默认开放，零星星拦截） ---------- */
  const SAVE_KEY = "eggbabe_living_room_mp_v4";
  function detectLocalPeriod() {
    const h = new Date(Date.now() + 8 * 3600 * 1000).getUTCHours();
    if (h >= 6 && h < 17) return "day";
    if (h >= 17 && h < 19) return "sunset";
    return "night";
  }

  const state = {
    petId: "koi",         // 默认打开展示锦鲤，左上角与装扮页可 1 键秒切玉兔
    roomState: "free_stand",
    period: detectLocalPeriod(),
    stageBgId: "living_room", // "living_room" 或 catalog.backgrounds 中的 11 套插画背景 id
    moodKey: "JOY",
    moodPhase: "summary",
    clockMode: "analog",
    sfxOn: true,
    stars: 128,
    companionDays: 12,
    unreadMail: true,
    actedStates: {},
    savedSet: { koi: "set_duck", yutu: "set_cozy_knit" },
    keepsakes: ["short-pencil"],
    postcards: []
  };

  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p && typeof p === "object") {
        if (p.petId === "koi" || p.petId === "yutu") state.petId = p.petId;
        if (typeof p.stars === "number") state.stars = p.stars;
        if (typeof p.stageBgId === "string") state.stageBgId = p.stageBgId;
        if (p.clockMode === "digital" || p.clockMode === "analog") state.clockMode = p.clockMode;
        if (typeof p.sfxOn === "boolean") state.sfxOn = p.sfxOn;
        if (p.savedSet) state.savedSet = Object.assign(state.savedSet, p.savedSet);
        if (Array.isArray(p.keepsakes)) state.keepsakes = p.keepsakes.filter((id) => KEPSAKE_DEFS[id]);
        if (Array.isArray(p.postcards)) state.postcards = p.postcards.slice(0, 36);
        if (typeof p.unreadMail === "boolean") state.unreadMail = p.unreadMail;
      }
    }
  } catch (e) {}

  function persistState() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        petId: state.petId,
        stars: state.stars,
        stageBgId: state.stageBgId,
        clockMode: state.clockMode,
        sfxOn: state.sfxOn,
        unreadMail: state.unreadMail,
        savedSet: state.savedSet,
        keepsakes: state.keepsakes,
        postcards: state.postcards.slice(0, 36)
      }));
    } catch (e) {}
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

  const wallPolaroidEl = $("wall-polaroid");
  const wallPolaroidImgEl = $("wall-polaroid-img");
  const foldedOutfitPropEl = $("folded-outfit-prop");
  const deskMirrorPropEl = $("desk-mirror-prop");
  const shSoftEl = $("pet-shadow-soft");
  const shConEl = $("pet-shadow-contact");
  const glCanvas = $("gl-pet");
  const petFxHostEl = $("pet-fx-host");
  const sleepZzEl = $("sleep-zz");
  const dirtyLayerEl = $("dirty-layer");
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
  const hudDaysEl = $("hud-companion-days");
  const moodDetailEl = $("mood-room-detail");
  const moodSentenceEl = $("mood-room-sentence");
  const hudPetNameEl = $("hud-pet-name");
  const hudSwitchPetTextEl = $("hud-switch-pet-text");
  const hudMoodIconEl = $("hud-mood-icon");
  const hudMoodLabelEl = $("hud-mood-label");
  const hudMoodTextEl = $("hud-mood-text");
  const hudCareMiniEl = $("hud-care-mini");

  const roomClockEl = $("room-clock");
  const clockAnalogEl = $("clock-analog");
  const clockDigitalEl = $("clock-digital");
  const handHourEl = $("clock-hand-hour");
  const handMinEl = $("clock-hand-minute");
  const handSecEl = $("clock-hand-second");
  const clockTimeTextEl = $("clock-time-text");
  const clockDateTextEl = $("clock-date-text");

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
  const tbSfxLabelEl = $("tb-sfx-label");

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
  const keepsakeEmptyEl = $("keepsake-empty");
  const keepsakeGridEl = $("keepsake-grid");
  const detailViewEl = $("keepsake-detail-view");
  const detailNavTitleEl = $("detail-nav-title");
  const detailHeroImgEl = $("detail-hero-img");
  const detailTitleEl = $("detail-title");
  const detailBadgeEl = $("detail-badge");
  const detailStoryEl = $("detail-story");
  const detailDateEl = $("detail-date");
  const detailDownloadWrapEl = $("detail-download-wrap");

  function triggerRebound(el) {
    if (!el || REDUCED_MOTION) return;
    el.classList.remove("is-rebounding");
    void el.offsetWidth;
    el.classList.add("is-rebounding");
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

  /* ---------- 8. 星星滚字与双模小挂钟 ---------- */
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

  function updateClock() {
    const now = new Date();
    const hh = now.getHours(), mm = now.getMinutes(), ss = now.getSeconds();
    handHourEl.style.transform = `rotate(${(((hh % 12) + mm / 60) * 30).toFixed(1)}deg)`;
    handMinEl.style.transform = `rotate(${((mm + ss / 60) * 6).toFixed(1)}deg)`;
    handSecEl.style.transform = `rotate(${(ss * 6).toFixed(1)}deg)`;
    clockTimeTextEl.textContent = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
    const wk = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][now.getDay()];
    clockDateTextEl.textContent = `${now.getMonth() + 1}月${now.getDate()}日 ${wk}`;
  }
  function renderClockMode() {
    const isAnalog = state.clockMode === "analog";
    roomClockEl.className = "room-clock room-clock--" + state.clockMode;
    clockAnalogEl.hidden = !isAnalog;
    clockDigitalEl.hidden = isAnalog;
  }
  roomClockEl.addEventListener("click", () => {
    sfx.tap();
    state.clockMode = state.clockMode === "analog" ? "digital" : "analog";
    renderClockMode();
    triggerRebound(roomClockEl);
    persistState();
  });
  renderClockMode();
  updateClock();
  setInterval(updateClock, 1000);

  /* ---------- 9. 内嵌 catalog.json 快照（0ms 立即可用） + 远程静默热更 ---------- */
  let catalog = window.__EGGBABE_CATALOG__ || { backgrounds: [], pets: {} };

  function getSetName(petId, setId) {
    if (!catalog || !setId) return "";
    const p = catalog.pets && catalog.pets[petId];
    const found = p && p.items && p.items.find((x) => x.id === setId);
    return found ? found.name : "";
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

  /* ---------- 10. 左上状态牌（含一键切锦鲤/玉兔 + 养成状态同步） ---------- */
  let secretTapTimes = [];
  function syncCareIndicators() {
    const ps = careAll[state.petId] || careAll.koi;
    const isHungry = ps.hunger < 30;
    const isDirty = ps.hygiene < 30;
    dockDotHungryEl.hidden = !isHungry;
    dockDotDirtyEl.hidden = !isDirty;
    hudLvPillEl.textContent = `Lv.${ps.level}`;
    hudCareMiniEl.textContent = `饱食 ${Math.round(ps.hunger)}% · 清洁 ${Math.round(ps.hygiene)}%`;

    const showDirtyFx = isDirty && isWebGLActive() && careUiMode !== "bath";
    dirtyLayerEl.hidden = !showDirtyFx;
    if (showDirtyFx) positionDirtyFx();
  }

  function renderMoodTab() {
    const mood = DAILY_MOODS[state.moodKey] || DAILY_MOODS.JOY;
    hudStarCountEl.textContent = String(state.stars);
    hudDaysEl.textContent = `连续一起 ${state.companionDays} 天`;
    hudPetNameEl.textContent = state.petId === "yutu" ? "糯米团子 · 玉兔" : "锦小鲤 · 锦鲤";
    hudSwitchPetTextEl.textContent = state.petId === "yutu" ? "⇄ 锦鲤" : "⇄ 玉兔";
    hudMoodIconEl.textContent = mood.icon;
    hudMoodLabelEl.textContent = mood.label;

    const eqName = getSetName(state.petId, state.savedSet[state.petId]);
    hudMoodTextEl.textContent = eqName ? `${mood.text}（身穿「${eqName}」）` : mood.text;

    moodDetailEl.classList.toggle("pet-mood-tab__room-detail--open", state.moodPhase !== "minimal");
    moodSentenceEl.classList.toggle("pet-mood-tab__room-sentence--open", state.moodPhase === "expanded");
    syncCareIndicators();
  }

  $("btn-hud-switch-pet").addEventListener("click", async (ev) => {
    ev.stopPropagation();
    sfx.tap();
    const next = state.petId === "koi" ? "yutu" : "koi";
    await switchPet(next);
    showSceneFeedback(next === "koi" ? "已切换为：锦小鲤（12 套穿搭）" : "已切换为：糯米团子（24 套穿搭）", "system");
  });

  moodTabEl.addEventListener("click", () => {
    sfx.tap();
    const order = ["minimal", "summary", "expanded"];
    state.moodPhase = order[(order.indexOf(state.moodPhase) + 1) % order.length];
    renderMoodTab();
    triggerRebound(moodTabEl);

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

  function panoToBoxStyle(el, px, py, wPano, hPano) {
    el.style.left = (px * geom.panoScale).toFixed(1) + "px";
    el.style.top = (py * geom.panoScale).toFixed(1) + "px";
    if (wPano) el.style.width = (wPano * geom.panoScale).toFixed(1) + "px";
    if (hPano) el.style.height = (hPano * geom.panoScale).toFixed(1) + "px";
  }

  function scrollToScreen(screenIdx, smooth) {
    const maxScroll = worldTrackEl.offsetWidth - worldScrollEl.clientWidth;
    if (maxScroll <= 4) return;
    const targetX = geom.isPortrait
      ? clamp(screenIdx, 0, 2) * geom.vw
      : geom.ox + (screenIdx === 0 ? 720 : screenIdx === 2 ? 2120 : CORK_HOME.x) * geom.panoScale - geom.vw * 0.5;
    worldScrollEl.scrollTo({ left: clamp(targetX, 0, maxScroll), behavior: (smooth && !REDUCED_MOTION) ? "smooth" : "auto" });
  }

  function scrollToPanoX(panoX, smooth) {
    const maxScroll = worldTrackEl.offsetWidth - worldScrollEl.clientWidth;
    if (maxScroll <= 4) return;
    const targetX = geom.ox + panoX * geom.panoScale - geom.vw * 0.5;
    worldScrollEl.scrollTo({ left: clamp(targetX, 0, maxScroll), behavior: (smooth && !REDUCED_MOTION) ? "smooth" : "auto" });
  }

  worldScrollEl.addEventListener("scroll", () => {
    const maxS = worldTrackEl.offsetWidth - worldScrollEl.clientWidth;
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

  let currentPanoUrl = "./living-room-dress/panoramas/empty_day.png";
  let panoReqToken = 0;
  function resolveTargetPanoramaUrl() {
    const pd = state.period;
    if (isFittingOpen || state.roomState === "free_stand" || state.roomState === "away") {
      return `./living-room-dress/panoramas/empty_${pd}.png`;
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

  function spawnBeatFx(rt, b, s, pose) {
    if (REDUCED_MOTION) return;
    const fc = rt.faceCfg;
    const A = fc.anchors, cx = rt.cfg.cx;
    const topAnchor = (sd) => [cx + (A.top[0] - cx) * (sd || 1), A.top[1]];
    const anchor = (at, sd) => at === "L" ? A.L : at === "R" ? A.R : at === "S" ? (sd > 0 ? A.R : A.L) : topAnchor(sd);

    const n = document.createElement("div");
    n.className = "emo-beat-node";
    let src, frames, dur = 950;
    if (b.fx === "haha") {
      src = anchor(b.at, s); n.textContent = b.t; n.style.color = "#e0785a"; n.style.fontSize = "17px";
      const dx = (b.at === "L" ? -1 : 1) * 15;
      frames = [[0, 0, 0.5, 0, -4], [dx * 0.5, -12, 1.15, 1, 0], [dx, -32, 1, 0, 5]];
    } else if (b.fx === "tear") {
      const e = fc.eyes[b.eye]; const out = e.x < cx ? -1 : 1;
      src = [e.ex + out * e.erx * 0.55, e.ey + e.ery * 0.58];
      n.style.width = "8px"; n.style.height = "12px";
      n.style.borderRadius = "50% 50% 50% 50% / 38% 38% 62% 62%";
      n.style.background = "radial-gradient(circle at 36% 60%, #ffffff 0, #7cc6f8 42%, #2f80c8 100%)";
      frames = [[0, 0, 0.5, 0, 0], [out * 2, 14, 1.1, 1, 0], [out * 4, 32, 0.9, 0, 0]];
    } else if (b.fx === "q") {
      src = b.flip ? (s > 0 ? A.L : A.R) : topAnchor(s); n.textContent = "?";
      n.style.color = "#6b8fc4"; n.style.fontSize = b.big ? "24px" : "17px"; dur = 1150;
      frames = [[0, 0, 0.3, 0, -18], [0, -10, 1.1, 1, 6], [5, -24, 1, 0, 4]];
    } else if (b.fx === "bang") {
      src = topAnchor(s); n.textContent = "!"; n.style.color = "#ef5b3f"; n.style.fontSize = "26px"; dur = 800;
      frames = [[0, 4, 0.2, 0, 0], [0, -8, 1.3, 1, 0], [0, -16, 1, 0, 0]];
    } else if (b.fx === "heart") {
      src = anchor(b.at, s); n.textContent = "♥"; n.style.color = "#ff6f91"; n.style.fontSize = "18px"; dur = 1200;
      const d = b.at === "L" ? -1 : 1;
      frames = [[0, 0, 0.3, 0, 0], [d * 6, -14, 1.1, 1, -8 * d], [d * 4, -40, 0.9, 0, 0]];
    } else {
      src = anchor(b.at, s); n.textContent = "✦"; n.style.color = "#ffc23d"; n.style.fontSize = "18px";
      frames = [[0, 0, 0.2, 0, 0], [0, -6, 1.25, 1, 90], [0, -10, 0.6, 0, 180]];
    }
    const st = petCanvasPtToBoxPx(rt, src[0], src[1], pose);
    petFxHostEl.appendChild(n);
    if (typeof n.animate === "function") {
      const an = n.animate(frames.map((f, i) => ({
        transform: `translate(${(st[0] + f[0]).toFixed(1)}px,${(st[1] + f[1]).toFixed(1)}px) translate(-50%,-50%) scale(${f[2]}) rotate(${f[4]}deg)`,
        opacity: f[3],
        offset: i / (frames.length - 1)
      })), { duration: dur, easing: "ease-out", fill: "forwards" });
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
      sleepZzEl.hidden = false;
      const topPt = petCanvasPtToBoxPx(rt, rt.cfg.cx + 90, rt.cfg.head.y - rt.cfg.head.ry * 0.9, lastPose);
      sleepZzEl.style.left = topPt[0].toFixed(1) + "px";
      sleepZzEl.style.top = topPt[1].toFixed(1) + "px";
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
    const lowMood = ps.hunger < 30 || ps.hygiene < 30;
    const b = Math.sin((now / (lowMood ? 3500 : 2600)) * Math.PI * 2);
    const isKoi = rt.id === "koi";
    return makePose({
      sx: 1 - 0.006 * b,
      sy: (lowMood ? 0.985 : 1) + 0.012 * b,
      breath: (isKoi ? 0.014 : 0.018) * b,
      headRot: (lowMood ? 3.5 : isKoi ? 5.5 : 1.0) * Math.sin((now / 3600) * Math.PI * 2),
      headTy: lowMood ? 5 : 0,
      earL: -0.9 + 1.8 * Math.sin((now / 2500) * Math.PI * 2 + 0.3),
      earR: 0.9 + 1.8 * Math.sin((now / 2800) * Math.PI * 2 + 1.4),
      wDoze: bl
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
    const tint = !useRoomTint || state.period === "day" ? [1, 1, 1] : state.period === "sunset" ? [1.02, 0.95, 0.88] : [0.85, 0.89, 0.97];

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
      shSoftEl.style.opacity = String(0.92 * p.shO);
      shConEl.style.opacity = String(0.95 * p.shO);
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
    const wisp1 = dirtyLayerEl.querySelector(".stink-1");
    const wisp2 = dirtyLayerEl.querySelector(".stink-2");
    const flyA = dirtyLayerEl.querySelector(".fly-a");
    const flyB = dirtyLayerEl.querySelector(".fly-b");
    if (wisp1) panoToBoxStyle(wisp1, petPos.x - 130, petPos.y - 380);
    if (wisp2) panoToBoxStyle(wisp2, petPos.x + 125, petPos.y - 410);
    if (flyA) panoToBoxStyle(flyA, petPos.x - 155, petPos.y - 450);
    if (flyB) panoToBoxStyle(flyB, petPos.x + 150, petPos.y - 430);
  }

  function setCareUiMode(nextMode) {
    if (careUiMode === "bath" && nextMode !== "bath") {
      if (animMode === "scrub") startAnim("idle", performance.now());
      soapBubbleLayerEl.innerHTML = "";
    }
    careUiMode = careUiMode === nextMode ? "none" : nextMode;
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
    setCareUiMode("feed");
  });
  dockBtnBathEl.addEventListener("click", () => {
    sfx.tap();
    setToolboxOpen(false);
    triggerRebound(dockBtnBathEl);
    setCareUiMode("bath");
  });
  dockBtnWardrobeEl.addEventListener("click", () => {
    sfx.tap();
    setToolboxOpen(false);
    setCareUiMode("none");
    triggerRebound(dockBtnWardrobeEl);
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
    ps.hunger = clamp(ps.hunger + snack.hunger, 0, 100);
    const leveled = addCareExp(state.petId, snack.exp);

    sfx.munch();
    startAnim("eat", performance.now());
    const rt = petRuntimes[state.petId];
    if (rt) {
      spawnBeatFx(rt, { fx: "heart", at: "L" }, -1, lastPose);
      spawnBeatFx(rt, { fx: "heart", at: "R" }, 1, lastPose);
    }

    if (leveled) {
      setTimeout(() => {
        sfx.levelUp();
        animateStarsTo(state.stars + 5, 5);
        showSceneFeedback(`升到 Lv.${careAll[state.petId].level} 啦，获得 +5 陪伴星`, "system");
      }, 420);
    } else {
      animateStarsTo(state.stars + 1, 1);
    }
    renderMoodTab();
    showSceneFeedback(snack.reply, "dialogue");
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
    const list = SNACKS_BY_PET[state.petId] || SNACKS_BY_PET.koi;
    snackGridEl.innerHTML = "";
    list.forEach((sn) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "snack-3d-card";
      card.innerHTML =
        `<img src="${sn.icon}" alt="${sn.name}" />` +
        `<span class="snack-3d-card__name">${sn.name}</span>` +
        `<span class="snack-3d-card__meta">+${sn.hunger}饱食 · +${sn.exp}亲密</span>`;

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
    dockBtnBathEl.classList.remove("is-active");
    bathPanelEl.hidden = true;

    Array.from(soapBubbleLayerEl.children).forEach((el) => el.classList.add("is-popping"));
    setTimeout(() => { soapBubbleLayerEl.innerHTML = ""; }, 450);

    rinseFlashEl.hidden = false;
    setTimeout(() => { rinseFlashEl.hidden = true; }, 920);

    const ps = careAll[state.petId];
    ps.hygiene = 100;
    const leveled = addCareExp(state.petId, 24);
    sfx.splash();
    startAnim("rinse", performance.now());
    animateStarsTo(state.stars + 3, 3);
    renderMoodTab();
    showSceneFeedback(leveled ? `洗得香喷喷的，升到 Lv.${ps.level} 啦～` : "哗啦啦，洗得香喷喷的，毛毛好蓬松～", "dialogue");
  }

  let petTouch = null;
  let lastPetStarAt = 0;

  hitLayerEl.addEventListener("pointerdown", (ev) => {
    if (!isWebGLActive()) return;
    const pt = clientToPano(ev.clientX, ev.clientY);
    if (isPanoPointOnPet(pt.x, pt.y, 30)) {
      petTouch = { x0: ev.clientX, y0: ev.clientY, lastX: ev.clientX, lastY: ev.clientY, pt0: pt, moved: false };
    }
  });

  window.addEventListener("pointermove", (ev) => {
    if (!petTouch || !isWebGLActive()) return;
    const dx = ev.clientX - petTouch.x0;
    const stepDist = Math.hypot(ev.clientX - petTouch.lastX, ev.clientY - petTouch.lastY);
    petTouch.lastX = ev.clientX;
    petTouch.lastY = ev.clientY;

    if (careUiMode === "bath") {
      if (stepDist > 4) {
        petTouch.moved = true;
        const pt = clientToPano(ev.clientX, ev.clientY);
        scrubLean = clamp((pt.x - petPos.x) / 160, -1, 1);
        if (animMode !== "scrub") startAnim("scrub", performance.now());
        bathProgress = Math.min(100, bathProgress + stepDist * 0.26);
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
        addCareExp(state.petId, 10);
        animateStarsTo(state.stars + 2, 2);
        renderMoodTab();
        showSceneFeedback("呼噜呼噜～摸头最舒服啦♡", "dialogue");
      }
    }
  });

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

  hitLayerEl.addEventListener("click", (ev) => {
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

  function layoutScenePropsAndHotspots() {
    const inLivingRoom = !isCustomBgActive();
    wallPolaroidEl.hidden = !inLivingRoom || state.postcards.length === 0;
    if (!wallPolaroidEl.hidden) panoToBoxStyle(wallPolaroidEl, 985, 290, 148, 175);

    const showMirror = !isFittingOpen && inLivingRoom && state.roomState === "free_stand";
    deskMirrorPropEl.hidden = !showMirror;
    if (showMirror) panoToBoxStyle(deskMirrorPropEl, 1192, 884, 182, 182);

    const def = ROOM_STATES[state.roomState];
    const showFolded = !isFittingOpen && def && def.track === "baked" && !!state.savedSet[state.petId];
    foldedOutfitPropEl.hidden = !showFolded;
    if (showFolded) panoToBoxStyle(foldedOutfitPropEl, 412, 462, 168, 168);

    if (!isFittingOpen && def && (def.track === "baked" || def.track === "away")) {
      const anc = def.anchors[state.petId];
      if (anc && anc.c) {
        charHotspotEl.hidden = false;
        panoToBoxStyle(charHotspotEl, anc.c[0], anc.c[1], 390, 460);
      } else {
        charHotspotEl.hidden = true;
      }
      const actKey = `${state.petId}:${state.roomState}`;
      if (anc && anc.a && !state.actedStates[actKey]) {
        actionGlowEl.hidden = false;
        panoToBoxStyle(actionGlowEl, anc.a[0], anc.a[1], 106, 106);
      } else {
        actionGlowEl.hidden = true;
      }
    } else {
      charHotspotEl.hidden = true;
      actionGlowEl.hidden = true;
    }
    if (!dirtyLayerEl.hidden) positionDirtyFx();
  }

  deskMirrorPropEl.addEventListener("click", (ev) => { ev.stopPropagation(); sfx.tap(); enterFittingRoom(); });
  foldedOutfitPropEl.addEventListener("click", (ev) => {
    ev.stopPropagation(); sfx.tap();
    const name = getSetName(state.petId, state.savedSet[state.petId]) || "外套";
    showSceneFeedback(`脱下来的「${name}」叠好放在床头啦`, "system");
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
    state.actedStates[`${state.petId}:${state.roomState}`] = true;
    actionGlowEl.hidden = true;
    sfx.star();
    if (def.keepsakeId && !state.keepsakes.includes(def.keepsakeId)) {
      state.keepsakes.unshift(def.keepsakeId);
      tbAlbumDotEl.hidden = false;
    }
    animateStarsTo(state.stars + 3, 3);
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
    tbDeskToggleLabelEl.textContent = nextKey === "free_stand" ? "日常动作" : "唤回桌面";
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

  $("tb-btn-album").addEventListener("click", () => {
    setToolboxOpen(false);
    tbAlbumDotEl.hidden = true;
    openKeepsakeAlbum("postcards");
  });
  $("tb-btn-desk-toggle").addEventListener("click", () => {
    setToolboxOpen(false);
    if (state.roomState === "free_stand") {
      state.stageBgId = "living_room";
      const cycle = ["drawing", "sleep", "reading", "window", "gaming", "music", "lazy", "stare"];
      const pick = cycle[Math.floor(Math.random() * cycle.length)];
      applyRoomState(pick, true);
      showSceneFeedback(ROOM_STATES[pick].line, "dialogue");
    } else {
      applyRoomState("free_stand", true);
      sfx.hop();
      startAnim("minihop", performance.now());
      showSceneFeedback("回到桌面软木垫啦～", "dialogue");
    }
  });
  $("tb-btn-wallpaper").addEventListener("click", async () => {
    setToolboxOpen(false);
    await exportLockscreenWallpaperJpg();
  });
  $("tb-btn-sfx").addEventListener("click", () => {
    state.sfxOn = !state.sfxOn;
    tbSfxLabelEl.textContent = state.sfxOn ? "音效：开" : "音效：关";
    if (state.sfxOn) sfx.tap();
    persistState();
    setToolboxOpen(false);
    showSceneFeedback(state.sfxOn ? "互动音效已开启" : "互动音效已静音", "system");
  });
  tbSfxLabelEl.textContent = state.sfxOn ? "音效：开" : "音效：关";

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
    showSceneFeedback(eqName ? `已换好「${eqName}」` : "已恢复原生毛绒造型", "system");
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
    const bgTotal = 1 + (catalog.backgrounds ? catalog.backgrounds.length : 0);
    tabWardrobeItemsEl.textContent = `套装 (${pCfg.items.length})`;
    tabWardrobeBgsEl.textContent = `背景 (${bgTotal})`;
    wardrobeGridEl.innerHTML = "";

    if (activeWardrobeTab === "items") {
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
    state.postcards.unshift(activeLetterMeta);
    state.postcards = state.postcards.slice(0, 36);
    state.unreadMail = false;
    tbAlbumDotEl.hidden = false;

    const artUrl = await composeCleanIllustrationUrl(activeLetterMeta.petId, activeLetterMeta.setId, activeLetterMeta.sceneId);
    wallPolaroidImgEl.src = artUrl;
    letterOverlayEl.hidden = true;

    if (state.roomState === "away") applyRoomState("free_stand", true);
    else {
      renderContextEntry();
      layoutScenePropsAndHotspots();
    }
    if (letterGivesStar) animateStarsTo(state.stars + 8, 8);
    else persistState();
    showSceneFeedback("明信片已收进纪念册", "system");
  });

  wallPolaroidEl.addEventListener("click", (ev) => {
    ev.stopPropagation(); sfx.tap();
    if (state.postcards.length > 0) openDetailView("postcard", state.postcards[0]);
  });

  /* ---------- 19. 全屏 #FAFAF8 纪念册与详情页 ---------- */
  let currentAlbumTab = "postcards";
  let activeDetailPostcard = null;

  async function renderAlbumGrid() {
    document.querySelectorAll("[data-album-tab]").forEach((t) => t.classList.toggle("keepsake-tab--active", t.dataset.albumTab === currentAlbumTab));
    keepsakeGridEl.innerHTML = "";
    if (currentAlbumTab === "keepsakes") {
      const list = state.keepsakes.map((id) => KEPSAKE_DEFS[id]).filter(Boolean);
      keepsakeEmptyEl.hidden = list.length > 0;
      list.forEach((ks) => {
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "keepsake-cell keepsake-cell--keepsake";
        cell.innerHTML = `<div class="keepsake-cell__media"><img src="${ks.img}" alt="${ks.name}" /></div><div class="keepsake-cell__label">${ks.name}</div>`;
        cell.addEventListener("click", () => { sfx.tap(); openDetailView("keepsake", ks); });
        keepsakeGridEl.appendChild(cell);
      });
    } else {
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
    currentAlbumTab = tab || "postcards";
    albumViewEl.hidden = false;
    renderAlbumGrid();
  }

  async function openDetailView(kind, item) {
    detailViewEl.hidden = false;
    if (kind === "keepsake") {
      activeDetailPostcard = null;
      detailNavTitleEl.textContent = "遇见";
      detailHeroImgEl.src = item.img;
      detailTitleEl.textContent = item.name;
      detailBadgeEl.textContent = "日常回忆";
      detailStoryEl.textContent = item.story;
      detailDateEl.textContent = "";
      detailDownloadWrapEl.hidden = true;
    } else {
      activeDetailPostcard = item;
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

  document.querySelectorAll("[data-album-tab]").forEach((b) => b.addEventListener("click", () => { sfx.tap(); currentAlbumTab = b.dataset.albumTab; renderAlbumGrid(); }));
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
    [{ key: "day", label: "白天" }, { key: "sunset", label: "落日" }, { key: "night", label: "黑夜" }].forEach((o) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "tester-option" + (state.period === o.key ? " tester-option--active" : "");
      b.innerHTML = `<span>${o.label}</span><span>${state.period === o.key ? "✓" : ""}</span>`;
      b.addEventListener("click", () => {
        state.period = o.key;
        appEl.dataset.period = o.key;
        syncPanoramaImage(false);
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
      { label: "恢复满状态", fn: () => { ["koi", "yutu"].forEach((id) => { careAll[id].hunger = 95; careAll[id].hygiene = 98; }); saveCareAll(); renderMoodTab(); showSceneFeedback("已恢复饱满干净状态", "system"); } }
    ].forEach((act) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "tester-option";
      b.innerHTML = `<span>${act.label}</span>`;
      b.addEventListener("click", () => { act.fn(); closeAllTesterMenus(); });
      menuCare.appendChild(b);
    });
    updateDevTesterLabels();
  }

  function updateDevTesterLabels() {
    const pMap = { day: "白天", sunset: "落日", night: "黑夜" };
    $("tester-period-label").textContent = pMap[state.period] || "白天";
    $("tester-state-label").textContent = (ROOM_STATES[state.roomState] || ROOM_STATES.free_stand).label;
    $("tester-pet-label").textContent = state.petId === "yutu" ? "玉兔" : "锦鲤";
  }

  function closeAllTesterMenus() {
    ["menu-period", "menu-state", "menu-pet", "menu-care"].forEach((id) => { $(id).hidden = true; });
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
      const wasHidden = target.hidden;
      closeAllTesterMenus();
      target.hidden = !wasHidden;
    });
  });

  /* ---------- 21. 启动流程 ---------- */
  window.addEventListener("resize", updateViewportGeometry);

  async function boot() {
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

    buildDevTesterMenus();
    renderMoodTab();
    renderContextEntry();
    layoutScenePropsAndHotspots();
    scrollToScreen(1, false);
    requestAnimationFrame(mainLoop);
  }

  boot().catch((err) => {
    console.error("Failed to boot living-room-dress:", err);
  });
})();
