/* ==========================================================================
   蛋宝宝 · 破壳起居室 × 专属试衣间 × 零 Token 带妆明信片（1:1 小程序同源全景版）
   - 场景坐标系：2823 × 1672（100% 对齐 eggbabe-miniprogram post-hatch-assets.js）
   - 换装资产：../assets/shared/catalog.json（玉兔 24 套 + 锦鲤 12 套，纯压缩 PNG）
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

  const REDUCED_MOTION = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function sharedUrl(p) {
    return p.startsWith("assets/") ? "../" + p : p;
  }

  /* ---------- 1. 小程序官方每日心情、状态与遇见配置（复刻 daily-mood.js & life-scenes.js） ---------- */
  const DAILY_MOODS = {
    CURIOSITY: { key: "CURIOSITY", label: "好奇", icon: "🤔", text: "我今天一直在想一件事，还没想明白。" },
    JOY: { key: "JOY", label: "愉快", icon: "😊", text: "我想了想，觉得自己运气挺不错的。" },
    CALM: { key: "CALM", label: "平静", icon: "😌", text: "今天不想说太多话，就这样待着挺好。" },
    EXCITEMENT: { key: "EXCITEMENT", label: "兴奋", icon: "🤩", text: "我今天一刻都停不下来，坐下三秒又想起来。" },
    CARE: { key: "CARE", label: "关怀", icon: "🤗", text: "我想安静陪一会儿，就在旁边不出声。" },
    ANXIETY: { key: "ANXIETY", label: "焦虑", icon: "😰", text: "我今天心里一直不太稳，说不上来为什么。" },
    FRUSTRATION: { key: "FRUSTRATION", label: "沮丧", icon: "😞", text: "有件事我试了好几次，还是不行，先放着吧。" },
    FATIGUE: { key: "FATIGUE", label: "疲惫", icon: "🥱", text: "我今天没什么力气，动一下要歇三下。" }
  };

  const KEPSAKE_DEFS = {
    "soft-button": { id: "soft-button", name: "旧木纽扣", img: "./keepsakes/soft-button.png", story: "这颗纽扣原本缝在一条很旧的围巾上。围巾散线以后，我把它留了下来。天气凉的时候握一会儿，就像有人替我把领口掖好了。" },
    "short-pencil": { id: "short-pencil", name: "短短的铅笔", img: "./keepsakes/short-pencil.png", story: "这支铅笔越画越短，最后只剩两根手指那么长。我舍不得扔，因为每一道被削掉的木屑里都有一张画。现在画新东西前，我还是会先用它轻轻起稿。" },
    "dali-cloud": { id: "dali-cloud", name: "苍山脚下的云石", img: "./keepsakes/dali-cloud.png", story: "我在风很大的路边看到它，白色纹路像一小片被压住的云。带回来以后，我总把它放在窗边。天气变化时，那片云也像会换一种颜色。" },
    "cafe-coaster": { id: "cafe-coaster", name: "软木杯垫", img: "./keepsakes/cafe-coaster.png", story: "忙乱的时候，有位客人把歪掉的杯垫扶正了。那只是一个很小的动作，却让桌面突然安静下来。后来收桌子时，我也总会顺手替下一位摆正它。" },
    "wood-rattle": { id: "wood-rattle", name: "小拨浪鼓", img: "./keepsakes/wood-rattle.png", story: "课堂结束时，老师拿它演示声音怎样一圈圈传出去。我轻轻摇了一下，教室里的人都笑了。后来每当想不出问题，我就听它先替我开个头。" },
    "ginkgo-leaf": { id: "ginkgo-leaf", name: "一片银杏叶", img: "./keepsakes/ginkgo-leaf.png", story: "它落下来时正好停在我的鞋尖。我把它夹在纸页里带回家，边缘慢慢变得像金色的小扇子。每次拿出来，我都会先看看它有没有又轻一点。" }
  };

  const ROOM_STATES = {
    free_stand: {
      key: "free_stand", label: "桌面待机", screen: 1, track: "webgl",
      line: "软木垫晒得暖洋洋的，今天这套衣服合身吗？",
      actionFeedback: ""
    },
    sleep: {
      key: "sleep", fileKey: "nap", label: "睡觉", screen: 0, track: "baked",
      line: "我把被角压在脸下面，睡得很安静。",
      actionFeedback: "房间暗下来，我翻了个身。",
      keepsakeId: "soft-button",
      anchors: { yutu: { c: [790, 875], a: [663, 344] }, koi: { c: [650, 860], a: [663, 344] } }
    },
    lazy: {
      key: "lazy", fileKey: "lazy", label: "小憩", screen: 0, track: "baked",
      line: "我听见窗外亮起来了，还想再缩一会儿。",
      actionFeedback: "被子轻轻盖好，我往里缩了缩。",
      keepsakeId: "soft-button",
      anchors: { yutu: { c: [760, 870], a: [570, 980] }, koi: { c: [650, 810], a: [560, 975] } }
    },
    stare: {
      key: "stare", fileKey: "stare", label: "发呆", screen: 1, track: "baked",
      line: "我盯着桌上的光斑，看它慢慢走过半张纸。",
      actionFeedback: "我慢半拍地回头看你。",
      keepsakeId: "cafe-coaster",
      anchors: { yutu: { c: [1450, 930], a: [1450, 930] }, koi: { c: [1590, 980], a: [1590, 980] } }
    },
    drawing: {
      key: "drawing", fileKey: "draw", label: "涂涂画画", screen: 1, track: "baked",
      line: "我画了半张纸，还没有决定它像云还是像鱼。",
      actionFeedback: "画纸转向你，线条终于看清了。",
      keepsakeId: "short-pencil",
      anchors: { yutu: { c: [1440, 1010], a: [1510, 1245] }, koi: { c: [1480, 1000], a: [1510, 1245] } }
    },
    reading: {
      key: "reading", fileKey: "read", label: "看书", screen: 1, track: "baked",
      line: "这一页讲到月亮，我把耳朵靠近一点听。",
      actionFeedback: "书页翻过去，故事又向前走了一小格。",
      keepsakeId: "short-pencil",
      anchors: { yutu: { c: [1420, 930], a: [1415, 1055] }, koi: { c: [1430, 980], a: [1410, 1060] } }
    },
    gaming: {
      key: "gaming", fileKey: "game", label: "打游戏", screen: 1, track: "baked",
      line: "这一关差一点就过去了，我连耳朵都没敢动。",
      actionFeedback: "画面里的小角色跳了一下，我没有抬头。",
      keepsakeId: "cafe-coaster",
      anchors: { yutu: { c: [1400, 990], a: [1490, 1120] }, koi: { c: [1400, 990], a: [1500, 1120] } }
    },
    music: {
      key: "music", fileKey: "music", label: "听音乐", screen: 1, track: "baked",
      line: "这首歌的尾巴轻轻绕了一圈，我还不想按暂停。",
      actionFeedback: "旋律又走了一小段，房间里像多了一点月光。",
      keepsakeId: "wood-rattle",
      anchors: { yutu: { c: [1710, 985], a: [1590, 1050] }, koi: { c: [1780, 1000], a: [1680, 1055] } }
    },
    window: {
      key: "window", fileKey: "window", label: "看窗外", screen: 2, track: "baked",
      line: "远处的云走得很慢，我想和你一起看一会儿。",
      actionFeedback: "窗外的光慢慢铺开，我陪你看着此刻的天空。",
      keepsakeId: "ginkgo-leaf",
      anchors: { yutu: { c: [1940, 835], a: [2200, 450] }, koi: { c: [1940, 830], a: [2200, 450] } }
    },
    away: {
      key: "away", label: "外出旅行", screen: 1, track: "away",
      line: "大理的风比我想的大，我把新衣服的帽子按住了一路。",
      actionFeedback: "桌上留了一张小字条：我穿着新衣服出门寄明信片啦。",
      keepsakeId: "dali-cloud",
      anchors: { yutu: { c: null, a: [1385, 1345] }, koi: { c: null, a: [1385, 1345] } }
    }
  };

  const POSTCARD_SCENES = [
    {
      id: "sunset_meadow", label: "晚霞云朵坡", src: "../assets/shared/png/bgs/bg_sunset_meadow.png",
      tint: "rgba(255,186,138,0.11)", shadowRgba: "rgba(68,42,24,0.30)", pose: "tilt", anchorY: 0.865, scaleK: 1.32,
      copy: {
        yutu: "傍晚路过云朵坡，风把长耳朵吹得软软的。出门前换上的这身衣服刚好被晚霞染成了暖杏色。",
        koi: "顺着晚霞游到了云朵坡，尾巴尖沾了一点橘子汽水似的光，拍张照寄回书桌给你看。"
      }
    },
    {
      id: "moon_courtyard", label: "桂月亭台夜", src: "../assets/shared/png/bgs/bg_moon_courtyard.png",
      tint: "rgba(130,158,235,0.12)", shadowRgba: "rgba(24,32,58,0.34)", pose: "cute", anchorY: 0.865, scaleK: 1.30,
      copy: {
        yutu: "今晚的月亮又圆又亮，亭子边的桂花落在衣角上，我替你接住了最香的那一朵。",
        koi: "夜里的石阶凉丝丝的，踩着月光散步时，听见草丛里小虫子在轻轻伴奏。"
      }
    },
    {
      id: "mint_room", label: "街角薄荷屋", src: "../assets/shared/png/bgs/bg_mint_room.png",
      tint: "rgba(195,224,198,0.09)", shadowRgba: "rgba(38,54,42,0.28)", pose: "jump", anchorY: 0.865, scaleK: 1.30,
      copy: {
        yutu: "偶遇一间薄荷色的小茶屋，店长夸我今天穿得特别精神，还分了我一小块热松饼。",
        koi: "在薄荷屋窗边躲了一阵太阳，身上的穿搭和这里的复古绿木地板很配吧。"
      }
    },
    {
      id: "lotus_pond", label: "荷灯许愿池", src: "../assets/shared/png/bgs/bg_lotus_pond.png",
      tint: "rgba(116,190,218,0.11)", shadowRgba: "rgba(22,48,58,0.32)", pose: "tilt", anchorY: 0.865, scaleK: 1.32,
      copy: {
        yutu: "水面上漂着一盏盏暖融融的小荷灯，我蹲在岸边看了好久，留了一盏最亮的给你。",
        koi: "回到熟悉的水边，水波一晃一晃把新衣服映得亮晶晶的。"
      }
    },
    {
      id: "studio_desk", label: "窗边起居室", src: "./panoramas/empty_day.png", cropCenter: true,
      tint: "rgba(255,224,182,0.07)", shadowRgba: "rgba(58,36,18,0.30)", pose: "cute", anchorY: 0.855, scaleK: 1.34,
      copy: {
        yutu: "在书桌软木垫试衣台刚换好的新造型，趁咖啡还温热，留一张今天的居家定妆纪念。",
        koi: "站在阳光晒暖的软木垫上转了个圈，这套新穿搭正式收录进今日份好心情。"
      }
    }
  ];

  const EMOTE_LINES = {
    yutu: {
      laugh: ["耳朵尖有点痒，再摸一下也可以。", "嘿嘿，今天心情亮晶晶的。"],
      sad: ["刚刚差点没站稳，扶我一下嘛。", "陪我在桌边待一会儿好不好。"],
      think: ["我在数窗外飘过去几朵云。", "今天穿哪一套去寄明信片好呢？"],
      cute: ["这套衣服把耳朵衬得很精神吧。", "离你近一点，软木垫都更暖和了。"]
    },
    koi: {
      laugh: ["咕噜噜，开心得冒出一串小泡泡。", "蹭蹭手心，分你一点今日份好运。"],
      sad: ["水草缠住尾巴尖啦，帮我理一理。", "安静待在你手边就会安心下来。"],
      think: ["咖啡杯里的倒影好像也在看我。", "等风停了，我想去巷口看看。"],
      cute: ["转个身给你看新衣服的背面。", "有你在旁边，连发呆都很有趣。"]
    }
  };

  // 严格遵守 AGENTS.md：严禁在玉兔脸上添加粉色腮红（allowBlush: false）
  const FACES = {
    yutu: {
      rect: [230, 425, 620, 680], allowBlush: false,
      eyes: [
        { x: 341, y: 553, r: 27, ex: 327, ey: 549, erx: 43, ery: 52 },
        { x: 503, y: 554, r: 27, ex: 521, ey: 549, erx: 44, ery: 51 }
      ],
      lookUp: [4, -11]
    },
    koi: {
      rect: [156, 252, 506, 532], allowBlush: true, cheeks: [[202, 438], [450, 438]], cheekR: 28,
      eyes: [
        { x: 247, y: 371, r: 27, ex: 243, ey: 368, erx: 51, ery: 57 },
        { x: 398, y: 371, r: 27, ex: 398, ey: 369, erx: 52, ery: 56 }
      ],
      lookUp: [5, -14]
    }
  };

  /* ---------- 2. 轻量持久化状态（仅存元数据，零 base64 膨胀） ---------- */
  const SAVE_KEY = "eggbabe_living_room_mp_v3";
  function detectLocalPeriod() {
    const h = new Date(Date.now() + 8 * 3600 * 1000).getUTCHours();
    if (h >= 6 && h < 17) return "day";
    if (h >= 17 && h < 19) return "sunset";
    return "night";
  }

  const state = {
    petId: "yutu",
    roomState: "free_stand",
    period: detectLocalPeriod(),
    moodKey: "CURIOSITY",
    moodPhase: "summary", // minimal | summary | expanded
    clockMode: "analog",  // analog | digital
    sfxOn: true,
    stars: 120,
    companionDays: 12,
    unreadMail: true,
    actedStates: {},
    owned: {
      yutu: ["set_cozy_knit", "set_moon_palace", "set_rain_frog", "set_barista_bunny"],
      koi: ["set_duck", "set_strawberry_pj", "set_sailor"]
    },
    savedSet: { yutu: "set_cozy_knit", koi: "set_duck" },
    keepsakes: ["short-pencil"],
    postcards: [] // [{ id, sceneId, petId, setId, dateText, createdAt }]
  };

  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p && typeof p === "object") {
        if (p.petId === "koi" || p.petId === "yutu") state.petId = p.petId;
        if (typeof p.stars === "number") state.stars = p.stars;
        if (p.clockMode === "digital" || p.clockMode === "analog") state.clockMode = p.clockMode;
        if (typeof p.sfxOn === "boolean") state.sfxOn = p.sfxOn;
        if (p.owned) state.owned = Object.assign(state.owned, p.owned);
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
        clockMode: state.clockMode,
        sfxOn: state.sfxOn,
        unreadMail: state.unreadMail,
        owned: state.owned,
        savedSet: state.savedSet,
        keepsakes: state.keepsakes,
        postcards: state.postcards.slice(0, 36)
      }));
    } catch (e) {}
  }

  /* ---------- 3. 程序化 Web Audio 轻音效（对齐 PRD-0001 sfx.js） ---------- */
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
      gain.gain.setValueAtTime(gainVal || 0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + dur + 0.02);
    } catch (e) {}
  }
  const sfx = {
    tap: () => playTone(520, 660, 0.07, 0.045, "sine"),
    hop: () => playTone(340, 580, 0.13, 0.05, "triangle"),
    star: () => { playTone(660, 880, 0.11, 0.05, "sine"); setTimeout(() => playTone(880, 1175, 0.16, 0.05, "sine"), 85); },
    unlock: () => { playTone(523, 659, 0.1, 0.055, "triangle"); setTimeout(() => playTone(659, 1046, 0.22, 0.06, "sine"), 95); }
  };

  /* ---------- 4. DOM 引用 ---------- */
  const $ = (id) => document.getElementById(id);
  const appEl = $("app");
  const worldScrollEl = $("world-scroll");
  const worldTrackEl = $("world-track");
  const cameraRigEl = $("camera-rig");
  const panoBoxEl = $("pano-box");
  const panoPrevEl = $("pano-prev");
  const panoCurrEl = $("pano-curr");
  const panoPreloadEl = $("pano-preload");

  const wallPolaroidEl = $("wall-polaroid");
  const wallPolaroidImgEl = $("wall-polaroid-img");
  const foldedOutfitPropEl = $("folded-outfit-prop");
  const deskMirrorPropEl = $("desk-mirror-prop");
  const shSoftEl = $("pet-shadow-soft");
  const shConEl = $("pet-shadow-contact");
  const glCanvas = $("gl-pet");
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
  const hudDaysEl = $("hud-companion-days");
  const moodDetailEl = $("mood-room-detail");
  const moodSentenceEl = $("mood-room-sentence");
  const hudPetNameEl = $("hud-pet-name");
  const hudMoodIconEl = $("hud-mood-icon");
  const hudMoodLabelEl = $("hud-mood-label");
  const hudMoodTextEl = $("hud-mood-text");

  const roomClockEl = $("room-clock");
  const clockAnalogEl = $("clock-analog");
  const clockDigitalEl = $("clock-digital");
  const handHourEl = $("clock-hand-hour");
  const handMinEl = $("clock-hand-minute");
  const handSecEl = $("clock-hand-second");
  const clockTimeTextEl = $("clock-time-text");
  const clockDateTextEl = $("clock-date-text");

  const btnContextEntryEl = $("btn-context-entry");
  const contextIconEl = $("context-entry-icon");
  const contextUnreadDotEl = $("context-unread-dot");
  const letterPlaneFxEl = $("letter-plane-fx");

  const actionDockEl = $("scene-action-dock");
  const btnOpenFittingEl = $("btn-open-fitting");
  const toolboxDismissEl = $("toolbox-dismiss");
  const toolboxEl = $("companion-toolbox");
  const btnToolboxEl = $("btn-toolbox");
  const toolboxBtnMotionEl = $("toolbox-btn-motion");
  const chestClosedEl = $("chest-lid-closed");
  const chestOpenEl = $("chest-lid-open");
  const tbAlbumDotEl = $("tb-album-dot");
  const tbDeskToggleLabelEl = $("tb-desk-toggle-label");
  const tbSwitchPetLabelEl = $("tb-switch-pet-label");
  const tbSfxLabelEl = $("tb-sfx-label");

  const devTestersEl = $("dev-testers");
  const btnAcceptanceToggleEl = $("btn-acceptance-toggle");
  const acceptanceChevronEl = $("acceptance-chevron");
  const acceptanceStackEl = $("acceptance-stack");

  const fittingTopbarEl = $("fitting-topbar");
  const wardrobeSheetEl = $("wardrobe-sheet");
  const wardrobeGridEl = $("wardrobe-grid");
  const sheetStarCountEl = $("sheet-star-count");
  const btnRevertOutfitEl = $("btn-revert-outfit");
  const btnConfirmOutfitEl = $("btn-confirm-outfit");
  const confirmOutfitTextEl = $("confirm-outfit-text");

  const letterOverlayEl = $("today-companion-overlay");
  const letterAwardBoxEl = $("letter-award-box");
  const letterAwardPlusEl = $("letter-award-plus");
  const letterTitleEl = $("letter-title");
  const letterLineEl = $("letter-line");
  const postcardScenePillsEl = $("postcard-scene-pills");
  const letterPolaroidImgEl = $("letter-polaroid-img");
  const polaroidPlaceEl = $("polaroid-place");
  const polaroidOutfitEl = $("polaroid-outfit");
  const collectLetterTextEl = $("collect-letter-text");

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

  /* ---------- 5. 中场 34vh 双层场景反馈栈（dialogue + system） ---------- */
  let feedbackTimer = 0;
  let lastSystemNotice = "";
  function showSceneFeedback(text, variant, tone, durationMs) {
    if (!text) return;
    const v = variant === "system" ? "system" : "dialogue";
    if (v === "dialogue" && feedbackStackEl.classList.contains("scene-feedback-stack--visible") && feedbackFrontEl.classList.contains("scene-feedback-stack__card--system")) {
      lastSystemNotice = feedbackFrontTextEl.textContent || "";
      feedbackBackTextEl.textContent = lastSystemNotice;
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
    }, durationMs || (v === "system" ? 1900 : 2500));
  }

  /* ---------- 6. 左上星星滚字动画与双模小挂钟 ---------- */
  let starRollRaf = 0;
  let displayedStars = state.stars;
  function animateStarsTo(targetVal, gainDelta) {
    const startVal = displayedStars;
    state.stars = targetVal;
    sheetStarCountEl.textContent = String(targetVal);
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
    const dur = 520;
    function step(now) {
      const u = Math.min(1, (now - t0) / dur);
      const ease = 1 - Math.pow(1 - u, 3);
      displayedStars = Math.round(startVal + (targetVal - startVal) * ease);
      hudStarCountEl.textContent = String(displayedStars);
      if (u < 1) starRollRaf = requestAnimationFrame(step);
    }
    starRollRaf = requestAnimationFrame(step);
  }

  function updateClock() {
    const now = new Date();
    const hh = now.getHours();
    const mm = now.getMinutes();
    const ss = now.getSeconds();
    const hDeg = ((hh % 12) + mm / 60) * 30;
    const mDeg = (mm + ss / 60) * 6;
    const sDeg = ss * 6;
    handHourEl.style.transform = `rotate(${hDeg.toFixed(1)}deg)`;
    handMinEl.style.transform = `rotate(${mDeg.toFixed(1)}deg)`;
    handSecEl.style.transform = `rotate(${sDeg.toFixed(1)}deg)`;

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

  /* ---------- 7. 左上三阶陪伴心情牌 + 连点 5 次开启验收器 ---------- */
  let secretTapTimes = [];
  function renderMoodTab() {
    const mood = DAILY_MOODS[state.moodKey] || DAILY_MOODS.CURIOSITY;
    hudStarCountEl.textContent = String(state.stars);
    sheetStarCountEl.textContent = String(state.stars);
    hudDaysEl.textContent = `连续一起 ${state.companionDays} 天`;
    hudPetNameEl.textContent = state.petId === "yutu" ? "糯米团子" : "锦小鲤";
    hudMoodIconEl.textContent = mood.icon;
    hudMoodLabelEl.textContent = mood.label;

    const eqSetId = state.savedSet[state.petId];
    const eqName = getSetName(state.petId, eqSetId);
    hudMoodTextEl.textContent = eqName ? `${mood.text}（今天穿了「${eqName}」）` : mood.text;

    moodDetailEl.classList.toggle("pet-mood-tab__room-detail--open", state.moodPhase !== "minimal");
    moodSentenceEl.classList.toggle("pet-mood-tab__room-sentence--open", state.moodPhase === "expanded");
  }
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

  /* ---------- 8. 三屏全景视口与母图锚点映射（mapPanoramaPoints） ---------- */
  let geom = { vw: 390, vh: 844, isPortrait: true, trackW: 1170, panoScale: 0.5, ox: 0, oy: 0, pw: 1411, ph: 836 };

  function updateViewportGeometry() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
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

    screenDotsEl.style.display = (isPortrait || trackW > vw + 24) ? "flex" : "none";
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
    let targetX = 0;
    if (geom.isPortrait) {
      targetX = clamp(screenIdx, 0, 2) * geom.vw;
    } else {
      const focusPanoX = screenIdx === 0 ? 720 : screenIdx === 2 ? 2120 : CORK_HOME.x;
      targetX = geom.ox + focusPanoX * geom.panoScale - geom.vw * 0.5;
    }
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

  // 支持桌面鼠标拖拽摇镜
  let mousePan = null;
  worldScrollEl.addEventListener("pointerdown", (ev) => {
    if (ev.pointerType === "mouse" && !isFittingOpen && worldTrackEl.offsetWidth > worldScrollEl.clientWidth + 8) {
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

  /* ---------- 9. 全景底图预加载与 520ms 丝滑交叉淡入 ---------- */
  let currentPanoUrl = "./panoramas/empty_day.png";
  let panoReqToken = 0;

  function resolveTargetPanoramaUrl() {
    const pd = state.period;
    if (isFittingOpen || state.roomState === "free_stand" || state.roomState === "away") {
      return `./panoramas/empty_${pd}.png`;
    }
    const def = ROOM_STATES[state.roomState];
    const charFolder = state.petId === "yutu" ? "jade-rabbit" : "boon-koi";
    return `./panoramas/${charFolder}/${def.fileKey}_${pd}.png`;
  }

  function syncPanoramaImage(immediate) {
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

  /* ---------- 10. WebGL 毛绒换装与眼睛着色器引擎 ---------- */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const sstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const easeInOut = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const easeOutBack = (t) => { const c = 1.6; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  function rotPt(x, y, px, py, deg) {
    const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a), dx = x - px, dy = y - py;
    return [px + dx * c - dy * s, py + dx * s + dy * c];
  }

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
    "  return vec3(cover, clamp(line, 0.0, 1.0), 1.0 + clamp(-0.045 * d.x - 0.055 * d.y, -0.09, 0.07));" +
    "}" +
    "vec4 happyEye(vec2 uv, vec4 eye, float w){" +
    "  if (w <= 0.004) return vec4(0.0, 0.0, 0.0, 1.0); vec2 d = (uv - eye.xy) / eye.zw; float rad = length(d); if (rad > 1.20) return vec4(0.0, 0.0, 0.0, 1.0);" +
    "  float mask = smoothstep(1.16, 0.78, rad); float xTaper = smoothstep(0.68, 0.22, abs(d.x)); float yArc = -0.20 + 0.62 * (d.x * d.x); float thick = 0.042 + 0.068 * xTaper;" +
    "  float stroke = (1.0 - smoothstep(thick * 0.48, thick + 0.036, abs(d.y - yArc))) * xTaper * w * mask;" +
    "  return vec4(mask * w, stroke, 0.0, 1.0);" +
    "}" +
    "void main(){" +
    "  vec4 a = texture2D(t0, vUv); vec4 col;" +
    "  if (uEye > 0.5) {" +
    "    col = a; float c2 = clamp(w2, 0.0, 1.0); float c1 = clamp(w1, 0.0, 1.0);" +
    "    if (c2 > 0.004 || c1 > 0.004) {" +
    "      vec4 plush = texture2D(t2, vUv); vec3 furRgb = plush.rgb / max(plush.a, 0.001); vec3 rgb = col.rgb / max(col.a, 0.001);" +
    "      if (c2 > 0.004) { vec3 lL = eyeLid(vUv, uEyeL, c2); vec3 lR = eyeLid(vUv, uEyeR, c2); float cov = max(lL.x, lR.x); rgb = mix(rgb, furRgb * (lL.x >= lR.x ? lL.z : lR.z), cov); rgb = mix(rgb, vec3(0.14,0.115,0.098), max(lL.y, lR.y)); }" +
    "      if (c1 > 0.004) { vec4 hL = happyEye(vUv, uEyeL, c1); vec4 hR = happyEye(vUv, uEyeR, c1); rgb = mix(rgb, furRgb, max(hL.x, hR.x)); rgb = mix(rgb, vec3(0.14,0.115,0.098), max(hL.y, hR.y)); }" +
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

  let catalog = null;
  const petRuntimes = {};

  function getSetName(petId, setId) {
    if (!catalog || !setId) return "";
    const p = catalog.pets && catalog.pets[petId];
    const found = p && p.items && p.items.find((x) => x.id === setId);
    return found ? found.name : "";
  }

  function setPriceFor(item, idx) {
    if (typeof item.price === "number") return item.price;
    return 15 + (idx % 3) * 5;
  }

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

    const [tBase, tClosed, tDoze] = await Promise.all([
      loadTex(pCfg.textures.base), loadTex(pCfg.textures.closed), loadTex(pCfg.textures.doze)
    ]);
    const hitCanvas = document.createElement("canvas");
    hitCanvas.width = pCfg.canvasW; hitCanvas.height = pCfg.canvasH;
    const hitCtx = hitCanvas.getContext("2d", { willReadFrequently: true });
    hitCtx.drawImage(imgCache.get(sharedUrl(pCfg.textures.base)), 0, 0, pCfg.canvasW, pCfg.canvasH);

    const fCfg = FACES[petId];
    const fr = fCfg.rect;
    const rt = {
      id: petId,
      // 匹配 2823×1672 母图中玉兔与锦鲤在软木垫上的真实微距比例
      cfg: Object.assign({}, pCfg, { baseScale: petId === "yutu" ? 0.565 : 0.715 }),
      rest, uv, pos, uvBuf, posBuf, hitCtx,
      defaultTex: { base: tBase, closed: tClosed, doze: tDoze },
      setTexMap: {},
      faceCfg: fCfg,
      faceGrid: makeSubGrid({ x: fr[0], y: fr[1], w: fr[2] - fr[0], h: fr[3] - fr[1] }),
      faceTextures: {}
    };
    petRuntimes[petId] = rt;
    if (state.savedSet[petId]) await ensureSetLoaded(rt, state.savedSet[petId]);
    return rt;
  }

  async function ensureSetLoaded(rt, setId) {
    if (!setId || rt.setTexMap[setId]) return rt.setTexMap[setId];
    const item = rt.cfg.items.find((x) => x.id === setId);
    if (!item) return null;
    const [tBase, tClosed, tDoze] = await Promise.all([
      loadTex(item.tex),
      item.closedTex ? loadTex(item.closedTex) : Promise.resolve(rt.defaultTex.closed),
      item.dozeTex ? loadTex(item.dozeTex) : Promise.resolve(rt.defaultTex.doze)
    ]);
    const entry = { base: tBase, closed: tClosed, doze: tDoze, eyeLUV: item.eyeLUV, eyeRUV: item.eyeRUV };
    rt.setTexMap[setId] = entry;
    return entry;
  }

  function paintFaceOverlay(rt, kind) {
    if (rt.faceTextures[kind]) return rt.faceTextures[kind];
    const F = rt.faceCfg, fr = F.rect, fw = fr[2] - fr[0], fh = fr[3] - fr[1];
    const cnv = document.createElement("canvas"); cnv.width = fw; cnv.height = fh;
    const c = cnv.getContext("2d"); c.translate(-fr[0], -fr[1]);
    const lw = (px) => px / 0.22;
    function coverPupil(e) {
      c.save(); c.beginPath(); c.ellipse(e.ex, e.ey, e.erx, e.ery, 0, 0, Math.PI * 2); c.clip();
      c.fillStyle = "#F7F5F0"; c.beginPath(); c.arc(e.x, e.y, e.r + 5, 0, Math.PI * 2); c.fill(); c.restore();
    }
    if (kind === "laugh" || kind === "cute") {
      F.eyes.forEach((e) => {
        coverPupil(e); c.save(); c.strokeStyle = "rgba(52,38,32,0.92)"; c.lineWidth = lw(2.3); c.lineCap = "round";
        c.beginPath(); c.moveTo(e.x - e.r * 0.9, e.y + e.r * 0.28); c.quadraticCurveTo(e.x, e.y - e.r * 0.9, e.x + e.r * 0.9, e.y + e.r * 0.28); c.stroke(); c.restore();
      });
      if (F.allowBlush && F.cheeks) {
        F.cheeks.forEach((pt) => {
          const g = c.createRadialGradient(pt[0], pt[1], 0, pt[0], pt[1], F.cheekR);
          g.addColorStop(0, "rgba(255,124,142,0.48)"); g.addColorStop(1, "rgba(255,150,160,0)");
          c.fillStyle = g; c.beginPath(); c.arc(pt[0], pt[1], F.cheekR, 0, Math.PI * 2); c.fill();
        });
      }
    } else if (kind === "sad") {
      F.eyes.forEach((e, idx) => {
        c.save(); c.strokeStyle = "rgba(52,38,32,0.9)"; c.lineWidth = lw(2.0); c.lineCap = "round";
        const dir = idx === 0 ? -1 : 1;
        c.beginPath(); c.moveTo(e.x - dir * 22, e.y - e.r - 15); c.lineTo(e.x + dir * 16, e.y - e.r - 24); c.stroke(); c.restore();
      });
    } else if (kind === "think") {
      F.eyes.forEach((e) => {
        coverPupil(e); const R = e.r + 2;
        c.save(); c.beginPath(); c.ellipse(e.ex, e.ey, e.erx, e.ery, 0, 0, Math.PI * 2); c.clip();
        c.drawImage(rt.hitCtx.canvas, e.x - R, e.y - R, 2 * R, 2 * R, e.x - R + F.lookUp[0], e.y - R + F.lookUp[1], 2 * R, 2 * R);
        c.restore();
      });
    }
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cnv);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    rt.faceTextures[kind] = t;
    return t;
  }

  /* ---------- 11. 网格形变与姿态循环 ---------- */
  const KEYS = ["hopY", "rot", "sx", "sy", "breath", "headRot", "headTx", "headTy", "earL", "earR", "lean", "wClosed", "wDoze", "shS", "shO"];
  function P(o) {
    const p = { hopY: 0, rot: 0, sx: 1, sy: 1, breath: 0, headRot: 0, headTx: 0, headTy: 0, earL: 0, earR: 0, lean: 0, wClosed: 0, wDoze: 0, shS: 1, shO: 1 };
    if (o) for (const k in o) p[k] = o[k];
    return p;
  }
  function mixPose(a, b, t) { const p = P({}); KEYS.forEach((k) => { p[k] = lerp(a[k], b[k], t); }); return p; }
  function kfPose(list, u) {
    u = clamp(u, 0, 1); let a = list[0], b = list[list.length - 1];
    for (let i = 1; i < list.length; i++) if (u <= list[i].o) { a = list[i - 1]; b = list[i]; break; }
    let t = clamp((u - a.o) / ((b.o - a.o) || 1), 0, 1);
    t = a.e === "out" ? easeOutCubic(t) : a.e === "in" ? t * t * t : a.e === "back" ? easeOutBack(t) : a.e === "io" ? easeInOut(t) : t;
    return mixPose(P(a), P(b), t);
  }

  function deformVertex(cfg, x, y, p, eL, eR) {
    const CX = cfg.cx, FEET_Y = cfg.feetY, NECK = cfg.neck, HEAD = cfg.head;
    const hd = Math.sqrt(Math.pow((x - HEAD.x) / HEAD.rx, 2) + Math.pow((y - HEAD.y) / HEAD.ry, 2));
    const out = sstep(0.9, 1.04, hd) * sstep(HEAD.y - 60, HEAD.y - 160, y);
    if (out > 0) {
      const side = sstep(CX - 30, CX + 30, x);
      const piv = side < 0.5 ? cfg.earL : cfg.earR;
      const along = clamp((piv.y - y) / (cfg.id === "koi" ? 85 : 320), 0, 1);
      const ang = lerp(eL, eR, side) * out * (0.55 + 0.45 * along) * (cfg.earAmp || 1);
      const r = rotPt(x, y, piv.x, piv.y, ang); x = r[0]; y = r[1];
    }
    x += (x - CX) * p.breath * Math.exp(-Math.pow((y - cfg.bodyY) / 130, 2));
    const wBody = sstep(NECK.y - 65, NECK.y + 70, y);
    const neckY = FEET_Y + (NECK.y - FEET_Y) * p.sy;
    const feetPin = sstep(FEET_Y - 140, FEET_Y - 20, y);
    const kx = lerp(p.sx, 1 + (p.sx - 1) * 0.12, 1 - wBody);
    x = CX + (x - CX) * lerp(kx, 1 + (kx - 1) * 0.4, feetPin);
    y = lerp(y + (neckY - NECK.y), FEET_Y + (y - FEET_Y) * p.sy, wBody);
    const wh = sstep(NECK.y + 140, NECK.y - 45, y);
    if (wh > 0) {
      const r = rotPt(x, y, NECK.x, neckY, p.headRot * wh);
      x = r[0] + p.headTx * wh; y = r[1] + p.headTy * wh;
    }
    x += p.lean * 20 * sstep(FEET_Y - 25, HEAD.y + 40, y);
    return [x, y];
  }

  let isFittingOpen = false;
  let workingSetId = state.savedSet[state.petId];
  let activeWardrobeFilter = "all";
  let petPos = { x: CORK_HOME.x, y: CORK_HOME.y };
  let hopMove = null;
  const spring = { r: 0, vr: 0, y: 0, vy: 0, t: -1 };
  let animMode = "idle", modeT0 = performance.now(), idleT0 = modeT0, nextBlink = 2400;
  let lastPose = P({}), blendFrom = null, blendUntil = 0, petLean = 0;
  let activeEmote = { kind: null, alpha: 0, until: 0 };

  const JUMP_KF = [
    { o: 0, sx: 1, sy: 1, hopY: 0, shS: 1, shO: 1, e: "out" },
    { o: 0.18, sx: 1.09, sy: 0.90, hopY: 6, earL: -6, earR: 6, shS: 1.08, shO: 1.05, e: "out" },
    { o: 0.48, sx: 0.94, sy: 1.07, hopY: -135, wClosed: 0.95, earL: 8, earR: -8, shS: 0.72, shO: 0.55, e: "io" },
    { o: 0.78, sx: 1.08, sy: 0.92, hopY: 4, wClosed: 0.2, earL: -5, earR: 5, shS: 1.08, shO: 1.05, e: "back" },
    { o: 1, sx: 1, sy: 1, hopY: 0, shS: 1, shO: 1 }
  ];
  const MINIHOP_KF = [
    { o: 0, sx: 1, sy: 1, hopY: 0, e: "out" },
    { o: 0.25, sx: 1.06, sy: 0.94, hopY: 4, e: "out" },
    { o: 0.55, sx: 0.96, sy: 1.04, hopY: -72, wClosed: 0.85, shS: 0.82, shO: 0.7, e: "io" },
    { o: 0.82, sx: 1.04, sy: 0.96, hopY: 2, e: "back" },
    { o: 1, sx: 1, sy: 1, hopY: 0 }
  ];
  const TILT_KF = [
    { o: 0, headRot: 0, e: "out" },
    { o: 0.30, headRot: 9.5, headTx: 12, earL: 5, earR: 10, wClosed: 0.9, e: "io" },
    { o: 0.72, headRot: 8.0, headTx: 10, earL: 4, earR: 8, wClosed: 0, e: "io" },
    { o: 1, headRot: 0 }
  ];

  function startAnim(mode, now) {
    blendFrom = Object.assign({}, lastPose);
    blendUntil = now + 130;
    animMode = mode;
    modeT0 = now;
  }

  function triggerEmote(kind, durationMs) {
    activeEmote = { kind, alpha: 1, until: performance.now() + (durationMs || 2000) };
  }

  function envTintForPeriod(pd, forceNeutral) {
    if (forceNeutral || pd === "day") return [1.0, 1.0, 1.0];
    if (pd === "sunset") return [1.02, 0.95, 0.88];
    return [0.84, 0.88, 0.97];
  }

  function deskDepthScale(y) {
    return isFittingOpen ? 1.0 : lerp(0.88, 1.05, clamp((y - 1020) / 360, 0, 1));
  }

  function isWebGLActive() {
    return isFittingOpen || state.roomState === "free_stand";
  }

  function computePose(now) {
    if (hopMove) {
      const u = clamp((now - hopMove.t0) / hopMove.dur, 0, 1);
      petPos.x = lerp(hopMove.x0, hopMove.x1, easeInOut(u));
      petPos.y = lerp(hopMove.y0, hopMove.y1, easeInOut(u));
      const arc = Math.sin(u * Math.PI);
      const p = P({
        hopY: -arc * 108,
        sx: lerp(1.04, 0.95, arc),
        sy: lerp(0.96, 1.05, arc),
        rot: clamp((hopMove.x1 - hopMove.x0) * 0.018, -5, 5) * arc,
        shS: lerp(1, 0.75, arc),
        shO: lerp(1, 0.58, arc)
      });
      if (u >= 1) {
        hopMove = null;
        startAnim("idle", now);
      }
      return p;
    }

    if (animMode === "jump") {
      const u = (now - modeT0) / 680;
      if (u >= 1) startAnim("idle", now);
      else return kfPose(JUMP_KF, u);
    } else if (animMode === "minihop") {
      const u = (now - modeT0) / 520;
      if (u >= 1) startAnim("idle", now);
      else return kfPose(MINIHOP_KF, u);
    } else if (animMode === "tilt") {
      const u = (now - modeT0) / 920;
      if (u >= 1) startAnim("idle", now);
      else return kfPose(TILT_KF, u);
    } else if (animMode === "pet") {
      return P({ sy: 0.965, sx: 1.03, wClosed: 0.95, lean: petLean, headRot: petLean * 6, earL: -4, earR: 4 });
    }

    const t = (now - idleT0) / 1000;
    let wClosed = 0;
    if (now - idleT0 > nextBlink) {
      const bu = (now - idleT0 - nextBlink) / 170;
      if (bu <= 1) wClosed = Math.sin(bu * Math.PI);
      else nextBlink = (now - idleT0) + 2400 + Math.random() * 2600;
    }
    return P({
      breath: Math.sin(t * 2.1) * 0.018,
      sy: 1 + Math.sin(t * 2.1) * 0.008,
      headRot: Math.sin(t * 1.1) * 1.3,
      earL: Math.sin(t * 1.7) * 1.4,
      earR: -Math.sin(t * 1.7 + 0.5) * 1.4,
      wClosed
    });
  }

  function renderPetFrame(rt, p, setId, clock, customAnchor) {
    if (!rt) return;
    lastPose = p;
    const dt = spring.t < 0 ? 0 : (clock - spring.t) / 1000;
    spring.t = clock;
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
    const lagR = clamp(spring.r - p.headRot, -22, 22);
    const lagY = clamp((spring.y - p.hopY) * 0.5, -18, 26);
    const eL = p.earL + lagR * 1.05 - lagY * 0.35;
    const eR = p.earR + lagR * 1.05 + lagY * 0.35;
    const cr = Math.cos((p.rot * Math.PI) / 180), sr = Math.sin((p.rot * Math.PI) / 180);

    for (let i = 0; i < NV; i++) {
      const d = deformVertex(cfg, rt.rest[i * 2], rt.rest[i * 2 + 1], p, eL, eR);
      const dx = d[0] - cfg.cx, dy = d[1] - cfg.feetY;
      rt.pos[i * 2] = OX + (cfg.cx + dx * cr - dy * sr) * S;
      rt.pos[i * 2 + 1] = OY + (cfg.feetY + dx * sr + dy * cr) * S + p.hopY;
    }

    const tint = envTintForPeriod(state.period, !!customAnchor);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(prog);
    gl.uniform3f(loc.uEnvTint, tint[0], tint[1], tint[2]);

    const setPack = (setId && rt.setTexMap[setId]) || rt.defaultTex;
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, setPack.base); gl.uniform1i(loc.t0, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, setPack.closed); gl.uniform1i(loc.t1, 1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, setId ? rt.defaultTex.base : setPack.doze); gl.uniform1i(loc.t2, 2);

    const hasShaderEyes = !!(setId && setPack.eyeLUV && setPack.eyeRUV);
    gl.uniform1f(loc.uEye, hasShaderEyes ? 1.0 : 0.0);
    if (hasShaderEyes) {
      const happyAmt = (!customAnchor && (activeEmote.kind === "laugh" || activeEmote.kind === "cute") && performance.now() < activeEmote.until) ? 1.0 : (customAnchor && customAnchor.happy ? 1.0 : 0.0);
      gl.uniform1f(loc.w1, happyAmt);
      gl.uniform1f(loc.w2, happyAmt > 0.2 ? 0.0 : p.wClosed);
      gl.uniform4f(loc.uEyeL, setPack.eyeLUV[0], setPack.eyeLUV[1], setPack.eyeLUV[2], setPack.eyeLUV[3]);
      gl.uniform4f(loc.uEyeR, setPack.eyeRUV[0], setPack.eyeRUV[1], setPack.eyeRUV[2], setPack.eyeRUV[3]);
    } else {
      gl.uniform1f(loc.w1, p.wClosed);
      gl.uniform1f(loc.w2, p.wDoze);
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

    // 原生毛绒态面部表情叠层
    const emKind = customAnchor ? customAnchor.emote : (performance.now() < activeEmote.until ? activeEmote.kind : null);
    if (!setId && emKind) {
      const fg = rt.faceGrid;
      for (let i = 0; i < fg.nv; i++) {
        const d = deformVertex(cfg, fg.rest[i * 2], fg.rest[i * 2 + 1], p, eL, eR);
        const dx = d[0] - cfg.cx, dy = d[1] - cfg.feetY;
        fg.pos[i * 2] = OX + (cfg.cx + dx * cr - dy * sr) * S;
        fg.pos[i * 2 + 1] = OY + (cfg.feetY + dx * sr + dy * cr) * S + p.hopY;
      }
      gl.useProgram(progF);
      gl.uniform3f(locF.uEnvTint, tint[0], tint[1], tint[2]);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, paintFaceOverlay(rt, emKind));
      gl.uniform1i(locF.tF, 0);
      gl.uniform1f(locF.uA, 1.0);
      gl.bindBuffer(gl.ARRAY_BUFFER, fg.posBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, fg.pos);
      gl.enableVertexAttribArray(locF.aPos);
      gl.vertexAttribPointer(locF.aPos, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, fg.uvBuf);
      gl.enableVertexAttribArray(locF.aUv);
      gl.vertexAttribPointer(locF.aUv, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, fg.idxBuf);
      gl.drawElements(gl.TRIANGLES, fg.idxLen, gl.UNSIGNED_SHORT, 0);
    }

    if (!customAnchor) {
      const baseW = (rt.id === "yutu" ? 310 : 340) * deskDepthScale(petPos.y);
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
        let p = computePose(now);
        if (blendFrom && now < blendUntil) {
          p = mixPose(blendFrom, p, 1 - (blendUntil - now) / 130);
        }
        const setId = isFittingOpen ? workingSetId : state.savedSet[state.petId];
        renderPetFrame(rt, p, setId, now, null);
      }
    }
    requestAnimationFrame(mainLoop);
  }

  /* ---------- 12. 场景道具、热区与物理避障桌面交互 ---------- */
  function layoutScenePropsAndHotspots() {
    // 1. 墙面拍立得（植物画框左下方空白墙面）
    panoToBoxStyle(wallPolaroidEl, 985, 290, 148, 175);

    // 2. 桌面微距原木小立镜（仅在 free_stand 展示在软木垫左后方桌面）
    const showMirror = !isFittingOpen && state.roomState === "free_stand";
    deskMirrorPropEl.hidden = !showMirror;
    if (showMirror) panoToBoxStyle(deskMirrorPropEl, 1192, 884, 182, 182);

    // 3. 脱下的叠放针织衣物包裹（仅在 8 种居家动作态且穿有套装时展示，外出态隐藏）
    const def = ROOM_STATES[state.roomState];
    const hasEquipped = !!state.savedSet[state.petId];
    const showFolded = !isFittingOpen && def && def.track === "baked" && hasEquipped;
    foldedOutfitPropEl.hidden = !showFolded;
    if (showFolded) {
      if (def.screen === 0) {
        // 睡觉/小憩时叠放在右屏圆边几或床顶右侧
        panoToBoxStyle(foldedOutfitPropEl, 412, 462, 168, 168);
      } else {
        // 中/右屏活动时叠放在床顶台灯左侧木板
        panoToBoxStyle(foldedOutfitPropEl, 412, 462, 168, 168);
      }
    }

    // 4. 居家动作全景角色热区与呼吸微光点
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
  }

  deskMirrorPropEl.addEventListener("click", (ev) => {
    ev.stopPropagation();
    sfx.tap();
    enterFittingRoom();
  });

  foldedOutfitPropEl.addEventListener("click", (ev) => {
    ev.stopPropagation();
    sfx.tap();
    const name = getSetName(state.petId, state.savedSet[state.petId]) || "新衣服";
    showSceneFeedback(`脱下来的「${name}」叠好放在床头啦`, "system");
  });

  charHotspotEl.addEventListener("click", (ev) => {
    ev.stopPropagation();
    sfx.tap();
    const def = ROOM_STATES[state.roomState];
    if (def) showSceneFeedback(def.line, "dialogue");
  });

  actionGlowEl.addEventListener("click", (ev) => {
    ev.stopPropagation();
    const def = ROOM_STATES[state.roomState];
    if (!def) return;
    const actKey = `${state.petId}:${state.roomState}`;
    state.actedStates[actKey] = true;
    actionGlowEl.hidden = true;
    sfx.star();

    let msg = def.actionFeedback;
    if (def.keepsakeId && !state.keepsakes.includes(def.keepsakeId)) {
      state.keepsakes.unshift(def.keepsakeId);
      tbAlbumDotEl.hidden = false;
      const ks = KEPSAKE_DEFS[def.keepsakeId];
      if (ks) showSceneFeedback(`纪念册收进了「${ks.name}」`, "system", "neutral", 2400);
    }
    animateStarsTo(state.stars + 3, 3);
    if (msg) showSceneFeedback(msg, "dialogue", "neutral", 2600);
  });

  // WebGL 桌面点击互动（点头歪头、点身大跳、横滑摸头、点空地跳跃避障）
  let petDrag = null;
  let lastPetRewardAt = 0;

  function clientToPano(clientX, clientY) {
    const rect = panoBoxEl.getBoundingClientRect();
    if (!rect.width || !rect.height) return { x: CORK_HOME.x, y: CORK_HOME.y };
    return {
      x: ((clientX - rect.left) / rect.width) * PANO_W,
      y: ((clientY - rect.top) / rect.height) * PANO_H
    };
  }

  function clampSafeDeskTarget(px, py) {
    // 避开左床盒 (x<1165)、咖啡杯圆心 (1815, 1095, r=195) 与前景卷笔刀
    let x = clamp(px, 1185, 2120);
    let y = clamp(py, 1035, 1430);
    const dx = x - 1815, dy = y - 1095;
    const dist = Math.hypot(dx, dy);
    if (dist < 205) {
      const ang = Math.atan2(dy || 1, dx || -1);
      x = clamp(1815 + Math.cos(ang) * 210, 1185, 2120);
      y = clamp(1095 + Math.sin(ang) * 210, 1035, 1430);
    }
    if (x < 1230 && y > 1300) x = 1245;
    return { x, y };
  }

  hitLayerEl.addEventListener("pointerdown", (ev) => {
    if (!isWebGLActive()) return;
    const pt = clientToPano(ev.clientX, ev.clientY);
    const rt = petRuntimes[state.petId];
    if (!rt) return;
    const S = rt.cfg.baseScale * deskDepthScale(petPos.y);
    const topY = petPos.y - rt.cfg.feetY * S;
    const halfW = 240 * S;
    if (Math.abs(pt.x - petPos.x) <= halfW && pt.y >= topY && pt.y <= petPos.y + 30) {
      petDrag = { x0: ev.clientX, y0: ev.clientY, pt0: pt, petting: false };
    }
  });

  window.addEventListener("pointermove", (ev) => {
    if (!petDrag || !isWebGLActive()) return;
    const dx = ev.clientX - petDrag.x0;
    if (Math.abs(dx) > 14) {
      if (!petDrag.petting) {
        petDrag.petting = true;
        startAnim("pet", performance.now());
      }
      petLean = clamp(dx / 55, -1, 1);
      const now = Date.now();
      if (now - lastPetRewardAt > 8000) {
        lastPetRewardAt = now;
        sfx.star();
        animateStarsTo(state.stars + 2, 2);
        const lines = EMOTE_LINES[state.petId].cute;
        showSceneFeedback(lines[Math.floor(Math.random() * lines.length)], "dialogue");
      }
    }
  });

  window.addEventListener("pointerup", (ev) => {
    if (petDrag) {
      const wasPetting = petDrag.petting;
      const pt = petDrag.pt0;
      petDrag = null;
      petLean = 0;
      if (wasPetting) {
        startAnim("idle", performance.now());
        return;
      }
      const rt = petRuntimes[state.petId];
      if (rt) {
        const S = rt.cfg.baseScale * deskDepthScale(petPos.y);
        const neckPanoY = petPos.y - (rt.cfg.feetY - rt.cfg.neck.y) * S;
        if (pt.y < neckPanoY) {
          sfx.tap();
          startAnim("tilt", performance.now());
          const kinds = ["laugh", "think", "cute"];
          const k = kinds[Math.floor(Math.random() * kinds.length)];
          triggerEmote(k, 1900);
          const pool = EMOTE_LINES[state.petId][k];
          showSceneFeedback(pool[Math.floor(Math.random() * pool.length)], "dialogue");
        } else {
          sfx.hop();
          startAnim("jump", performance.now());
          triggerEmote("laugh", 1700);
        }
      }
      return;
    }
  });

  hitLayerEl.addEventListener("click", (ev) => {
    if (mousePan && mousePan.moved) return;
    if (isFittingOpen || state.roomState !== "free_stand") return;
    const pt = clientToPano(ev.clientX, ev.clientY);
    const rt = petRuntimes[state.petId];
    if (rt) {
      const S = rt.cfg.baseScale * deskDepthScale(petPos.y);
      if (Math.abs(pt.x - petPos.x) <= 240 * S && pt.y >= petPos.y - rt.cfg.feetY * S && pt.y <= petPos.y + 30) {
        return; // 由 pointerup 处理角色点击
      }
    }
    if (pt.y < 970) return; // 墙面与窗户不触发跳跃

    const dst = clampSafeDeskTarget(pt.x, pt.y);
    sfx.hop();
    const rip = document.createElement("span");
    rip.className = "desk-ripple";
    panoToBoxStyle(rip, dst.x, dst.y);
    panoBoxEl.appendChild(rip);
    setTimeout(() => rip.remove(), 600);

    const dist = Math.hypot(dst.x - petPos.x, dst.y - petPos.y);
    hopMove = {
      x0: petPos.x, y0: petPos.y,
      x1: dst.x, y1: dst.y,
      t0: performance.now(),
      dur: clamp(280 + dist * 0.42, 300, 620)
    };
  });

  /* ---------- 13. 状态切换、左下信封与右下 3D 百宝箱 ---------- */
  function renderContextEntry() {
    const showEnvelope = state.unreadMail || state.roomState === "away";
    btnContextEntryEl.classList.toggle("scene-action-button--flat-envelope", showEnvelope);
    btnContextEntryEl.classList.toggle("scene-action-button--companion-chat", !showEnvelope);
    contextIconEl.classList.toggle("scene-action-icon-image--flat-envelope", showEnvelope);
    contextIconEl.classList.toggle("scene-action-icon-image--companion-chat", !showEnvelope);

    if (showEnvelope) {
      contextIconEl.src = "./ui/envelope.png";
      contextUnreadDotEl.hidden = !state.unreadMail;
      letterPlaneFxEl.hidden = !state.unreadMail;
    } else {
      contextIconEl.src = state.petId === "yutu" ? "./ui/chat_yutu.png" : "./ui/chat_koi.png";
      contextUnreadDotEl.hidden = true;
      letterPlaneFxEl.hidden = true;
    }
  }

  function applyRoomState(nextKey, smoothScroll) {
    if (!ROOM_STATES[nextKey]) return;
    state.roomState = nextKey;
    const def = ROOM_STATES[nextKey];
    appEl.dataset.state = nextKey;
    appEl.classList.toggle("is-baked-action", def.track === "baked");

    if (nextKey === "free_stand") {
      petPos = { x: CORK_HOME.x, y: CORK_HOME.y };
      hopMove = null;
    }
    if (nextKey === "away") {
      state.unreadMail = true;
    }

    syncPanoramaImage(false);
    layoutScenePropsAndHotspots();
    renderContextEntry();
    renderMoodTab();
    updateDevTesterLabels();

    tbDeskToggleLabelEl.textContent = nextKey === "free_stand" ? "日常动作" : "唤回桌面";
    tbSwitchPetLabelEl.textContent = state.petId === "yutu" ? "换锦鲤" : "换玉兔";

    if (def.screen !== undefined) {
      scrollToScreen(def.screen, smoothScroll !== false);
    }
  }

  // 百宝箱开关动效
  let toolboxOpen = false;
  function setToolboxOpen(open) {
    if (toolboxOpen === open) return;
    toolboxOpen = open;
    sfx.tap();
    btnToolboxEl.setAttribute("aria-expanded", String(open));
    toolboxEl.setAttribute("aria-hidden", String(!open));
    actionDockEl.classList.toggle("scene-action-dock--toolbox-open", open);
    toolboxDismissEl.hidden = !open;
    chestClosedEl.classList.toggle("companion-toolbox-button__lid--visible", !open);
    chestOpenEl.classList.toggle("companion-toolbox-button__lid--visible", open);
    triggerRebound(toolboxBtnMotionEl);

    if (open) {
      toolboxEl.className = "companion-toolbox companion-toolbox--opening";
      setTimeout(() => {
        if (toolboxOpen) toolboxEl.className = "companion-toolbox companion-toolbox--open";
      }, 310);
    } else {
      toolboxEl.className = "companion-toolbox companion-toolbox--closing";
      setTimeout(() => {
        if (!toolboxOpen) toolboxEl.className = "companion-toolbox companion-toolbox--closed";
      }, 170);
    }
  }

  btnToolboxEl.addEventListener("click", () => setToolboxOpen(!toolboxOpen));
  toolboxDismissEl.addEventListener("click", () => setToolboxOpen(false));

  $("tb-btn-album").addEventListener("click", () => {
    setToolboxOpen(false);
    tbAlbumDotEl.hidden = true;
    openKeepsakeAlbum("postcards");
  });

  $("tb-btn-desk-toggle").addEventListener("click", () => {
    setToolboxOpen(false);
    if (state.roomState === "free_stand") {
      const cycle = ["drawing", "sleep", "reading", "window", "gaming", "music", "lazy", "stare"];
      const pick = cycle[Math.floor(Math.random() * cycle.length)];
      applyRoomState(pick, true);
      showSceneFeedback(ROOM_STATES[pick].line, "dialogue");
    } else {
      applyRoomState("free_stand", true);
      sfx.hop();
      startAnim("minihop", performance.now());
      showSceneFeedback("回到软木垫上啦，看看我的穿搭吧。", "dialogue");
    }
  });

  $("tb-btn-switch-pet").addEventListener("click", async () => {
    setToolboxOpen(false);
    const nextPet = state.petId === "yutu" ? "koi" : "yutu";
    await switchPet(nextPet);
    showSceneFeedback(nextPet === "yutu" ? "已切换伙伴：糯米团子" : "已切换伙伴：锦小鲤", "system");
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

  async function switchPet(nextPet) {
    state.petId = nextPet;
    workingSetId = state.savedSet[nextPet];
    await initPet(nextPet);
    if (workingSetId) await ensureSetLoaded(petRuntimes[nextPet], workingSetId);
    syncPanoramaImage(false);
    layoutScenePropsAndHotspots();
    renderMoodTab();
    renderContextEntry();
    updateDevTesterLabels();
    document.querySelectorAll("[data-fit-pet]").forEach((b) => b.classList.toggle("is-active", b.dataset.fitPet === nextPet));
    if (isFittingOpen) {
      renderWardrobeGrid();
      applyFittingCameraTransform();
    }
    persistState();
  }

  /* ---------- 14. 专属试衣间（同场景推镜 + 全身零遮挡安全框 + 先试后买） ---------- */
  let preFittingState = "free_stand";

  function applyFittingCameraTransform() {
    if (!isFittingOpen) {
      cameraRigEl.style.transform = "none";
      return;
    }
    scrollToPanoX(CORK_HOME.x, false);
    const rt = petRuntimes[state.petId];
    const petPanoH = rt ? (rt.cfg.feetY * rt.cfg.baseScale * 0.92) : 520;
    const petScreenH = petPanoH * geom.panoScale;

    const topClearY = 58;
    const sheetTopY = geom.vh * 0.59;
    const availH = Math.max(180, sheetTopY - topClearY);
    const z = clamp((availH - 28) / Math.max(petScreenH, 1), 1.05, 1.32);

    const petMidPanoY = CORK_HOME.y - petPanoH * 0.50;
    const curMidScreenY = geom.oy + petMidPanoY * geom.panoScale;
    const targetMidY = topClearY + availH * 0.53;
    const ty = targetMidY - curMidScreenY;

    const originX = geom.ox + CORK_HOME.x * geom.panoScale;
    cameraRigEl.style.transformOrigin = `${originX.toFixed(1)}px ${curMidScreenY.toFixed(1)}px`;
    cameraRigEl.style.transform = `translate3d(0px, ${ty.toFixed(1)}px, 0) scale(${z.toFixed(3)})`;
  }

  async function enterFittingRoom() {
    if (isFittingOpen) return;
    setToolboxOpen(false);
    preFittingState = state.roomState === "fitting" ? "free_stand" : state.roomState;
    isFittingOpen = true;
    workingSetId = state.savedSet[state.petId];
    petPos = { x: CORK_HOME.x, y: CORK_HOME.y };
    hopMove = null;

    await initPet(state.petId);
    appEl.classList.add("is-fitting");
    appEl.classList.remove("is-baked-action");
    fittingTopbarEl.setAttribute("aria-hidden", "false");
    wardrobeSheetEl.setAttribute("aria-hidden", "false");

    syncPanoramaImage(false);
    layoutScenePropsAndHotspots();
    applyFittingCameraTransform();
    renderWardrobeGrid();
    sfx.hop();
    startAnim("minihop", performance.now());
  }

  function exitFittingRoom(restoreSaved) {
    if (!isFittingOpen) return;
    const hadUnownedPreview = workingSetId && !state.owned[state.petId].includes(workingSetId);
    if (restoreSaved) {
      workingSetId = state.savedSet[state.petId];
    }
    isFittingOpen = false;
    appEl.classList.remove("is-fitting");
    fittingTopbarEl.setAttribute("aria-hidden", "true");
    wardrobeSheetEl.setAttribute("aria-hidden", "true");
    cameraRigEl.style.transform = "none";

    const backState = restoreSaved ? (preFittingState === "away" ? "free_stand" : preFittingState) : "free_stand";
    applyRoomState(backState, true);

    if (restoreSaved && hadUnownedPreview) {
      showSceneFeedback("已退出试穿，恢复原穿搭", "system");
    }
  }

  btnOpenFittingEl.addEventListener("click", () => {
    sfx.tap();
    triggerRebound(btnOpenFittingEl);
    enterFittingRoom();
  });
  $("btn-exit-fitting").addEventListener("click", () => {
    sfx.tap();
    exitFittingRoom(true);
  });
  $("sheet-grabber").addEventListener("click", () => {
    sfx.tap();
    exitFittingRoom(true);
  });

  document.querySelectorAll("[data-fit-pet]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      sfx.tap();
      await switchPet(btn.dataset.fitPet);
      startAnim("minihop", performance.now());
    });
  });

  document.querySelectorAll(".wardrobe-filter").forEach((btn) => {
    btn.addEventListener("click", () => {
      sfx.tap();
      activeWardrobeFilter = btn.dataset.filter;
      document.querySelectorAll(".wardrobe-filter").forEach((b) => b.classList.toggle("is-active", b === btn));
      renderWardrobeGrid();
    });
  });

  function renderWardrobeGrid() {
    if (!catalog) return;
    const pCfg = catalog.pets[state.petId];
    const ownedList = state.owned[state.petId] || [];
    wardrobeGridEl.innerHTML = "";

    // 原生毛绒卡片
    if (activeWardrobeFilter !== "locked") {
      const bareCard = document.createElement("button");
      bareCard.type = "button";
      bareCard.className = "outfit-card" + (!workingSetId ? " is-selected" : "");
      bareCard.innerHTML =
        `<span class="outfit-card__plush-dot">原生毛绒</span>` +
        `<span class="outfit-card__name">不穿外套</span>` +
        (!workingSetId ? `<span class="outfit-card__check">✓</span>` : "");
      bareCard.addEventListener("click", () => {
        sfx.tap();
        workingSetId = null;
        startAnim("tilt", performance.now());
        renderWardrobeGrid();
      });
      wardrobeGridEl.appendChild(bareCard);
    }

    pCfg.items.forEach((item, idx) => {
      const isOwned = ownedList.includes(item.id);
      if (activeWardrobeFilter === "owned" && !isOwned) return;
      if (activeWardrobeFilter === "locked" && isOwned) return;

      const price = setPriceFor(item, idx);
      const selected = workingSetId === item.id;
      const card = document.createElement("button");
      card.type = "button";
      card.className = "outfit-card" + (selected ? " is-selected" : "");
      card.innerHTML =
        (!isOwned ? `<span class="outfit-card__price"><img src="./ui/star_neutral.png" alt="" />${price}</span>` : "") +
        (selected ? `<span class="outfit-card__check">✓</span>` : "") +
        `<img class="outfit-card__thumb" src="${sharedUrl(item.thumb)}" alt="${item.name}" loading="lazy" />` +
        `<span class="outfit-card__name">${item.name}</span>`;

      card.addEventListener("click", async () => {
        sfx.tap();
        if (workingSetId === item.id && isOwned) {
          workingSetId = null;
        } else {
          workingSetId = item.id;
          const rt = petRuntimes[state.petId];
          await ensureSetLoaded(rt, item.id);
          sfx.hop();
          startAnim("minihop", performance.now());
          triggerEmote("cute", 1800);
          if (!isOwned) {
            showSceneFeedback(`正在试穿「${item.name}」，喜欢就帮我留下来吧。`, "dialogue");
          }
        }
        renderWardrobeGrid();
      });
      wardrobeGridEl.appendChild(card);
    });

    updateWardrobeFooter(pCfg, ownedList);
  }

  function updateWardrobeFooter(pCfg, ownedList) {
    const isOwned = !workingSetId || ownedList.includes(workingSetId);
    if (isOwned) {
      btnRevertOutfitEl.hidden = true;
      btnConfirmOutfitEl.disabled = false;
      confirmOutfitTextEl.textContent = "穿好啦";
      return;
    }
    const idx = pCfg.items.findIndex((x) => x.id === workingSetId);
    const item = pCfg.items[idx];
    const price = setPriceFor(item, idx);
    btnRevertOutfitEl.hidden = false;

    if (state.stars >= price) {
      btnConfirmOutfitEl.disabled = false;
      confirmOutfitTextEl.textContent = `用 ★ ${price} 解锁并换上`;
    } else {
      btnConfirmOutfitEl.disabled = true;
      confirmOutfitTextEl.textContent = `还差 ★ ${price - state.stars}（拆来信可得）`;
    }
  }

  btnRevertOutfitEl.addEventListener("click", () => {
    sfx.tap();
    workingSetId = state.savedSet[state.petId];
    renderWardrobeGrid();
    showSceneFeedback("已还原为原来的穿搭", "system");
  });

  btnConfirmOutfitEl.addEventListener("click", () => {
    const pCfg = catalog.pets[state.petId];
    const ownedList = state.owned[state.petId];
    const isOwned = !workingSetId || ownedList.includes(workingSetId);

    if (!isOwned) {
      const idx = pCfg.items.findIndex((x) => x.id === workingSetId);
      const item = pCfg.items[idx];
      const price = setPriceFor(item, idx);
      if (state.stars < price) return;
      ownedList.push(workingSetId);
      state.savedSet[state.petId] = workingSetId;
      sfx.unlock();
      animateStarsTo(state.stars - price, 0);
      exitFittingRoom(false);
      startAnim("jump", performance.now());
      triggerEmote("cute", 2200);
      showSceneFeedback(`已解锁并换上「${item.name}」`, "system");
    } else {
      state.savedSet[state.petId] = workingSetId;
      persistState();
      sfx.tap();
      exitFittingRoom(false);
      startAnim("minihop", performance.now());
      const outfitName = getSetName(state.petId, workingSetId);
      showSceneFeedback(outfitName ? `已换上「${outfitName}」` : "已恢复原生毛绒造型", "system");
    }
  });

  $("btn-snap-lookbook").addEventListener("click", async () => {
    sfx.tap();
    // 若试穿的是已拥有套装，先同步为当前定妆；若未拥有则按已拥有正式穿搭拍摄
    const ownedList = state.owned[state.petId];
    if (!workingSetId || ownedList.includes(workingSetId)) {
      state.savedSet[state.petId] = workingSetId;
      persistState();
    }
    exitFittingRoom(true);
    await openLetterOverlay("studio_desk", false);
  });

  /* ---------- 15. 零 Token 带妆插画拍立得合成 + 红线折角信笺 ---------- */
  const imgObjCache = new Map();
  function loadHtmlImg(src) {
    if (imgObjCache.has(src)) return Promise.resolve(imgObjCache.get(src));
    return new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => { imgObjCache.set(src, im); resolve(im); };
      im.onerror = reject;
      im.src = src;
    });
  }

  const postcardArtCache = new Map();

  // 生成纯净 800×920 画心（严禁在画心内绘制任何文字框！）
  async function composeCleanIllustrationUrl(petId, setId, sceneId) {
    const cacheKey = `${petId}|${setId || "bare"}|${sceneId}`;
    if (postcardArtCache.has(cacheKey)) return postcardArtCache.get(cacheKey);

    const sc = POSTCARD_SCENES.find((s) => s.id === sceneId) || POSTCARD_SCENES[0];
    const rt = await initPet(petId);
    if (setId) await ensureSetLoaded(rt, setId);
    const bgImg = await loadHtmlImg(sc.src);

    const W = 800, H = 920;
    const out = document.createElement("canvas");
    out.width = W; out.height = H;
    const ctx = out.getContext("2d");

    // 1. 远景插画底图 cover 裁切
    const bScale = Math.max(W / bgImg.width, H / bgImg.height);
    const bw = bgImg.width * bScale, bh = bgImg.height * bScale;
    const bx = sc.cropCenter ? -(bw - W) * 0.49 : (W - bw) / 2;
    const by = (H - bh) / 2;
    ctx.drawImage(bgImg, bx, by, bw, bh);

    // 2. 地面双层径向接触软阴影
    const footY = H * sc.anchorY;
    const gSoft = ctx.createRadialGradient(W * 0.5, footY + 6, 8, W * 0.5, footY + 6, 155);
    gSoft.addColorStop(0, sc.shadowRgba || "rgba(48,32,20,0.30)");
    gSoft.addColorStop(1, "rgba(0,0,0,0)");
    ctx.save();
    ctx.translate(W * 0.5, footY + 6);
    ctx.scale(1, 0.30);
    ctx.translate(-W * 0.5, -(footY + 6));
    ctx.fillStyle = gSoft;
    ctx.beginPath();
    ctx.arc(W * 0.5, footY + 6, 155, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 3. 离屏 WebGL 确定性姿态快照（重置弹簧确保 100% 踩实地面）
    spring.t = -1;
    let snapPose = P({ headRot: 5.5, earL: 3, earR: 6 });
    let happy = false;
    let emote = null;
    if (sc.pose === "cute") { snapPose = P({ headRot: -4, sy: 0.98, sx: 1.02 }); happy = true; emote = "cute"; }
    else if (sc.pose === "jump") { snapPose = P({ hopY: -36, sy: 1.03, sx: 0.97, earL: 6, earR: -6 }); happy = true; emote = "laugh"; }

    renderPetFrame(rt, snapPose, setId, performance.now(), {
      x: PANO_W * 0.5,
      y: PANO_H * 0.84,
      scaleK: sc.scaleK,
      happy,
      emote
    });

    // 4. 叠入角色并施加 source-atop 场景环境光柔光层
    const petLayer = document.createElement("canvas");
    petLayer.width = W; petLayer.height = H;
    const pCtx = petLayer.getContext("2d");
    const cropH = glCanvas.height;
    const cropW = Math.round(cropH * (W / H));
    const cropX = Math.round((glCanvas.width - cropW) / 2);
    pCtx.drawImage(glCanvas, cropX, 0, cropW, cropH, 0, Math.round(H * (sc.anchorY - 0.84)), W, H);

    pCtx.globalCompositeOperation = "source-atop";
    pCtx.fillStyle = sc.tint;
    pCtx.fillRect(0, 0, W, H);

    ctx.drawImage(petLayer, 0, 0);

    const url = out.toDataURL("image/jpeg", 0.90);
    postcardArtCache.set(cacheKey, url);
    return url;
  }

  // 导出带完整 #FFFDF8 拍立得白框、穿搭签名与手记的分享长图 JPG
  async function exportFullPolaroidCardJpg(meta) {
    const artUrl = await composeCleanIllustrationUrl(meta.petId, meta.setId, meta.sceneId);
    const artImg = await loadHtmlImg(artUrl);
    const sc = POSTCARD_SCENES.find((s) => s.id === meta.sceneId) || POSTCARD_SCENES[0];
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
        line = ch;
        y += 36;
      } else {
        line += ch;
      }
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

  function renderPostcardScenePills(selectedId) {
    postcardScenePillsEl.innerHTML = "";
    POSTCARD_SCENES.forEach((sc) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "postcard-scene-pill" + (sc.id === selectedId ? " is-active" : "");
      b.textContent = sc.label;
      b.addEventListener("click", async () => {
        sfx.tap();
        await updateLetterScene(sc.id);
      });
      postcardScenePillsEl.appendChild(b);
    });
  }

  async function updateLetterScene(sceneId) {
    const sc = POSTCARD_SCENES.find((s) => s.id === sceneId) || POSTCARD_SCENES[0];
    const petId = state.petId;
    const setId = state.savedSet[petId];
    const outfitName = getSetName(petId, setId) || "原生毛绒";
    const now = new Date();
    const dateText = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}`;

    activeLetterMeta = {
      id: `pc_${Date.now()}`,
      sceneId: sc.id,
      petId,
      setId,
      dateText,
      createdAt: Date.now()
    };

    renderPostcardScenePills(sc.id);
    letterTitleEl.textContent = `寄自 · ${sc.label}`;
    letterLineEl.textContent = `“${sc.copy[petId]}”`;
    polaroidPlaceEl.textContent = sc.label;
    polaroidOutfitEl.textContent = `身穿 · ${outfitName}`;

    const artUrl = await composeCleanIllustrationUrl(petId, setId, sc.id);
    letterPolaroidImgEl.src = artUrl;
  }

  async function openLetterOverlay(defaultSceneId, awardUnreadStars) {
    letterGivesStar = !!awardUnreadStars;
    letterAwardBoxEl.hidden = !letterGivesStar;
    if (letterGivesStar) {
      letterAwardPlusEl.textContent = "+8";
      sfx.star();
    }
    collectLetterTextEl.textContent = "收下";
    letterOverlayEl.hidden = false;
    await updateLetterScene(defaultSceneId || POSTCARD_SCENES[0].id);
  }

  btnContextEntryEl.addEventListener("click", async () => {
    sfx.tap();
    triggerRebound(btnContextEntryEl);
    if (state.unreadMail || state.roomState === "away") {
      await openLetterOverlay(POSTCARD_SCENES[0].id, state.unreadMail);
    } else {
      const lines = [
        "今天也想穿好看的衣服去拍一张新的拍立得给你。",
        "点右下衣架可以帮我试新衣，或者去百宝箱翻翻纪念册吧。"
      ];
      showSceneFeedback(lines[Math.floor(Math.random() * lines.length)], "dialogue");
    }
  });

  $("btn-close-letter").addEventListener("click", () => {
    sfx.tap();
    letterOverlayEl.hidden = true;
  });

  $("btn-download-polaroid").addEventListener("click", async () => {
    if (!activeLetterMeta) return;
    sfx.tap();
    await exportFullPolaroidCardJpg(activeLetterMeta);
    showSceneFeedback("相片已导出保存", "system");
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
    wallPolaroidEl.hidden = false;

    letterOverlayEl.hidden = true;
    if (state.roomState === "away") {
      applyRoomState("free_stand", true);
    } else {
      renderContextEntry();
    }

    if (letterGivesStar) {
      animateStarsTo(state.stars + 8, 8);
    } else {
      persistState();
    }
    showSceneFeedback("明信片已收进纪念册，并挂上了房间白墙", "system");
  });

  wallPolaroidEl.addEventListener("click", (ev) => {
    ev.stopPropagation();
    sfx.tap();
    if (state.postcards.length > 0) {
      openDetailView("postcard", state.postcards[0]);
    }
  });

  /* ---------- 16. 全屏 #FAFAF8 纪念册与详情页（复刻 keepsake-album） ---------- */
  let currentAlbumTab = "postcards";
  let activeDetailPostcard = null;

  async function renderAlbumGrid() {
    document.querySelectorAll("[data-album-tab]").forEach((t) => {
      t.classList.toggle("keepsake-tab--active", t.dataset.albumTab === currentAlbumTab);
    });
    keepsakeGridEl.innerHTML = "";

    if (currentAlbumTab === "keepsakes") {
      const list = state.keepsakes.map((id) => KEPSAKE_DEFS[id]).filter(Boolean);
      keepsakeEmptyEl.hidden = list.length > 0;
      list.forEach((ks) => {
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "keepsake-cell keepsake-cell--keepsake";
        cell.innerHTML = `<div class="keepsake-cell__media"><img src="${ks.img}" alt="${ks.name}" /></div><div class="keepsake-cell__label">${ks.name}</div>`;
        cell.addEventListener("click", () => {
          sfx.tap();
          openDetailView("keepsake", ks);
        });
        keepsakeGridEl.appendChild(cell);
      });
    } else {
      const list = state.postcards;
      keepsakeEmptyEl.hidden = list.length > 0;
      for (const pc of list) {
        const sc = POSTCARD_SCENES.find((s) => s.id === pc.sceneId) || POSTCARD_SCENES[0];
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "keepsake-cell keepsake-cell--postcard";
        cell.innerHTML = `<div class="keepsake-cell__media"><img alt="${sc.label}" /></div><div class="keepsake-cell__label">${sc.label}</div>`;
        composeCleanIllustrationUrl(pc.petId, pc.setId, pc.sceneId).then((url) => {
          const im = cell.querySelector("img");
          if (im) im.src = url;
        });
        cell.addEventListener("click", () => {
          sfx.tap();
          openDetailView("postcard", pc);
        });
        keepsakeGridEl.appendChild(cell);
      }
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
      const sc = POSTCARD_SCENES.find((s) => s.id === item.sceneId) || POSTCARD_SCENES[0];
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

  document.querySelectorAll("[data-album-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      sfx.tap();
      currentAlbumTab = btn.dataset.albumTab;
      renderAlbumGrid();
    });
  });

  $("btn-close-album").addEventListener("click", () => {
    sfx.tap();
    albumViewEl.hidden = true;
  });

  $("btn-close-detail").addEventListener("click", () => {
    sfx.tap();
    detailViewEl.hidden = true;
  });

  $("btn-detail-download").addEventListener("click", async () => {
    if (!activeDetailPostcard) return;
    sfx.tap();
    await exportFullPolaroidCardJpg(activeDetailPostcard);
    showSceneFeedback("高清拍立得已保存", "system");
  });

  /* ---------- 17. 右上 DEV-ONLY 验收工具菜单绑定 ---------- */
  function buildDevTesterMenus() {
    const periodOpts = [
      { key: "day", label: "白天" },
      { key: "sunset", label: "落日" },
      { key: "night", label: "黑夜" }
    ];
    const menuPeriod = $("menu-period");
    menuPeriod.innerHTML = "";
    periodOpts.forEach((o) => {
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
        applyRoomState(st.key, true);
        closeAllTesterMenus();
        buildDevTesterMenus();
      });
      menuState.appendChild(b);
    });

    const menuPet = $("menu-pet");
    menuPet.innerHTML = "";
    [{ key: "yutu", label: "玉兔" }, { key: "koi", label: "锦鲤" }].forEach((p) => {
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

    const menuMood = $("menu-mood");
    menuMood.innerHTML = "";
    Object.values(DAILY_MOODS).forEach((m) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "tester-option" + (state.moodKey === m.key ? " tester-option--active" : "");
      b.innerHTML = `<span>${m.icon} ${m.label}</span><span>${state.moodKey === m.key ? "✓" : ""}</span>`;
      b.addEventListener("click", () => {
        state.moodKey = m.key;
        renderMoodTab();
        closeAllTesterMenus();
        buildDevTesterMenus();
      });
      menuMood.appendChild(b);
    });
    updateDevTesterLabels();
  }

  function updateDevTesterLabels() {
    const pMap = { day: "白天", sunset: "落日", night: "黑夜" };
    $("tester-period-label").textContent = pMap[state.period] || "白天";
    $("tester-state-label").textContent = (ROOM_STATES[state.roomState] || ROOM_STATES.free_stand).label;
    $("tester-pet-label").textContent = state.petId === "yutu" ? "玉兔" : "锦鲤";
    const m = DAILY_MOODS[state.moodKey] || DAILY_MOODS.CURIOSITY;
    $("tester-mood-label").textContent = `${m.icon} ${m.label}`;
  }

  function closeAllTesterMenus() {
    ["menu-period", "menu-state", "menu-pet", "menu-mood"].forEach((id) => { $(id).hidden = true; });
  }

  btnAcceptanceToggleEl.addEventListener("click", () => {
    const open = acceptanceStackEl.hidden;
    acceptanceStackEl.hidden = !open;
    acceptanceChevronEl.textContent = open ? "⌃" : "⌄";
    if (!open) closeAllTesterMenus();
  });

  document.querySelectorAll("[data-tester]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = "menu-" + btn.dataset.tester;
      const target = $(id);
      const wasHidden = target.hidden;
      closeAllTesterMenus();
      target.hidden = !wasHidden;
    });
  });

  /* ---------- 18. 启动初始化 ---------- */
  window.addEventListener("resize", updateViewportGeometry);

  async function boot() {
    updateViewportGeometry();
    const res = await fetch("../assets/shared/catalog.json");
    catalog = await res.json();

    await initPet(state.petId);
    appEl.dataset.period = state.period;
    currentPanoUrl = resolveTargetPanoramaUrl();
    panoCurrEl.src = currentPanoUrl;

    // 恢复墙面拍立得（若已有收藏）
    if (state.postcards.length > 0) {
      composeCleanIllustrationUrl(state.postcards[0].petId, state.postcards[0].setId, state.postcards[0].sceneId).then((url) => {
        wallPolaroidImgEl.src = url;
        wallPolaroidEl.hidden = false;
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
