/* ==========================================================================
   EggBabe · 拾物伴手礼袋 3D 物理撕包与 3 张全息卡主引擎
   - 基于 MIT 协议 240Hz 阻尼弹簧求解器 + 96 段锯齿铝箔撕口 + 12 段卷曲内衬 + 32 道彩虹流光
   - 与 EggBabeStore 双向持久化：每日首袋免费 / 20✦ 兑换 / 新物自动入多宝格 / 重复返还 +5✦
   ========================================================================== */
(function () {
  "use strict";

  const Store = window.EggBabeStore;
  const Config = window.EggBabeHoloConfig;
  const SoundMod = window.EggBabeHoloSound;
  const catalog = window.__EGGBABE_CATALOG__ || { keepsakes: [], pets: {} };

  if (!Store || !Config || !SoundMod) {
    console.error("EggBabe holo-pack dependencies missing");
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const isEmbedded = params.get("embed") === "1" || window.parent !== window;
  if (isEmbedded) document.body.classList.add("is-embedded");

  const storageAdapter = Store.createStorageAdapter();
  const CARD_POOL = Config.buildKeepsakeCardPool(catalog, "../../");
  const TIER_META = Config.TIER_META;
  const PACK_THEMES = Config.PACK_THEMES;
  const PACK_BRAND = Config.PACK_BRAND;

  const $ = (id) => document.getElementById(id);
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const rand = (min, max) => min + Math.random() * (max - min);
  const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const prefersReducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isCoarsePointer = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;

  const stageEl = $("stage");
  const scene = $("scene");
  const pack = $("pack");
  const grabZone = $("grabZone");
  const tearFlap = $("tearFlap");
  const bodyLip = $("bodyLip");
  const jetAnchor = $("jetAnchor");
  const lightJet = $("lightJet");
  const packAura = $("packAura");
  const groundShadow = $("groundShadow");
  const confettiCanvas = $("confettiCanvas");
  const ctx2d = confettiCanvas.getContext("2d");

  const mascotImgEl = $("mascotImg");
  const editionTag = $("editionTag");
  const gestureHint = $("gestureHint");
  const liveStatus = $("liveStatus");
  const pullBanner = $("pullBanner");
  const bannerKicker = $("bannerKicker");
  const bannerTitle = $("bannerTitle");

  const starBalanceVal = $("starBalanceVal");
  const curioKicker = $("curioKicker");
  const curioCountVal = $("curioCountVal");
  const goCurioBtn = $("goCurioBtn");
  const shakeBtn = $("shakeBtn");
  const flipAllBtn = $("flipAllBtn");
  const againBtn = $("againBtn");
  const muteBtn = $("muteBtn");
  const themeModeBtn = $("themeModeBtn");
  const themeModeLabel = $("themeModeLabel");
  const packToast = $("packToast");

  const zoomStoryPill = $("zoomStoryPill");
  const zoomStoryName = $("zoomStoryName");
  const zoomStoryTag = $("zoomStoryTag");
  const zoomStoryText = $("zoomStoryText");

  const pouchFaces = [...pack.querySelectorAll(":scope > .pouch-face")];

  function loadLatestStore() {
    const res = Store.loadOrMigrateStore(storageAdapter, catalog);
    return res.store;
  }

  function saveStore(store) {
    storageAdapter.setJSON(Store.STORAGE_KEY, Store.sanitizeStoreForPersistence(store));
  }

  let appStore = loadLatestStore();
  const sound = SoundMod.createSoundController({
    initialMuted: appStore.settings && appStore.settings.sfxOn === false
  });

  function syncMuteUI() {
    muteBtn.setAttribute("aria-pressed", String(sound.isMuted));
  }
  syncMuteUI();

  muteBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const muted = sound.toggleMute();
    syncMuteUI();
    appStore = loadLatestStore();
    if (appStore.settings) {
      appStore.settings.sfxOn = !muted;
      saveStore(appStore);
    }
  });

  // 默认暖奶油白昼展台，支持一键切换静夜暗房聚光
  const LIGHT_KEY = "eggbabe_holo_pack_light";
  function applyStudioLight(mode) {
    const next = mode === "dark" ? "dark" : "day";
    document.documentElement.dataset.studioLight = next;
    themeModeLabel.textContent = next === "dark" ? "暗房聚光" : "暖光展台";
    try { localStorage.setItem(LIGHT_KEY, next); } catch (_) {}
  }
  applyStudioLight((() => {
    try { return localStorage.getItem(LIGHT_KEY) === "dark" ? "dark" : "day"; } catch (_) { return "day"; }
  })());

  themeModeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    sound.call("click");
    const cur = document.documentElement.dataset.studioLight === "dark" ? "dark" : "day";
    applyStudioLight(cur === "dark" ? "day" : "dark");
  });

  let toastTimer = null;
  function showToast(msg, durationMs) {
    packToast.textContent = msg;
    packToast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      packToast.hidden = true;
    }, durationMs || 2200);
  }

  let bannerTimer = null;
  function showPullBanner(kicker, title, durationMs) {
    bannerKicker.textContent = kicker;
    bannerTitle.textContent = title;
    pullBanner.hidden = false;
    pullBanner.style.animation = "none";
    void pullBanner.offsetWidth;
    pullBanner.style.animation = "";
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => {
      pullBanner.hidden = true;
    }, durationMs || 2600);
  }

  function isOrdinaryMode() {
    return appStore && appStore.profileMode === "wx-mp-ordinary";
  }

  function getActivePetOutfitImage() {
    const petId = appStore && appStore.activePetId === "yutu" ? "yutu" : "koi";
    const petStore = (appStore && appStore.pets && appStore.pets[petId]) || {};
    const petCat = (catalog.pets && catalog.pets[petId]) || {};
    const items = Array.isArray(petCat.items) ? petCat.items : [];
    const hit = items.find((x) => x.id === petStore.equippedSetId) || items[0];
    if (hit && hit.tex) return Config.resolveAssetPath(hit.tex, "../../");
    return petId === "yutu"
      ? "../../assets/shared/png/yutu_set_cozy_knit.png"
      : "../../assets/shared/png/koi_set_duck.png";
  }

  function updateHud() {
    appStore = loadLatestStore();
    const balance = Math.max(0, Math.floor(Number(appStore.companion && appStore.companion.starBalance || 0)));
    const unlockedCount = appStore.curioCabinet && Array.isArray(appStore.curioCabinet.unlockedIds)
      ? appStore.curioCabinet.unlockedIds.length
      : 0;
    const isFree = Store.canOpenFreeHoloPack(appStore);
    const ordinary = isOrdinaryMode();

    starBalanceVal.textContent = String(balance);
    curioKicker.textContent = ordinary ? "已留存小物" : "多宝收藏格";
    curioCountVal.textContent = ordinary
      ? `已留存 ${unlockedCount} 件`
      : `已收集 ${unlockedCount} / ${CARD_POOL.length}`;

    mascotImgEl.src = getActivePetOutfitImage();

    if (stageState === "enter" || stageState === "idle") {
      gestureHint.textContent = isFree
        ? "按住封口横向拖动撕开 · 今日首袋免费"
        : `按住封口横向拖动撕开 · ${Store.HOLO_PACK_STAR_COST}✦ / 袋`;
    }
    if (!againBtn.hidden) {
      againBtn.textContent = isFree
        ? "再拆一袋 (免费)"
        : `再拆一袋 (${Store.HOLO_PACK_STAR_COST}✦)`;
    }
  }

  function notifyParentComplete(extra) {
    if (!isEmbedded || !window.parent || window.parent === window) return;
    try {
      window.parent.postMessage(Object.assign({ type: "eggbabe:holo-pack-complete" }, extra || {}), "*");
    } catch (_) {}
  }

  goCurioBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    sound.call("click");
    if (isEmbedded && window.parent && window.parent !== window) {
      window.parent.postMessage({ type: "eggbabe:holo-pack-nav", target: "curio" }, "*");
    } else {
      window.location.href = "../../?open=curio";
    }
  });

  /* ---------- 阻尼弹簧求解器 ---------- */
  class SpringValue {
    constructor(initial, response, bounce) {
      this.x = initial || 0;
      this.to = this.x;
      this.v = 0;
      this.configure(response || 0.5, bounce || 0);
    }
    configure(response, bounce) {
      const b = bounce || 0;
      const omega = (2 * Math.PI) / response;
      this.k = omega * omega;
      this.c = (4 * Math.PI * (1 - b)) / response;
      return this;
    }
    step(dt) {
      this.v += (this.k * (this.to - this.x) - this.c * this.v) * dt;
      this.x += this.v * dt;
    }
  }

  function createSpringGroup(initObj, response, bounce) {
    const out = {};
    for (const [k, val] of Object.entries(initObj)) {
      out[k] = new SpringValue(val, response, bounce);
    }
    return out;
  }

  /* ---------- 袋身圆润侧边切片 ---------- */
  const polyFromPoints = (pts) => `polygon(${pts.map(([x, y]) => `${(+x).toFixed(2)}% ${(+y).toFixed(2)}%`).join(",")})`;
  const mirrorPointsX = (pts) => pts.map(([x, y]) => [100 - x, y]);

  const gussetSlices = [];
  for (const sideSign of [-1, 1]) {
    for (const angleDeg of [80, 60, 40, 20, 0, -20, -40, -60, -80]) {
      const rad = (angleDeg * Math.PI) / 180;
      const depthRatio = (1 - Math.sin(rad)) / 2;
      const baseW = 4;
      const bulgeW = 5 * Math.cos(rad);
      const el = document.createElement("i");
      const curve = Array.from({ length: 13 }, (_, i) => [
        ((baseW + bulgeW * Math.pow(Math.sin((Math.PI * i) / 12), 0.8)) / (baseW + bulgeW)) * 100,
        (i / 12) * 100
      ]);
      const shape = [[0, 0], ...curve, [0, 100]];
      const mixTone = sideSign > 0 ? `#000 ${(10 + depthRatio * 36).toFixed(0)}%` : `#fff ${(40 * (1 - depthRatio)).toFixed(0)}%`;
      const topInset = 11.5 + depthRatio * 13;

      el.className = "gusset-slice";
      el.style.cssText =
        `${sideSign > 0 ? "left" : "right"}:calc(50% + var(--pack-w)*0.476 - ${baseW}px);` +
        `width:${(baseW + bulgeW).toFixed(2)}px;` +
        `top:${topInset.toFixed(2)}%;bottom:${topInset.toFixed(2)}%;` +
        `transform:translateZ(calc(var(--pack-depth)*${(Math.sin(rad) / 2).toFixed(3)}));` +
        `clip-path:${polyFromPoints(sideSign > 0 ? shape : mirrorPointsX(shape))};` +
        `background:color-mix(in srgb, var(--pack-color), ${mixTone});`;

      pack.insertBefore(el, tearFlap);
      gussetSlices.push({ el, sideSign, defaultTop: topInset });
    }
  }

  const inlineSvgUrl = (inner) =>
    `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'>${inner}</svg>")`;

  function randomizeFoilShading(styleTarget) {
    const fmt = (n) => n.toFixed(2);
    let streaks = "";
    for (let x = 0; x < 100; ) {
      const w = rand(0.5, 2.5);
      streaks += `<rect x='${fmt(x)}' y='6.8' width='${fmt(w)}' height='${fmt(rand(3.2, 8.4))}' fill='url(%23g)' fill-opacity='${fmt(rand(0.08, 0.38))}'/>`;
      x += w + rand(0, 1.4);
    }
    let foldPath = "M0 93.2V91.6";
    for (let x = 0; x < 100; ) {
      const w = rand(2.5, 6.8);
      const peak = x + w * rand(0.35, 0.65);
      x = Math.min(100, x + w);
      foldPath += `Q${fmt(peak)} ${fmt(rand(86.6, 90.0))} ${fmt(x)} ${fmt(rand(91.1, 91.7))}`;
    }

    styleTarget.setProperty(
      "--foil-shine",
      inlineSvgUrl(
        `<linearGradient id='g' x2='0' y2='1'><stop stop-color='%23fff' stop-opacity='.72'/><stop offset='1' stop-color='%23fff' stop-opacity='0'/></linearGradient>` +
        `<filter id='b'><feGaussianBlur stdDeviation='.28 .5'/></filter><g filter='url(%23b)'>${streaks}</g>`
      )
    );
    styleTarget.setProperty(
      "--foil-shade",
      inlineSvgUrl(`<filter id='b'><feGaussianBlur stdDeviation='.35 .24'/></filter><path d='${foldPath}V93.2Z' fill-opacity='.11' filter='url(%23b)'/>`)
    );
  }

  /* ---------- 96 段锯齿撕裂几何 + 12 段卷曲封条 ---------- */
  const TEAR_BASE_Y = 10.6;
  const TEAR_SEGMENTS = 96;
  const STRIP_SLICES = isCoarsePointer ? 8 : 12;
  const TEAR_MIN_Y = 8.0;
  const TEAR_MAX_Y = 19.5;

  const stripSegments = Array.from({ length: STRIP_SLICES }, () => {
    const el = document.createElement("div");
    el.className = "strip-segment";
    el.hidden = true;
    el.innerHTML =
      `<div class="pouch-face front"><span class="tear-label">${PACK_BRAND.tearHint}</span><i class="foil-lip"></i><i class="curl-shade"></i></div>` +
      `<div class="pouch-face foil-lining"><i class="curl-shade"></i></div>`;
    tearFlap.append(el);
    const [frontEl, liningEl] = el.children;
    return {
      el,
      frontEl,
      liningEl,
      lipEl: frontEl.querySelector(".foil-lip"),
      frontShade: frontEl.querySelector(".curl-shade"),
      backShade: liningEl.querySelector(".curl-shade"),
      locked: false
    };
  });

  let tearVertices = [];
  let curlTightness = 1;

  function applyVertexBend(vert, bendOffset) {
    vert[5] = bendOffset;
    vert[1] = clamp(vert[2] + bendOffset, TEAR_MIN_Y, TEAR_MAX_Y) + vert[3];
  }

  function generateTearLine() {
    curlTightness = rand(0.7, 1.38);
    const slope = rand(-6.8, 6.8);
    const arch = rand(-2.6, 2.6);
    const waveFreq = rand(1.6, 3.4);
    const wavePhase = rand(0, Math.PI * 2);
    const waveAmp = rand(0.3, 1.0);
    const startY = rand(10.6, 13.6);
    let drift = 0;

    tearVertices = Array.from({ length: TEAR_SEGMENTS + 1 }, (_, i) => {
      const x = (i / TEAR_SEGMENTS) * 100;
      const normX = x / 50 - 1;
      drift = clamp(drift + rand(-0.24, 0.24) + (Math.random() < 0.05 ? rand(-1.3, 1.3) : 0), -2.0, 2.0);
      const px = i > 0 && i < TEAR_SEGMENTS ? x + rand(-0.28, 0.28) : x;
      const baseY = startY + slope * normX + arch * (1 - normX * normX) + waveAmp * Math.sin(normX * waveFreq * Math.PI + wavePhase) + drift;
      const microTooth = rand(-0.38, 0.38) + (Math.random() < 0.14 ? rand(-1.1, 1.1) : 0);
      const lipWidth = Math.random() < 0.12 ? rand(1.15, 1.95) : rand(0.36, 1.04);
      const v = [px, 0, baseY, microTooth, lipWidth, 0];
      applyVertexBend(v, 0);
      return v;
    });
  }

  function tearYAt(xPercent) {
    const f = (clamp(xPercent, 0, 100) / 100) * TEAR_SEGMENTS;
    const idx = Math.min(TEAR_SEGMENTS - 1, Math.floor(f));
    return tearVertices[idx][1] + (tearVertices[idx + 1][1] - tearVertices[idx][1]) * (f - idx);
  }

  function steerRemainingTear(steerSlope, progress, dir) {
    const pivotIdx = clamp(Math.round((dir > 0 ? progress : 1 - progress) * TEAR_SEGMENTS), 0, TEAR_SEGMENTS);
    for (let i = pivotIdx + dir; i >= 0 && i <= TEAR_SEGMENTS; i += dir) {
      const dist = (Math.abs(i - pivotIdx) * 100) / TEAR_SEGMENTS;
      applyVertexBend(tearVertices[i], tearVertices[pivotIdx][5] + steerSlope * dist);
    }
  }

  const buildLipBand = (pts, dirSign) => [
    ...pts,
    ...pts.slice().reverse().map((q) => [q[0], q[1] + dirSign * q[4]])
  ];

  /* ---------- 舞台状态 ---------- */
  const packPose = createSpringGroup({ x: 0, y: 0, rx: 0, ry: 0, rz: 0 }, 0.7, 0.28);
  const tearState = {
    p: new SpringValue(0, 0.1),
    zAngle: new SpringValue(0, 0.28, 0.35),
    xAngle: new SpringValue(0, 0.3, 0.2),
    dir: 1,
    prevP: 0
  };
  const squeezeSpring = new SpringValue(0, 0.3, 0.45);
  const jetGlowSpring = new SpringValue(0, 0.5);

  const pointer = {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
    prevX: window.innerWidth / 2,
    inside: false,
    down: false,
    isTouch: false,
    tapped: false
  };

  let stageState = "enter";
  let currentTheme = null;
  let currentPackRoll = null;
  let enterTimer = null;
  let peekAuraTimer = null;
  let dragSession = null;
  let didDragMove = false;
  let packFall = null;
  let stripFlight = null;
  let jetAnchorFrozen = { y: 0, rx: 0, ry: 0, rz: 0, sq: 0 };
  let cards = [];
  let zoomedCard = null;
  let confettiBits = [];
  let sparkParticles = [];
  let shockRings = [];
  let confettiDirty = false;
  let clockSec = 0;
  let lastFrameMs = performance.now();
  let openedAtSec = 0;
  let orbitStartedAt = 0;
  let nextIdleNudgeSec = 5.0;
  let lastShakeAtSec = -2;
  let pointerShakeEnergy = 0;
  let sparkCarry = 0;
  let packWidth = 270;
  let packHeight = 392;

  function measureStage() {
    packWidth = pack.offsetWidth || 270;
    packHeight = pack.offsetHeight || 392;
    const dpr = Math.min(isCoarsePointer ? 1.5 : 2, window.devicePixelRatio || 1);
    confettiCanvas.width = Math.floor(window.innerWidth * dpr);
    confettiCanvas.height = Math.floor(window.innerHeight * dpr);
  }

  function updateTearClips(p) {
    const d = tearState.dir;
    const tipX = d > 0 ? p * 100 : 100 - p * 100;
    const tipY = tearYAt(tipX);
    const tipVert = [tipX, tipY, 0, 0, 0];

    const tornPart = tearVertices.filter(([x]) => (d > 0 ? x < tipX : x > tipX));
    const bodyPoly = d > 0
      ? [[tipX, 0], [100, 0], [100, 100], [0, 100], ...tornPart, [tipX, tipY]]
      : [[0, 0], [tipX, 0], [tipX, tipY], ...tornPart, [100, 100], [0, 100]];

    pouchFaces[0].style.clipPath = polyFromPoints(bodyPoly);
    pouchFaces[1].style.clipPath = polyFromPoints(mirrorPointsX(bodyPoly));
    bodyLip.style.clipPath = polyFromPoints(buildLipBand(d > 0 ? [...tornPart, tipVert] : [tipVert, ...tornPart], 1));

    for (const g of gussetSlices) {
      const edgeX = g.sideSign > 0 ? 100 : 0;
      if (d > 0 ? edgeX <= tipX : edgeX >= tipX) {
        g.el.style.top = Math.max(g.defaultTop, tearYAt(edgeX) + 1.4).toFixed(2) + "%";
      }
    }

    tearFlap.style.transformOrigin = `${tipX}% ${tipY}%`;
    const sliceW = 100 / STRIP_SLICES;
    const seamOverlap = 0.25;

    stripSegments.forEach((seg, idx) => {
      const lo = d > 0 ? idx * sliceW : Math.max(idx * sliceW, tipX);
      const hi = d > 0 ? Math.min((idx + 1) * sliceW, tipX) : (idx + 1) * sliceW;
      if (hi <= lo) {
        seg.el.hidden = true;
        return;
      }
      seg.el.hidden = false;
      if (!seg.locked) {
        const leftEdge = d < 0 && lo === tipX ? lo : Math.max(0, lo - seamOverlap);
        const rightEdge = d > 0 && hi === tipX ? hi : Math.min(100, hi + seamOverlap);
        const span = [
          [leftEdge, tearYAt(leftEdge), 0, 0, 0.8],
          ...tearVertices.filter((q) => q[0] > leftEdge && q[0] < rightEdge),
          [rightEdge, tearYAt(rightEdge), 0, 0, 0.8]
        ];
        const flapPoly = [[leftEdge, 0], [rightEdge, 0], ...span.slice().reverse()];
        seg.frontEl.style.clipPath = polyFromPoints(flapPoly);
        seg.liningEl.style.clipPath = polyFromPoints(mirrorPointsX(flapPoly));
        seg.lipEl.style.clipPath = polyFromPoints(buildLipBand(span, -1));
        seg.locked = d > 0 ? hi < tipX || tipX >= 100 : lo > tipX || tipX <= 0;
      }
    });

    const activeSlice = clamp(Math.floor((d > 0 ? tipX - 1e-6 : tipX) / sliceW), 0, STRIP_SLICES - 1);
    const curlBase = (2.6 + 2.6 * p) * curlTightness;
    const flutter = Math.min(1, Math.abs(tearState.p.v) * 0.4) * 1.6;
    let matrixChain = "";
    let totalAngle = 0;

    for (let n = 0, k = activeSlice; k >= 0 && k < STRIP_SLICES; n++, k -= d) {
      const hingePx = (((n ? (d > 0 ? k + 1 : k) * sliceW : tipX) / 100) * packWidth).toFixed(2);
      const degY = d * (curlBase * (0.4 + 0.3 * n) + Math.sin(clockSec * 16 + n * 0.9) * flutter);
      const degZ = (d * 0.9 * n) / 4;
      totalAngle += degY;
      matrixChain += `translateX(${hingePx}px) rotateY(${degY.toFixed(2)}deg) rotateZ(${degZ.toFixed(2)}deg) translateX(-${hingePx}px) `;

      const seg = stripSegments[k];
      seg.el.style.transform = matrixChain;
      seg.frontShade.style.opacity = Math.min(0.48, Math.abs(totalAngle) / 200).toFixed(2);
      seg.backShade.style.opacity = Math.max(0, 0.32 - Math.abs(totalAngle) / 420).toFixed(2);
    }
  }

  /* ---------- 袋口 32 道暖彩虹光流 ---------- */
  const RAINBOW_PALETTE = ["#f4b9ae", "#f3c57a", "#ede78e", "#9db65b", "#92cde0", "#b8a6e8", "#f2a8c2"];
  const RIBBON_COUNT = 32;
  const JET_ORIGIN_Y = 107.5;
  const JET_SPAN = 1500;
  const JET_TIP = 36;
  const JET_STEP = isCoarsePointer ? 3.5 : 2.5;

  let jetEdges = [];
  let jetRibbons = [];
  let jetMotes = [];
  let bandPaths = [];
  let seamPaths = [];
  let fadeStops = [];
  let jetReach = 0;
  let jetDrained = false;
  let jetStartY = 62.5;
  let jetRadius0 = 45;

  const lightenHex = (hex, ratio) =>
    "#" +
    [1, 3, 5]
      .map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - ratio) + 255 * ratio).toString(16).padStart(2, "0"))
      .join("");

  function initLightJet() {
    const colorOffset = Math.floor(rand(0, 7));
    const unit = packWidth / 100;
    jetStartY = 62.5 + (((TEAR_MAX_Y - TEAR_BASE_Y) / 100) * packHeight) / unit;
    jetRadius0 = JET_ORIGIN_Y - jetStartY;

    jetEdges = Array.from({ length: RIBBON_COUNT + 1 }, (_, j) => {
      const ox = 3 + (94 * j) / RIBBON_COUNT;
      const x = 50 + ((ox - 50) * jetRadius0) / 45;
      const angle = Math.atan2(x - 50, jetRadius0) + rand(-0.012, 0.012);
      return { ox, x, ux: Math.sin(angle), uy: -Math.cos(angle), phase: j * 0.35 + rand(-0.1, 0.1), r: Math.hypot(x - 50, jetRadius0) };
    });

    jetRibbons = Array.from({ length: RIBBON_COUNT }, (_, j) => {
      const r = (jetEdges[j].r + jetEdges[j + 1].r) / 2;
      return {
        midX: (jetEdges[j].ox + jetEdges[j + 1].ox) / 2,
        gradX: (jetEdges[j].x + jetEdges[j + 1].x) / 2,
        r,
        maxLen: 0,
        color: RAINBOW_PALETTE[(j + colorOffset) % 7],
        active: false,
        len: 0,
        growth: new SpringValue(0, 0.4, prefersReducedMotion ? 0 : 0.3)
      };
    });

    lightJet.innerHTML = `<defs>
      <radialGradient id="jetMote"><stop offset=".2" stop-color="#fff"/><stop offset=".45" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
      ${jetRibbons
        .map((b, j) => {
          const ux = (jetEdges[j].ux + jetEdges[j + 1].ux) / 2;
          const uy = (jetEdges[j].uy + jetEdges[j + 1].uy) / 2;
          const hotDist = 26 + jetStartY - 62.5;
          return `<linearGradient id="jb${j}" gradientUnits="userSpaceOnUse" x1="${b.gradX.toFixed(2)}" y1="${jetStartY}" x2="${(b.gradX + ux * hotDist).toFixed(2)}" y2="${(jetStartY + uy * hotDist).toFixed(2)}"><stop stop-color="${lightenHex(b.color, 0.72)}"/><stop offset="1" stop-color="${b.color}"/></linearGradient>`;
        })
        .join("")}
      <radialGradient id="jetFadeGrad" gradientUnits="userSpaceOnUse" cx="50" cy="${jetStartY + jetRadius0}" r="${JET_SPAN}">
        <stop stop-color="#fff" stop-opacity="0"/><stop stop-color="#fff"/><stop stop-color="#fff"/><stop stop-color="#fff" stop-opacity="0"/>
      </radialGradient>
      <mask id="jetFadeMask" maskUnits="userSpaceOnUse"><rect fill="url(#jetFadeGrad)"/></mask>
      <filter id="jetBloom" filterUnits="userSpaceOnUse"><feGaussianBlur stdDeviation="2.2"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <g${isCoarsePointer ? "" : ' filter="url(#jetBloom)"'}>
      <g${isCoarsePointer ? "" : ' mask="url(#jetFadeMask)"'}>
        ${jetRibbons.map((_, j) => `<path class="jet-band" fill="url(#jb${j})"/>`).join("")}
        ${isCoarsePointer ? "" : `<g fill="none" stroke="#fff" stroke-opacity=".62" stroke-width=".4">${'<path class="jet-seam"/>'.repeat(RIBBON_COUNT + 1)}</g>`}
        ${'<circle class="jet-spark" fill="url(#jetMote)"/>'.repeat(10)}
      </g>
    </g>`;

    bandPaths = [...lightJet.querySelectorAll(".jet-band")];
    seamPaths = [...lightJet.querySelectorAll(".jet-seam")];
    fadeStops = [...lightJet.querySelectorAll("#jetFadeGrad stop")];
    jetMotes = [...lightJet.querySelectorAll(".jet-spark")].map((el) => ({
      el,
      bandIdx: -1,
      u: Math.random(),
      v: rand(0.2, 0.8),
      speed: rand(0.3, 0.5),
      radius: rand(1.6, 2.8)
    }));

    fitLightJetBounds();
  }

  function fitLightJetBounds() {
    const unit = packWidth / 100;
    const topRoom = 2.5 + (window.innerHeight / 2 - packHeight * (0.5 - TEAR_BASE_Y / 100)) / unit;
    const halfSpanW = Math.min(window.innerWidth / 2 / unit, topRoom * 1.2 + 60) + 20;
    jetReach = prefersReducedMotion ? 45 + topRoom * 0.6 : (45 + topRoom) * Math.hypot(47 / 45, 1) + JET_TIP + 20;
    for (const b of jetRibbons) b.maxLen = jetReach - b.r;

    const bbox = { x: 50 - halfSpanW, y: 32.5 - topRoom, width: 2 * halfSpanW, height: topRoom + 60 };
    for (const el of lightJet.querySelectorAll("#jetFadeMask, #jetFadeMask rect, #jetBloom")) {
      for (const [k, val] of Object.entries(bbox)) el.setAttribute(k, val.toFixed(1));
    }
  }

  function stepLightJet(dt) {
    const animT = prefersReducedMotion ? 0 : clockSec;
    const tipX = tearState.dir > 0 ? tearState.p.x * 100 : 100 - tearState.p.x * 100;
    const sway = Math.sin(animT * 0.9) * 1.5;
    const released = !prefersReducedMotion && (stageState === "open" || stageState === "spread");
    const elapsed = clockSec - openedAtSec;
    const unit = packWidth / 100;
    const rzRad = (jetAnchorFrozen.rz * Math.PI) / 180;
    const screenRoof = 60 + ((-window.innerHeight / 2 - jetAnchorFrozen.y) / Math.cos(rzRad) + packHeight * (0.5 - TEAR_BASE_Y / 100)) / unit;

    const fullThrow = ((jetStartY + jetRadius0 - screenRoof) * jetRibbons[0].r) / jetRadius0 + JET_TIP + 20;
    const farDist = released ? jetReach + (fullThrow - jetReach) * (1 - Math.pow(1 - Math.min(1, elapsed / 0.5), 2)) : jetReach;
    const tailDist = jetRadius0 - 5 + (released ? (fullThrow + 21 - jetRadius0) * Math.pow(clamp((elapsed - 0.35) / 0.55, 0, 1), 2) : 0);
    const waveCarry = released ? (45 * elapsed * elapsed) / (elapsed + 0.25) : 0;

    for (const b of jetRibbons) {
      if (stageState === "idle" && tearState.p.x > 0 && (tearState.dir > 0 ? b.midX < tipX : b.midX > tipX)) {
        b.active = true;
      }
      b.growth.to = b.active ? 1 : 0;
      b.len = b.maxLen * Math.max(0, b.growth.x) + farDist - jetReach;
    }

    if (!isCoarsePointer) {
      [tailDist - 16, tailDist, farDist - JET_TIP, farDist].forEach((val, idx) => {
        if (fadeStops[idx]) fadeStops[idx].setAttribute("offset", clamp(Math.min(val, farDist) / JET_SPAN, 0, 1).toFixed(4));
      });
    }

    const pointAlongEdge = (edgeIdx, dist) => {
      const e = jetEdges[edgeIdx];
      const k = Math.min(1, dist / 90);
      const wave = (0.4 + 2 * k) * Math.sin(((dist - waveCarry) / 22 - animT * 1.4) * Math.PI * 2 + e.phase) + sway * k;
      return [e.x + e.ux * dist - e.uy * wave, jetStartY + e.uy * dist + e.ux * wave];
    };

    const leadPad = isCoarsePointer ? 0 : 20;
    const maxSide = window.innerWidth / 2 / unit + 14;
    const snap = (n) => Math.round(n * 20) / 20;

    const sampledEdges = jetEdges.map((e, j) => {
      const stopLimit = Math.min((jetStartY - screenRoof) / -e.uy, (maxSide - Math.abs(e.x - 50)) / Math.abs(e.ux)) + 24;
      const len = Math.min(Math.max((jetRibbons[j - 1] && jetRibbons[j - 1].len) || 0, (jetRibbons[j] && jetRibbons[j].len) || 0), stopLimit);
      const iStart = Math.max(0, Math.floor((tailDist - leadPad - e.r) / JET_STEP));
      const pts = [];
      if (len > iStart * JET_STEP) {
        for (let i = iStart; ; i++) {
          const d = Math.min(i * JET_STEP, len);
          const [px, py] = pointAlongEdge(j, d);
          pts.push(`${snap(px)} ${snap(py)}`);
          if (d >= len) break;
        }
      }
      return { iStart, pts };
    });

    const slicePts = (edgeObj, len) => edgeObj.pts.slice(0, Math.max(0, Math.ceil(len / JET_STEP) - edgeObj.iStart + 1));

    jetRibbons.forEach((b, j) => {
      const leftPts = slicePts(sampledEdges[j], b.len);
      const rightPts = slicePts(sampledEdges[j + 1], b.len);
      bandPaths[j].setAttribute("d", leftPts.length > 1 && rightPts.length > 1 ? `M${leftPts.join("L")}L${rightPts.slice().reverse().join("L")}Z` : "");
    });

    seamPaths.forEach((el, j) => {
      el.setAttribute("d", sampledEdges[j].pts.length > 1 ? `M${sampledEdges[j].pts.join("L")}` : "");
    });

    jetDrained = released && elapsed > 0.92;

    const activeIndices = jetRibbons.flatMap((b, j) => (b.active ? [j] : []));
    for (const m of jetMotes) {
      if (!prefersReducedMotion) m.u += dt * m.speed;
      if (m.u > 1 || !(jetRibbons[m.bandIdx] && jetRibbons[m.bandIdx].active)) {
        if (m.u > 1) m.u -= 1;
        if (!activeIndices.length) {
          m.el.setAttribute("opacity", "0");
          continue;
        }
        m.bandIdx = activeIndices[Math.floor(rand(0, activeIndices.length))];
      }
      const len = jetRibbons[m.bandIdx].len;
      const d0 = Math.max(0, tailDist - jetEdges[m.bandIdx].r);
      const dist = d0 + m.u * (len - d0);
      const [x1, y1] = pointAlongEdge(m.bandIdx, dist);
      const [x2, y2] = pointAlongEdge(m.bandIdx + 1, dist);
      m.el.setAttribute("cx", (x1 + (x2 - x1) * m.v).toFixed(2));
      m.el.setAttribute("cy", (y1 + (y2 - y1) * m.v).toFixed(2));
      m.el.setAttribute("r", (m.radius * (0.6 + m.u * 0.7)).toFixed(2));
      m.el.setAttribute("opacity", (Math.sin(Math.PI * m.u) * Math.min(1, len / 20)).toFixed(2));
    }
  }

  /* ---------- Canvas 2D 纸屑、火花与冲击波 ---------- */
  const CONFETTI_SHAPES = [new Path2D(), new Path2D(), new Path2D("M0-6 1.3-1.3 6 0 1.3 1.3 0 6-1.3 1.3-6 0-1.3-1.3Z")];
  CONFETTI_SHAPES[0].arc(0, 0, 4.2, 0, Math.PI * 2);
  if (typeof CONFETTI_SHAPES[1].roundRect === "function") {
    CONFETTI_SHAPES[1].roundRect(-3.2, -5.8, 6.4, 11.6, 2);
  } else {
    CONFETTI_SHAPES[1].rect(-3.2, -5.8, 6.4, 11.6);
  }
  const STAR_SPARK_PATH = new Path2D("M0-7 1.4-1.4 7 0 1.4 1.4 0 7-1.4 1.4-7 0-1.4-1.4Z");

  function stageToScreen(x, y, z) {
    const persp = 1400 / Math.max(200, 1400 - (z || 0));
    return [
      window.innerWidth / 2 + x * persp,
      window.innerHeight * 0.42 + (window.innerHeight * 0.08 + y) * persp,
      persp
    ];
  }

  function preloadConfettiPool(hasSecret) {
    confettiBits = [];
    const count = isCoarsePointer ? 100 : hasSecret ? 210 : 170;
    const colors = hasSecret
      ? ["#f5d376", "#fff6d6", "#f4b9ae", "#9db65b", "#ffffff"]
      : [...RAINBOW_PALETTE, "#ffffff"];
    for (let i = 0; i < count; i++) {
      confettiBits.push({ shapeIdx: i % 3, color: colors[i % colors.length] });
    }
  }

  function packLocalToStage(lx, ly, lz) {
    const deg = Math.PI / 180;
    const cx = Math.cos(packPose.rx.x * deg), sx = Math.sin(packPose.rx.x * deg);
    const cy = Math.cos(packPose.ry.x * deg), sy = Math.sin(packPose.ry.x * deg);
    const cz = Math.cos(packPose.rz.x * deg), sz = Math.sin(packPose.rz.x * deg);
    const x0 = ((lx - 50) / 100) * packWidth;
    const y0 = ((ly - 50) / 100) * packHeight;
    const x1 = x0 * cz - y0 * sz;
    const y1 = x0 * sz + y0 * cz;
    const x2 = x1 * cy + lz * sy;
    const z2 = -x1 * sy + lz * cy;
    return [x2 + packPose.x.x, y1 * cx - z2 * sx + packPose.y.x + (packFall ? packFall.y : 0), y1 * sx + z2 * cx];
  }

  function launchConfetti() {
    confettiBits.forEach((bit, i) => {
      if (bit.age !== undefined) return;
      const lx = rand(6, 94);
      const termVel = 260 + 380 * Math.pow(Math.random(), 1.5);
      Object.assign(bit, {
        insidePouch: true,
        lx,
        ly: tearYAt(lx) + rand(1, 16),
        lz: rand(4.5, 7.0),
        upSpeed: rand(880, 2400),
        spreadAngle: ((lx - 50) / 50 + rand(-0.5, 0.5)) * clamp(window.innerWidth / 1000, 0.5, 1),
        burstSpeed: rand(520, 2450),
        rot: rand(0, 360),
        spin: rand(-680, 680),
        dragCoeff: 2600 / (termVel * termVel),
        flutterAmp: rand(850, 2300),
        driftX: Math.sign(lx - 50) * rand(-160, 820),
        scale: rand(0.9, 1.75),
        phase: rand(0, Math.PI * 2),
        age: i < 40 ? 0 : -rand(0, 0.22),
        x: 0,
        y: 0,
        z: 0
      });
    });
  }

  function emitScreenSparks(sx, sy, cfg) {
    if (prefersReducedMotion) return;
    const o = cfg || {};
    const count = o.count || 12;
    const colors = o.colors || ["#ffffff"];
    for (let i = 0; i < count; i++) {
      const ang = rand(0, Math.PI * 2);
      const spd = rand(o.speedMin || 120, o.speedMax || 400);
      sparkParticles.push({
        x: sx,
        y: sy,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - rand(20, 90),
        gravity: o.gravity || 620,
        age: 0,
        life: rand(o.lifeMin || 0.28, o.lifeMax || 0.62),
        scale: rand(o.scaleMin || 0.55, o.scaleMax || 1.2),
        rot: rand(0, Math.PI * 2),
        spin: rand(-8, 8),
        color: pickOne(colors)
      });
    }
  }

  function spawnFlipBurst(cardObj) {
    if (prefersReducedMotion) return;
    const rarity = cardObj.def.rarity;
    const meta = TIER_META[rarity] || TIER_META.common;
    if (meta.rank <= 1) return;

    const [sx, sy, persp] = stageToScreen(cardObj.pose.x.x, cardObj.pose.y.x, cardObj.pose.z.x + 24);
    const baseRadius = packWidth * 0.34 * persp;

    if (rarity === "secret") {
      ["#f4b9ae", "#f5d376", "#9db65b"].forEach((col, i) => {
        shockRings.push({ x: sx, y: sy, r0: baseRadius * 0.35, r1: baseRadius * (2.4 + i * 0.42), age: -i * 0.055, life: 0.56, color: col, width: 4.2 - i * 0.8 });
      });
      emitScreenSparks(sx, sy, {
        count: isCoarsePointer ? 28 : 48,
        colors: ["#f5d376", "#f4b9ae", "#9db65b", "#ffffff"],
        speedMin: 160,
        speedMax: 580,
        gravity: 500,
        lifeMin: 0.4,
        lifeMax: 0.82
      });
    } else if (rarity === "ultra") {
      ["#f5c967", "#ffffff"].forEach((col, i) => {
        shockRings.push({ x: sx, y: sy, r0: baseRadius * 0.35, r1: baseRadius * (2.0 + i * 0.35), age: -i * 0.05, life: 0.48, color: col, width: 3.6 - i });
      });
      emitScreenSparks(sx, sy, {
        count: isCoarsePointer ? 20 : 34,
        colors: ["#f5c967", "#fff3c2", "#f4b9ae", "#ffffff"],
        speedMin: 140,
        speedMax: 480,
        gravity: 540
      });
    } else {
      const col = meta.shockColor || "#9db65b";
      shockRings.push({ x: sx, y: sy, r0: baseRadius * 0.35, r1: baseRadius * 1.7, age: 0, life: 0.42, color: col, width: 3 });
      emitScreenSparks(sx, sy, {
        count: 18,
        colors: [col, "#ffffff"],
        speedMin: 120,
        speedMax: 380,
        gravity: 580
      });
    }
  }

  function triggerStageImpact(rarity) {
    if (prefersReducedMotion) return;
    const cls = rarity === "secret" ? "impact-secret" : rarity === "ultra" ? "impact-ultra" : "";
    if (!cls) return;
    stageEl.classList.remove("impact-ultra", "impact-secret");
    void stageEl.offsetWidth;
    stageEl.classList.add(cls);
  }

  /* ---------- 摇袋感应 ---------- */
  function shakePackPeek() {
    if ((stageState !== "idle" && stageState !== "enter") || tearState.p.to > 0.05 || !currentPackRoll) return;
    if (clockSec - lastShakeAtSec < 0.32) return;
    lastShakeAtSec = clockSec;

    if (stageState === "enter") {
      clearTimeout(enterTimer);
      stageState = "idle";
    }

    const { maxRank, topRarity } = currentPackRoll;
    const meta = TIER_META[topRarity] || TIER_META.common;

    packPose.rz.v += (Math.random() < 0.5 ? -1 : 1) * (200 + maxRank * 32);
    packPose.x.v += (Math.random() < 0.5 ? -1 : 1) * 300;
    packPose.y.v -= 170;
    squeezeSpring.v += 10;

    sound.call("shake", maxRank);

    packAura.style.setProperty("--peek-aura", meta.aura);
    packAura.classList.add("active");
    clearTimeout(peekAuraTimer);
    peekAuraTimer = setTimeout(() => packAura.classList.remove("active"), 1300);

    for (let i = 0; i < 4; i++) {
      const [wx, wy, wz] = packLocalToStage(rand(18, 82), 8, 8);
      const [sx, sy] = stageToScreen(wx, wy, wz);
      emitScreenSparks(sx, sy, {
        count: 4 + maxRank,
        colors: [meta.shockColor, "#ffffff"],
        speedMin: 80,
        speedMax: 260 + maxRank * 32,
        gravity: 420
      });
    }

    gestureHint.textContent = `轻晃感应：袋口透出「${meta.peekName}」· 横向拖动撕开`;
    gestureHint.classList.remove("hidden");
  }

  /* ---------- 3 卡双面构建、螺旋出袋与翻牌结算 ---------- */
  const ORBIT_DURATION = 1.15;
  const smoothStep = (a, b, x) => {
    const k = clamp((x - a) / (b - a), 0, 1);
    return k * k * (3 - 2 * k);
  };

  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]));
  }

  function buildCardBackMarkup() {
    return (
      `<div class="card-back" aria-hidden="true">` +
      `<svg class="card-back-guilloche" viewBox="0 0 200 280" aria-hidden="true">` +
      `<rect x="14" y="14" width="172" height="252" rx="10" fill="none" stroke="currentColor" stroke-opacity="0.28" stroke-width="0.9"/>` +
      `<rect x="20" y="20" width="160" height="240" rx="7" fill="none" stroke="currentColor" stroke-opacity="0.16" stroke-width="0.65" stroke-dasharray="2.5 3"/>` +
      `<circle cx="100" cy="132" r="62" fill="none" stroke="currentColor" stroke-opacity="0.18" stroke-width="0.7"/>` +
      `<circle cx="100" cy="132" r="50" fill="none" stroke="currentColor" stroke-opacity="0.28" stroke-width="0.8" stroke-dasharray="2 3.5"/>` +
      `<ellipse cx="100" cy="132" rx="60" ry="24" transform="rotate(-32 100 132)" fill="none" stroke="currentColor" stroke-opacity="0.24" stroke-width="0.75"/>` +
      `<ellipse cx="100" cy="132" rx="60" ry="24" transform="rotate(32 100 132)" fill="none" stroke="currentColor" stroke-opacity="0.24" stroke-width="0.75"/>` +
      `<path d="M100 66 L109 123 L166 132 L109 141 L100 198 L91 141 L34 132 L91 123 Z" fill="currentColor" fill-opacity="0.08" stroke="currentColor" stroke-opacity="0.38" stroke-width="0.85"/>` +
      `</svg>` +
      `<div class="card-back-crest"><span class="card-back-gem">✦</span></div>` +
      `<span class="card-back-top">EGGBABE · KEEPSAKE</span>` +
      `<span class="card-back-sub">拾物伴手礼</span>` +
      `</div>`
    );
  }

  function buildCardMarkup(cardDef) {
    const ordinary = isOrdinaryMode();
    const serialText = ordinary ? "蛋宝宝留存" : `NO. ${cardDef.serial}`;
    const ability = cardDef.ability || { name: "拾光印记", desc: "可摆入原木多宝收藏格" };
    const edges = '<i class="card-edge"></i><i class="card-edge"></i><i class="card-edge"></i>';
    return (
      edges +
      buildCardBackMarkup() +
      `<div class="card-face">` +
      `<span class="new-badge" hidden>NEW</span>` +
      `<i class="card-inner-bevel"></i>` +
      `<div class="art-window"><i class="art-vignette"></i><i class="art-floor-shadow"></i></div>` +
      `<i class="foil-holo"></i>` +
      `<i class="foil-glare"></i>` +
      `<div class="card-plaque">` +
      `<div class="card-head-row">` +
      `<b class="card-title">${escapeHtml(cardDef.name)}</b>` +
      `<span class="card-tag">${escapeHtml(cardDef.tag)}</span>` +
      `</div>` +
      `<div class="card-ability">` +
      `<span class="card-ability__badge">✦ ${escapeHtml(ability.name)}</span>` +
      `<span class="card-ability__desc">${escapeHtml(ability.desc)}</span>` +
      `</div>` +
      `<p class="card-trait">${escapeHtml(cardDef.trait)}</p>` +
      `<div class="card-foot-row">` +
      `<span class="card-serial">${escapeHtml(serialText)}</span>` +
      `<span class="card-rarity"><i class="rarity-gems">${escapeHtml(cardDef.rarityMark)}</i> ${escapeHtml(cardDef.rarityLabel)}</span>` +
      `</div>` +
      `</div>` +
      `<i class="foil-clearcoat"></i>` +
      `</div>` +
      `<div class="char-pop"><img src="${escapeHtml(cardDef.image)}" alt="${escapeHtml(cardDef.name)}" /></div>`
    );
  }

  /**
   * 3 张卡专属黄金布局：
   * - 手机竖屏：上二下一倒三角，第 3 张（压轴高品级）居中前排特大呈现
   * - 横屏/桌面：3 张优雅弧形横排
   */
  function computeFanSlot(cardObj) {
    const total = cards.length || 3;
    const baseW = cardObj.el.offsetWidth || packWidth * 0.86;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (vh > vw * 1.12 && total === 3) {
      const targetW = Math.min((vw - 38) / 2.08, (vh - 190) / 2.35 / 1.4, baseW * 1.05);
      const s = targetW / baseW;
      const layout = [
        { x: -(targetW * 0.54 + 6), y: -targetW * 0.68 - 10, z: 0, rz: -4.5, s: s * 0.96 },
        { x: (targetW * 0.54 + 6), y: -targetW * 0.68 - 10, z: 4, rz: 4.5, s: s * 0.96 },
        { x: 0, y: targetW * 0.66 - 6, z: 36, rz: 0, s: s * 1.04 }
      ][cardObj.slot] || { x: 0, y: 0, z: 0, rz: 0, s };
      return layout;
    }

    const offsetIdx = cardObj.slot - (total - 1) / 2;
    const s = clamp((vw - 56) / (baseW * (1 + (total - 1) * 1.1)), 0.66, 1.04);
    const scaledW = baseW * s;
    const stepX = Math.min(scaledW * 1.12, (vw - 48 - scaledW) / Math.max(1, total - 1));
    return {
      x: offsetIdx * stepX,
      y: -vh * 0.02 + offsetIdx * offsetIdx * 8 * s,
      z: cardObj.slot === total - 1 ? 26 : 0,
      rz: offsetIdx * 3.5,
      s
    };
  }

  function syncZoomStoryUI() {
    if (!zoomedCard || !zoomedCard.revealed) {
      zoomStoryPill.hidden = true;
      return;
    }
    const def = zoomedCard.def;
    const petId = appStore && appStore.activePetId === "yutu" ? "yutu" : "koi";
    const story = (def.stories && (def.stories[petId] || def.stories.yutu || def.stories.koi)) || def.story || def.trait;
    zoomStoryName.textContent = def.name;
    zoomStoryTag.textContent = def.tag;
    zoomStoryText.textContent = story;
    zoomStoryPill.hidden = false;
  }

  function updateDockButtons() {
    if (stageState !== "spread") return;
    const unrevealed = cards.filter((c) => !c.revealed);
    const isFree = Store.canOpenFreeHoloPack(appStore);
    if (unrevealed.length > 0) {
      flipAllBtn.hidden = false;
      flipAllBtn.textContent = `一键翻开 (${unrevealed.length})`;
      againBtn.hidden = false;
      againBtn.classList.remove("primary");
      againBtn.classList.add("secondary");
    } else {
      flipAllBtn.hidden = true;
      againBtn.hidden = false;
      againBtn.classList.remove("secondary");
      againBtn.classList.add("primary");
      gestureHint.textContent = "轻触卡牌可 3D 放大赏玩并阅读小物件故事";
      gestureHint.classList.remove("hidden");
    }
    againBtn.textContent = isFree ? "再拆一袋 (免费)" : `再拆一袋 (${Store.HOLO_PACK_STAR_COST}✦)`;
  }

  function flipCard(cardObj, opts) {
    if (!cardObj || cardObj.revealed) return;
    const silentBanner = opts && opts.silentBanner;
    cardObj.revealed = true;
    cardObj.flippedAt = clockSec;
    cardObj.el.classList.remove("unrevealed");
    cardObj.el.classList.add("revealed");

    const def = cardObj.def;
    const rank = (TIER_META[def.rarity] && TIER_META[def.rarity].rank) || 1;

    // 实时落盘解锁小物件或重复返星
    appStore = loadLatestStore();
    const res = Store.settleHoloPackCard(appStore, def.id, {
      petId: appStore.activePetId || "koi",
      source: "holo_pack"
    });
    saveStore(appStore);
    updateHud();
    notifyParentComplete({ newlyUnlocked: !!res.isNew, keepsakeId: def.id });

    if (cardObj.newBadgeEl) {
      if (res.isNew) {
        cardObj.newBadgeEl.textContent = "NEW · 已入柜";
        cardObj.newBadgeEl.classList.remove("is-refund");
        cardObj.newBadgeEl.hidden = false;
      } else if (res.refundStars > 0) {
        cardObj.newBadgeEl.textContent = `已有 · +${res.refundStars}✦`;
        cardObj.newBadgeEl.classList.add("is-refund");
        cardObj.newBadgeEl.hidden = false;
      }
    }

    cardObj.el.setAttribute("aria-label", `${def.name}，${def.rarityLabel}。点击可 3D 放大阅读故事。`);
    cardObj.flip.configure(rank >= 4 ? 0.56 : 0.44, 0.25);
    cardObj.flip.to = 0;

    if (!prefersReducedMotion) {
      cardObj.pose.z.v += rank >= 4 ? 500 : 260;
      cardObj.pose.y.v -= rank >= 4 ? 230 : 125;
    } else {
      cardObj.flip.x = 0;
      cardObj.el.classList.add("front-visible");
    }

    sound.call("cardFlip", def.rarity, cardObj.slot);
    spawnFlipBurst(cardObj);
    triggerStageImpact(def.rarity);

    if (!silentBanner && rank >= 5) {
      showPullBanner(
        "PRAYER COLLECTION",
        res.isNew ? `祈愿典藏入柜 · ${def.name}` : `重逢祈愿典藏 · ${def.name} (+${res.refundStars}✦)`
      );
    }

    updateDockButtons();
  }

  function spawnPackCards() {
    zoomedCard = null;
    syncZoomStoryUI();

    const entries = currentPackRoll.entries;
    const maxTearY = Math.max(...tearVertices.map((q) => q[1]));

    cards = entries.map((entry, idx) => {
      const def = entry.def;
      const meta = TIER_META[def.rarity] || TIER_META.common;
      const el = document.createElement("div");
      el.className = `card rarity-${def.rarity} unrevealed`;
      el.style.setProperty("--card-frame-bg", def.frameBg);
      el.style.setProperty("--card-plaque-bg", def.plaqueBg);
      el.style.setProperty("--card-edge-color", def.edgeColor);
      el.style.setProperty("--card-text-color", def.textColor);
      el.style.setProperty("--card-window-bg", def.windowBg);
      el.style.setProperty("--aura-color", meta.aura);
      el.innerHTML = buildCardMarkup(def);
      el.setAttribute("role", "button");
      el.setAttribute("aria-label", "未翻开的小物件全息卡，轻触翻开。");
      el.style.zIndex = String(entries.length - idx);
      el.tabIndex = 0;

      const cardObj = {
        el,
        def,
        idx,
        slot: idx, // 0, 1, 2 (2 is highest rarity grand reveal)
        faceEl: el.querySelector(".card-face"),
        newBadgeEl: el.querySelector(".new-badge"),
        phase: "inside",
        revealed: false,
        frontShown: false,
        flippedAt: -10,
        autoFlipScheduled: false,
        hovered: false,
        wasHovered: false,
        hx: 0.5,
        hy: 0.5,
        touchHoldUntil: 0,
        flip: new SpringValue(180, 0.46, 0.24),
        pose: createSpringGroup(
          {
            x: packPose.x.x,
            y: packPose.y.x + packHeight * ((maxTearY + 39.0) / 100 - 0.5),
            z: 3.5 - idx * 1.75,
            rx: 0,
            ry: 0,
            rz: packPose.rz.x,
            s: 0.94
          },
          0.55,
          0.22
        )
      };

      el.addEventListener("click", (e) => {
        if (cardObj.phase !== "fanned") return;
        e.stopPropagation();
        if (!cardObj.revealed) {
          flipCard(cardObj);
          return;
        }
        if (clockSec - cardObj.flippedAt < 0.24) return;
        sound.call("click");
        zoomedCard = zoomedCard === cardObj ? null : cardObj;
        syncZoomStoryUI();
      });

      return cardObj;
    });

    for (const c of cards.slice().reverse()) scene.append(c.el);

    if (prefersReducedMotion) {
      for (const c of cards) {
        c.phase = "fanned";
        c.fan = computeFanSlot(c);
        c.el.classList.add("settled");
        for (const [k, val] of Object.entries(c.fan)) {
          c.pose[k].x = c.pose[k].to = val;
        }
        if (TIER_META[c.def.rarity] && TIER_META[c.def.rarity].autoFlip) {
          flipCard(c, { silentBanner: true });
        }
      }
    }
  }

  function scheduleCardAutoFlipIfCommon(c) {
    if (c.autoFlipScheduled) return;
    c.autoFlipScheduled = true;
    if (TIER_META[c.def.rarity] && TIER_META[c.def.rarity].autoFlip) {
      setTimeout(() => {
        if (cards.includes(c) && !c.revealed) flipCard(c, { silentBanner: true });
      }, 120 + c.slot * 90);
    }
  }

  function beginCardOrbit() {
    orbitStartedAt = clockSec;
    scene.classList.add("flat");
    sound.call("swirl", ORBIT_DURATION);

    for (const c of cards) {
      const p = c.pose;
      const f = (c.fan = computeFanSlot(c));
      Object.assign(c, {
        phase: "orbit",
        orbitStart: clockSec + c.idx * 0.04,
        startX: p.x.x,
        startY: p.y.x,
        ejectVy: p.y.v,
        startRz: p.rz.x,
        ringAngle: (-c.slot * 2 * Math.PI) / cards.length,
        endAngle: Math.PI / 2 - (c.slot - (cards.length - 1) / 2) * 0.65
      });
      c.landAt = c.orbitStart + ORBIT_DURATION;
      p.s.to = f.s;
      for (const k of Object.keys(p)) {
        if (k !== "s") p[k].k = p[k].c = p[k].v = 0;
      }
    }
  }

  function stepCardOrbit(c) {
    const p = c.pose;
    const f = c.fan;
    const u = clamp((clockSec - c.orbitStart) / ORBIT_DURATION, 0, 1);
    const easeTurn = 1 - Math.pow(1 - u, 2);
    const blendFan = smoothStep(0.5, 1, u);
    const ringWeight = Math.sin(Math.min(1, u / 0.42) * (Math.PI / 2)) * (1 - blendFan);

    const angle = c.endAngle + (1 - easeTurn) * (c.ringAngle - c.endAngle + Math.PI * 2.2);
    const sinA = Math.sin(angle);
    const cosA = Math.cos(angle);
    const radiusX = Math.min(window.innerWidth * 0.3, 360);
    const decelY = c.startY + (c.ejectVy / 9) * (1 - Math.exp(-9 * Math.max(0, clockSec - c.orbitStart)));
    const centerY = decelY + (-window.innerHeight * 0.02 - decelY) * smoothStep(0, 0.42, u);

    p.x.x = c.startX * (1 - blendFan) + f.x * blendFan + cosA * radiusX * ringWeight;
    p.y.x = centerY * (1 - blendFan) + f.y * blendFan + sinA * radiusX * 0.2 * ringWeight;
    p.z.x = f.z * blendFan + sinA * 260 * ringWeight;
    p.rz.x = c.startRz * (1 - blendFan) + f.rz * blendFan - cosA * 8 * ringWeight;
    p.ry.x = -cosA * 26 * ringWeight;
    p.rx.x = 7 * ringWeight;

    if (u === 1) {
      c.phase = "fanned";
      c.el.classList.add("settled");
      for (const k of Object.keys(p)) p[k].configure(0.5, 0.22);
      sound.call("cardLand", c.slot);
      scheduleCardAutoFlipIfCommon(c);
    }
  }

  function hitTestHoveredCard() {
    if (zoomedCard) {
      const cardW = packWidth * 0.86 * 1.3;
      const cardH = cardW * 1.4;
      zoomedCard.hx = clamp((pointer.x - window.innerWidth / 2) / cardW + 0.5, 0, 1);
      zoomedCard.hy = clamp((pointer.y - window.innerHeight * 0.42) / cardH + 0.5, 0, 1);
      return zoomedCard;
    }

    let picked = null;
    for (const c of cards) {
      if (c.phase !== "fanned") continue;
      const f = c.fan;
      const persp = 1400 / (1400 - f.z);
      const rad = (f.rz * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const w = packWidth * 0.86 * f.s * persp;
      const h = w * 1.4;
      const dx = pointer.x - (window.innerWidth / 2 + f.x * persp);
      const dy = pointer.y - (window.innerHeight * 0.42 + (window.innerHeight * 0.08 + f.y) * persp);
      const hx = (dx * cos + dy * sin) / w + 0.5;
      const hy = (dy * cos - dx * sin) / h + 0.5;
      if (hx >= 0 && hx <= 1 && hy >= 0 && hy <= 1 && (!picked || f.z >= picked.fan.z)) {
        picked = c;
        c.hx = hx;
        c.hy = hy;
      }
    }
    return picked;
  }

  /* ---------- 检查拆袋资格 & 准备新礼袋 ---------- */
  function canAffordNextPack() {
    appStore = loadLatestStore();
    if (Store.canOpenFreeHoloPack(appStore)) return { ok: true, free: true, missing: 0 };
    const bal = Math.max(0, Math.floor(Number(appStore.companion && appStore.companion.starBalance || 0)));
    if (bal >= Store.HOLO_PACK_STAR_COST) return { ok: true, free: false, missing: 0 };
    return { ok: false, free: false, missing: Store.HOLO_PACK_STAR_COST - bal };
  }

  function enterFreshPack() {
    stageState = "enter";
    zoomedCard = null;
    syncZoomStoryUI();
    pullBanner.hidden = true;

    appStore = loadLatestStore();
    const candidates = PACK_THEMES.filter((t) => t !== currentTheme);
    currentTheme = candidates[Math.floor(rand(0, candidates.length))];

    currentPackRoll = Config.rollEggBabePack({
      pool: CARD_POOL,
      unlockedIds: (appStore.curioCabinet && appStore.curioCabinet.unlockedIds) || [],
      pityCount: Number(appStore.companion && appStore.companion.holoPackPityCount || 0)
    });

    pack.style.setProperty("--pack-color", currentTheme.color);
    pack.style.setProperty("--pack-highlight", currentTheme.highlight);
    pack.style.setProperty("--pack-shadow", currentTheme.shadow);
    editionTag.textContent = currentTheme.name;
    randomizeFoilShading(pack.style);
    generateTearLine();
    updateHud();

    gestureHint.classList.remove("hidden");
    shakeBtn.hidden = false;
    flipAllBtn.hidden = true;
    againBtn.hidden = true;

    for (const f of pouchFaces) f.style.clipPath = "";
    bodyLip.style.clipPath = "";
    for (const seg of stripSegments) {
      seg.el.hidden = true;
      seg.locked = false;
      seg.el.style.transform = "";
    }
    for (const g of gussetSlices) g.el.style.top = g.defaultTop + "%";

    tearFlap.className = "tear-flap";
    tearFlap.style.transform = "";
    lightJet.style.cssText = "";
    pack.style.visibility = "";
    jetAnchor.style.visibility = "";
    pack.classList.remove("tearing", "tugging");
    scene.classList.remove("flat");

    initLightJet();
    if (!prefersReducedMotion) {
      preloadConfettiPool(currentPackRoll.hitSecret);
      sound.call("packArrive");
    }

    grabZone.disabled = false;
    packFall = null;
    stripFlight = null;
    dragSession = null;
    orbitStartedAt = 0;
    tearState.prevP = 0;
    tearState.dir = 1;

    for (const s of [tearState.p, tearState.zAngle, tearState.xAngle, squeezeSpring, jetGlowSpring, ...Object.values(packPose)]) {
      s.x = s.to = s.v = 0;
    }
    for (const s of Object.values(packPose)) s.configure(0.7, 0.28);

    if (!prefersReducedMotion) {
      packPose.x.x = window.innerWidth * 0.56;
      packPose.y.x = -46;
      packPose.ry.x = -190;
      packPose.rz.x = 14;
    }

    clearTimeout(enterTimer);
    enterTimer = setTimeout(() => {
      stageState = "idle";
    }, prefersReducedMotion ? 0 : 850);
  }

  function activateTearingFeedback() {
    gestureHint.classList.add("hidden");
    shakeBtn.hidden = true;
    packAura.classList.remove("active");
    tearFlap.classList.add("visible");
    pack.classList.remove("tugging");
    pack.classList.add("tearing");
  }

  function autoCompleteTear(responseSec) {
    tearState.p.configure(responseSec);
    tearState.p.to = 1;
    tearState.zAngle.to = rand(14, 28);
    tearState.xAngle.to = -rand(20, 42);
  }

  function triggerPackBurst() {
    if (dragSession && grabZone.hasPointerCapture(dragSession.id)) {
      grabZone.releasePointerCapture(dragSession.id);
    }

    // 扣费或消耗今日免费首袋
    appStore = loadLatestStore();
    const charged = Store.chargeHoloPackOpen(appStore, {
      petId: appStore.activePetId || "koi"
    });
    if (!charged.ok) {
      showToast(`星星还差 ${charged.missing}✦，去玩「一起画」或「蛋宝宝牧场」赚星星吧`);
      enterFreshPack();
      return;
    }
    appStore.companion.holoPackPityCount = currentPackRoll.hitSecret
      ? 0
      : Math.max(0, Number(appStore.companion.holoPackPityCount || 0)) + 1;
    saveStore(appStore);
    updateHud();
    notifyParentComplete({ packOpened: true, free: charged.free });

    stageState = "open";
    openedAtSec = clockSec;
    dragSession = null;
    shakeBtn.hidden = true;
    packAura.classList.remove("active");

    tearState.p.x = tearState.p.to = 1;
    updateTearClips(1);
    grabZone.disabled = true;

    liveStatus.textContent = "拾物伴手礼袋已拆开，轻触闪光卡背揭晓 3 张小物件。";
    packPose.rx.configure(0.3);
    packPose.ry.configure(0.3);
    packPose.rx.to = 0;
    packPose.ry.to = 0;

    if (prefersReducedMotion) {
      pack.style.visibility = "hidden";
      jetAnchor.style.visibility = "hidden";
      tearFlap.className = "tear-flap";
    } else {
      stripFlight = {
        x: 0,
        y: 0,
        vx: tearState.dir * 240,
        vy: -1820,
        rz: tearState.zAngle.x,
        vrz: 500,
        rx: tearState.xAngle.x,
        vrx: -300
      };
      packPose.y.v += 310;
      packPose.rz.v -= tearState.dir * 38;
      launchConfetti();

      const [mx, my] = stageToScreen(packPose.x.x, packPose.y.x - packHeight * 0.34, 20);
      shockRings.push(
        { x: mx, y: my, r0: packWidth * 0.22, r1: packWidth * 1.32, age: 0, life: 0.45, color: currentPackRoll.hitSecret ? "#f5d376" : "#9db65b", width: 4 },
        { x: mx, y: my, r0: packWidth * 0.18, r1: packWidth * 1.58, age: -0.05, life: 0.5, color: "#f4b9ae", width: 2.6 }
      );
      emitScreenSparks(mx, my, {
        count: isCoarsePointer ? 22 : 38,
        colors: ["#f5d376", "#ffffff", "#9db65b", "#f4b9ae"],
        speedMin: 160,
        speedMax: 580,
        gravity: 520
      });
      triggerStageImpact(currentPackRoll.hitSecret ? "secret" : "ultra");
    }

    spawnPackCards();
    sound.call("setRip", 0);
    sound.call("burst", currentPackRoll.hitSecret);
  }

  /* ---------- 指针与横扫交互 ---------- */
  shakeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    shakePackPeek();
  });

  flipAllBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    sound.call("click");
    const pending = cards
      .filter((c) => !c.revealed)
      .sort((a, b) => (TIER_META[a.def.rarity]?.rank || 1) - (TIER_META[b.def.rarity]?.rank || 1));
    pending.forEach((c, idx) => {
      setTimeout(() => {
        if (cards.includes(c) && !c.revealed) flipCard(c);
      }, idx * 150);
    });
  });

  grabZone.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || dragSession) return;
    if (stageState === "enter") {
      clearTimeout(enterTimer);
      stageState = "idle";
      squeezeSpring.v -= 6;
      for (const s of Object.values(packPose)) s.configure(0.28, 0.25);
    }
    if (stageState !== "idle") return;

    const afford = canAffordNextPack();
    if (!afford.ok) {
      sound.call("boing");
      squeezeSpring.v += 9;
      showToast(`星星还差 ${afford.missing}✦，去「一起画」或「蛋宝宝牧场」赚星星吧`);
      return;
    }

    grabZone.setPointerCapture(e.pointerId);
    sound.call("grab");
    dragSession = {
      id: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      p0: tearState.p.to,
      moved: false,
      dy: 0,
      steer: 0
    };
  });

  grabZone.addEventListener("pointermove", (e) => {
    if (!dragSession || e.pointerId !== dragSession.id || stageState !== "idle") return;
    if (e.pointerType === "mouse" && !e.buttons) {
      endDrag(e);
      return;
    }

    const dx = e.clientX - dragSession.x0;
    let dy = e.clientY - dragSession.y0;

    if (!dragSession.moved) {
      if (Math.hypot(dx, dy) < 6) return;
      dragSession.moved = true;
      tearState.p.configure(0.1);
      pack.classList.add("tugging");
    }

    if (tearState.p.to === 0) {
      dragSession.dy = dy;
      if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy) * 0.5) return;
      tearState.dir = dx < 0 ? -1 : 1;
      dragSession.y0 = e.clientY;
      dy = 0;
    }

    activateTearingFeedback();
    const deltaP = (dragSession.p0 ? Math.abs(dx) : dx * tearState.dir) / (packWidth * 0.85);
    tearState.p.to = clamp(dragSession.p0 + deltaP, tearState.p.to, 1);
    tearState.zAngle.to = 6 + tearState.p.to * 14 + clamp(-dy * 0.16, -6, 22);
    tearState.xAngle.to = -(8 + tearState.p.to * 22) - clamp(-dy * 0.2, 0, 24);

    const targetSteer = clamp(dy / Math.max(60, Math.abs(dx)), -0.7, 0.7) * (packWidth / packHeight);
    dragSession.steer += (targetSteer - dragSession.steer) * 0.3;
    steerRemainingTear(dragSession.steer, tearState.p.x, tearState.dir);
  });

  function endDrag(e) {
    if (!dragSession || (e && e.pointerId !== undefined && e.pointerId !== dragSession.id)) return;
    didDragMove = dragSession.moved;
    dragSession = null;
    if (!didDragMove || stageState !== "idle") return;

    if (tearState.p.to > 0.54) {
      autoCompleteTear(0.18);
      return;
    }
    sound.call(pack.classList.contains("tearing") ? "relief" : "boing");
    pack.classList.remove("tearing", "tugging");
    tearState.zAngle.to = 3 + tearState.p.to * 10;
    tearState.xAngle.to = -tearState.p.to * 14;
  }

  ["pointerup", "pointercancel", "lostpointercapture"].forEach((evt) => {
    grabZone.addEventListener(evt, endDrag);
  });

  grabZone.addEventListener("click", (e) => {
    if (didDragMove && e.detail) {
      didDragMove = false;
      return;
    }
    if (stageState !== "idle") return;
    const afford = canAffordNextPack();
    if (!afford.ok) {
      sound.call("boing");
      showToast(`星星还差 ${afford.missing}✦，去「一起画」或「蛋宝宝牧场」赚星星吧`);
      return;
    }
    if (!tearState.p.to) tearState.dir = Math.random() < 0.5 ? -1 : 1;
    activateTearingFeedback();
    autoCompleteTear(tearState.p.to ? 0.18 : 0.5);
  });

  window.addEventListener("click", () => {
    if (zoomedCard) {
      zoomedCard = null;
      syncZoomStoryUI();
    }
  });

  window.addEventListener("pointermove", (e) => {
    const vx = Math.abs(e.clientX - pointer.prevX);
    pointer.prevX = e.clientX;
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.inside = true;
    pointer.isTouch = e.pointerType !== "mouse";

    if (stageState === "idle" && !dragSession && tearState.p.to === 0) {
      if (vx > 34) {
        pointerShakeEnergy += vx;
        if (pointerShakeEnergy > 290) {
          pointerShakeEnergy = 0;
          shakePackPeek();
        }
      }
    }

    if (stageState === "spread" && pointer.down && !zoomedCard) {
      const hit = hitTestHoveredCard();
      if (hit && hit.phase === "fanned" && !hit.revealed) {
        flipCard(hit);
      }
    }
  });

  window.addEventListener("pointerdown", (e) => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.prevX = e.clientX;
    pointer.inside = true;
    pointer.down = true;
    pointer.isTouch = e.pointerType !== "mouse";
    pointer.tapped = true;
  });

  window.addEventListener("pointerup", () => { pointer.down = false; });
  window.addEventListener("pointercancel", () => { pointer.down = false; });
  document.documentElement.addEventListener("pointerleave", () => {
    pointer.inside = false;
    pointer.down = false;
  });

  window.addEventListener("resize", () => {
    if (!window.innerWidth || !window.innerHeight) return;
    measureStage();
    fitLightJetBounds();
    if (stageState === "idle" && tearState.p.x > 0) updateTearClips(Math.min(1, tearState.p.x));
    for (const c of cards) {
      if (c.fan) c.fan = computeFanSlot(c);
    }
  });

  againBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const afford = canAffordNextPack();
    if (!afford.ok) {
      sound.call("boing");
      showToast(`星星还差 ${afford.missing}✦，去「一起画」或「蛋宝宝牧场」赚星星吧`);
      return;
    }
    sound.call("click");
    for (const c of cards) c.el.remove();
    cards = [];
    zoomedCard = null;
    syncZoomStoryUI();
    flipAllBtn.hidden = true;
    againBtn.hidden = true;
    enterFreshPack();
  });

  /* ---------- 240Hz 物理主渲染循环 ---------- */
  function tick(nowMs) {
    const dt = Math.min(0.05, (nowMs - lastFrameMs) / 1000);
    lastFrameMs = nowMs;
    clockSec += dt;
    pointerShakeEnergy *= Math.exp(-dt * 4.5);

    const motionScale = prefersReducedMotion ? 0 : 1;
    const isBeingTorn = pack.classList.contains("tearing");
    const verticalTug = motionScale && dragSession && dragSession.moved && !tearState.p.to
      ? Math.sign(dragSession.dy) * 160 * (1 - 1 / (1 + Math.abs(dragSession.dy) / 160))
      : 0;

    squeezeSpring.to = verticalTug ? -Math.abs(verticalTug) / 90 : isBeingTorn && stageState === "idle" ? motionScale : 0;

    if (stageState === "enter" || stageState === "idle") {
      const dragDamp = dragSession && dragSession.moved ? 0.25 : 1;
      const tiltFactor = dragDamp * (prefersReducedMotion ? 0.5 : 1);
      const nx = pointer.inside ? clamp((pointer.x / window.innerWidth) * 2 - 1, -1, 1) : 0;
      const ny = pointer.inside ? clamp((pointer.y / window.innerHeight) * 2 - 1, -1, 1) : 0;

      packPose.y.to = Math.sin(clockSec * 1.4) * 6 * motionScale + verticalTug;
      packPose.ry.to = nx * 20 * tiltFactor;
      packPose.rx.to = -ny * 15 * tiltFactor - squeezeSpring.x * 6;
      packPose.rz.to = Math.sin(clockSec * 0.9) * 1.5 * motionScale - (isBeingTorn && tearState.p.x > 0 ? tearState.dir * tearState.p.x * 3 : 0);

      if (stageState === "idle" && !dragSession && tearState.p.to < 1 && motionScale && clockSec > nextIdleNudgeSec) {
        packPose.rz.v += (Math.random() < 0.5 ? -1 : 1) * 62;
        nextIdleNudgeSec = clockSec + rand(4.4, 7.2);
      }
    }

    const allSprings = [
      ...Object.values(packPose),
      tearState.p,
      tearState.zAngle,
      tearState.xAngle,
      squeezeSpring,
      jetGlowSpring,
      ...jetRibbons.map((r) => r.growth),
      ...cards.flatMap((c) => [...Object.values(c.pose), c.flip])
    ];
    const substeps = Math.max(1, Math.ceil(dt * 240));
    const subDt = dt / substeps;
    for (let s = 0; s < substeps; s++) {
      for (const sp of allSprings) sp.step(subDt);
    }

    if (stageState === "idle" && tearState.p.x > 0) {
      const p = Math.min(1, tearState.p.x);
      const dp = p - tearState.prevP;
      tearState.prevP = p;

      sound.call("setRip", dp > 0 ? Math.pow(dp / Math.max(dt, 0.004) / 4, 0.6) : 0);

      if (dp > 0 && motionScale) {
        packPose.rz.v += rand(-1, 1) * Math.min(dp, 0.02) * 840;
        packPose.y.v += dp * 390;
        tearState.zAngle.v += dp * 280;
        squeezeSpring.v += dp * 18;
        for (const b of jetRibbons) if (b.active) b.growth.v += dp * 6;

        sparkCarry += dp * 42;
        const emitCount = Math.min(5, Math.floor(sparkCarry));
        if (emitCount > 0) {
          sparkCarry -= emitCount;
          const tipX = tearState.dir > 0 ? p * 100 : 100 - p * 100;
          const tipY = tearYAt(tipX);
          const [wx, wy, wz] = packLocalToStage(tipX, tipY, 8);
          const [sx, sy] = stageToScreen(wx, wy, wz);
          emitScreenSparks(sx, sy, {
            count: emitCount,
            colors: ["#ffffff", "#f5d376", "#f4b9ae", "#9db65b"],
            speedMin: 70,
            speedMax: 240,
            gravity: 620,
            lifeMin: 0.18,
            lifeMax: 0.42
          });
        }
      }

      if (dp > 0 || Math.abs(tearState.p.v) > 0.001) {
        updateTearClips(p);
      }

      const breeze = dragSession ? 0 : motionScale * (Math.sin(clockSec * 5.3) + Math.sin(clockSec * 8.7) * 0.5);
      tearFlap.style.transform = `rotateZ(${(tearState.zAngle.x + breeze) * tearState.dir}deg) rotateX(${tearState.xAngle.x + breeze * 1.5}deg)`;

      if (p > 0.985 && tearState.p.to >= 1) {
        triggerPackBurst();
      }
    }

    jetGlowSpring.to = (stageState === "idle" && tearState.p.x > 0) || ((stageState === "open" || stageState === "spread") && !prefersReducedMotion && !jetDrained) ? 1 : 0;
    if (jetGlowSpring.x > 0.003 || jetGlowSpring.to) {
      lightJet.style.opacity = jetGlowSpring.x.toFixed(3);
      stepLightJet(dt);
    }

    if (stripFlight) {
      stripFlight.vy += 2600 * dt;
      stripFlight.x += stripFlight.vx * dt;
      stripFlight.y += stripFlight.vy * dt;
      stripFlight.rz += stripFlight.vrz * dt;
      stripFlight.rx += stripFlight.vrx * dt;
      tearFlap.style.transform = `translate3d(${stripFlight.x}px, ${stripFlight.y}px, 0) rotateZ(${stripFlight.rz * tearState.dir}deg) rotateX(${stripFlight.rx}deg)`;
      if (clockSec - openedAtSec > 1.55) {
        stripFlight = null;
        tearFlap.className = "tear-flap";
      }
    }

    if (stageState === "open" && !packFall && !prefersReducedMotion && clockSec - openedAtSec > 0.02) {
      packFall = { y: 0, v: (1500 * packHeight) / 420 };
    }
    if (packFall && packFall.y < window.innerHeight) {
      packFall.v += 2800 * dt;
      packFall.y += packFall.v * dt;
      packPose.rz.to = tearState.dir * 9;
    }

    if (pack.style.visibility !== "hidden") {
      const fallY = packFall ? packFall.y : 0;
      pack.style.transform =
        `translate3d(${packPose.x.x}px, ${packPose.y.x + fallY}px, 0) ` +
        `rotateX(${packPose.rx.x}deg) rotateY(${packPose.ry.x}deg) rotateZ(${packPose.rz.x}deg) ` +
        `scale3d(${1 + 0.03 * squeezeSpring.x}, ${1 - 0.06 * squeezeSpring.x}, 1)`;

      if (!packFall) {
        pack.style.setProperty("--glint-x", clamp(-packPose.ry.x * 0.12, -1.5, 3).toFixed(2));
        pack.style.setProperty("--glint-op", clamp(0.8 - packPose.ry.x * 0.012, 0.45, 1).toFixed(2));
        pack.style.setProperty("--shine-pos", clamp(50 + packPose.ry.x * 1.2, 20, 80).toFixed(1));
        pack.style.setProperty("--shine-op", clamp(0.85 + packPose.rx.x * 0.015, 0.5, 1).toFixed(2));
      }
      if (fallY > window.innerHeight) pack.style.visibility = "hidden";
    }

    if (!packFall) {
      jetAnchorFrozen = { y: packPose.y.x, rx: packPose.rx.x, ry: packPose.ry.x, rz: packPose.rz.x, sq: squeezeSpring.x };
      jetAnchor.style.transform = pack.style.transform;
    } else if (Math.abs(jetAnchorFrozen.rz) + Math.abs(jetAnchorFrozen.rx) + Math.abs(jetAnchorFrozen.sq) > 0.01) {
      const decay = Math.exp(-dt / 0.05);
      jetAnchorFrozen.rz *= decay;
      jetAnchorFrozen.rx *= decay;
      jetAnchorFrozen.ry *= decay;
      jetAnchorFrozen.sq *= decay;
      jetAnchor.style.transform =
        `translate3d(${packPose.x.x}px, ${jetAnchorFrozen.y}px, 0) ` +
        `rotateX(${jetAnchorFrozen.rx}deg) rotateY(${jetAnchorFrozen.ry}deg) rotateZ(${jetAnchorFrozen.rz}deg) ` +
        `scale3d(${1 + 0.03 * jetAnchorFrozen.sq}, ${1 - 0.06 * jetAnchorFrozen.sq}, 1)`;
    }

    groundShadow.style.transform = `translate3d(${packPose.x.x}px, ${packHeight / 2 + 24}px, 0) scale(${1 - packPose.y.x / 300})`;
    groundShadow.style.opacity = String(
      stageState === "enter" || stageState === "idle"
        ? clamp(1 - Math.abs(packPose.x.x) / 300, 0, 1)
        : packFall
          ? clamp(1 - packFall.y / 160, 0, 1)
          : 0
    );

    if (stageState === "open" && !orbitStartedAt && prefersReducedMotion) {
      orbitStartedAt = clockSec;
      scene.classList.add("flat");
    }
    if (stageState === "open" && !orbitStartedAt && !prefersReducedMotion && cards.length && cards.every((c) => c.phase === "ejected")) {
      const mouthY = packPose.y.x + (packFall ? packFall.y : 0) + packHeight * (Math.max(...tearVertices.map((q) => q[1])) / 100 - 0.5);
      const cardHeightApprox = packWidth * 1.2;
      if (cards.every((c) => c.pose.y.x + cardHeightApprox * 0.36 < mouthY)) {
        beginCardOrbit();
      }
    }

    for (const c of cards) {
      if (c.phase === "orbit") stepCardOrbit(c);
    }

    [...cards].sort((a, b) => a.pose.z.x - b.pose.z.x).forEach((c, rankIdx) => {
      c.depthRank = rankIdx + 1;
    });

    const hoveredTarget = (pointer.inside || pointer.tapped) ? hitTestHoveredCard() : null;
    const isPortraitLayout = window.innerHeight > window.innerWidth * 1.12;
    pointer.tapped = false;

    for (const c of cards) {
      const p = c.pose;
      const sinceOpen = clockSec - openedAtSec;

      if (c.phase === "inside" && !prefersReducedMotion && sinceOpen > c.idx * 0.028) {
        c.phase = "ejected";
        p.s.to = 1;
        p.y.k = 0;
        p.y.c = 1.2;
        p.y.v = (-rand(1240, 1420) * packHeight) / 420;
      }

      if (!c.frontShown && c.flip.x < 90) {
        c.frontShown = true;
        c.el.classList.add("front-visible");
      }

      if (c.phase === "fanned") {
        const isZoomed = zoomedCard === c;
        if (c === hoveredTarget) c.touchHoldUntil = clockSec + (pointer.isTouch ? 1.1 : 0);
        const active = isZoomed || c === hoveredTarget || clockSec < c.touchHoldUntil;
        c.hovered = active;

        if (active !== c.wasHovered) {
          c.wasHovered = active;
          c.el.classList.toggle("hovered", active);
          if (active) {
            if (!c.revealed && (TIER_META[c.def.rarity]?.rank || 1) >= 3) {
              sound.call("cardTease", c.def.rarity, c.slot);
            } else {
              sound.call("cardHover", c.slot);
            }
          }
        }

        const f = c.fan;
        const idleWave = clockSec * 0.8 + c.idx * 1.9;
        const suspenseTremor = !c.revealed && active && motionScale && (TIER_META[c.def.rarity]?.rank || 1) >= 3
          ? Math.sin(clockSec * 40) * 1.1
          : 0;

        if (isZoomed) {
          p.x.to = 0;
          p.y.to = -window.innerHeight * 0.08;
          p.z.to = 240;
          p.rz.to = 0;
          p.s.to = Math.min(1.26, (window.innerWidth * 0.72) / (packWidth * 0.86));
          p.rx.to = (0.5 - c.hy) * 30;
          p.ry.to = (c.hx - 0.5) * 34;
        } else if (zoomedCard) {
          p.x.to = f.x * 1.06;
          p.y.to = f.y + 18;
          p.z.to = f.z - 80;
          p.rz.to = f.rz;
          p.s.to = f.s * 0.9;
          p.rx.to = 0;
          p.ry.to = 0;
        } else {
          const tiltSign = c.revealed ? 1 : -1;
          p.x.to = f.x;
          p.s.to = f.s;
          p.y.to = f.y + (active ? -14 : Math.sin(idleWave * 1.2) * 4 * motionScale);
          p.z.to = f.z + (active ? 95 : 0);
          p.rz.to = (active ? f.rz * 0.3 : f.rz) + suspenseTremor;
          p.rx.to = active ? (0.5 - c.hy) * 28 : Math.cos(idleWave * 0.9) * 3.5 * motionScale;
          p.ry.to = active ? (c.hx - 0.5) * 32 * tiltSign : Math.sin(idleWave) * 7 * motionScale;
        }
      }

      const isFree = c.phase === "fanned" || c.phase === "orbit";
      const rx = isFree ? p.rx.x - clamp(p.y.v * 0.006, -8, 8) : packPose.rx.x;
      const tiltRy = isFree ? p.ry.x + clamp(p.x.v * 0.008, -12, 12) : packPose.ry.x;
      const totalRy = tiltRy + c.flip.x;

      c.el.style.transform =
        `translate3d(${p.x.x}px, ${p.y.x}px, ${p.z.x}px) ` +
        `rotateZ(${p.rz.x}deg) rotateX(${rx}deg) rotateY(${totalRy}deg) scale(${p.s.x})`;

      if (isFree) {
        c.elevated = zoomedCard === c || (!zoomedCard && (c.hovered || (c.elevated && p.z.x > c.fan.z + 24)));
      }
      c.el.style.zIndex = String(zoomedCard === c ? 20 : c.elevated ? 10 : c.phase === "orbit" || isPortraitLayout ? c.depthRank : cards.length - c.idx);

      if (c.phase === "fanned" && c.frontShown) {
        const nx = clamp(tiltRy / 24, -1, 1);
        const ny = clamp(rx / 24, -1, 1);
        c.faceEl.style.setProperty("--px", (50 + nx * 50).toFixed(1));
        c.faceEl.style.setProperty("--py", (50 - ny * 50).toFixed(1));
        c.faceEl.style.setProperty("--hyp", Math.min(1, Math.hypot(nx, ny)).toFixed(3));
      }
    }

    if (stageState === "open" && orbitStartedAt && clockSec > orbitStartedAt + (prefersReducedMotion ? 0.1 : ORBIT_DURATION + 0.18)) {
      stageState = "spread";
      updateDockButtons();
    }

    if (confettiDirty) {
      ctx2d.setTransform(1, 0, 0, 1, 0, 0);
      ctx2d.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
      confettiDirty = false;
    }

    const dpr = confettiCanvas.width / window.innerWidth;
    const originX = window.innerWidth / 2;
    const originY = window.innerHeight * 0.42;
    const deg = Math.PI / 180;

    if (shockRings.length) {
      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
      shockRings = shockRings.filter((ring) => {
        ring.age += dt;
        if (ring.age < 0) return true;
        const u = ring.age / ring.life;
        if (u >= 1) return false;
        const ease = 1 - Math.pow(1 - u, 3);
        const r = ring.r0 + (ring.r1 - ring.r0) * ease;
        ctx2d.save();
        ctx2d.globalAlpha = Math.pow(1 - u, 1.6) * 0.88;
        ctx2d.strokeStyle = ring.color;
        ctx2d.lineWidth = Math.max(0.5, ring.width * (1 - u * 0.7));
        ctx2d.beginPath();
        ctx2d.arc(ring.x, ring.y, r, 0, Math.PI * 2);
        ctx2d.stroke();
        ctx2d.restore();
        confettiDirty = true;
        return true;
      });
    }

    if (sparkParticles.length) {
      sparkParticles = sparkParticles.filter((sp) => {
        sp.age += dt;
        if (sp.age >= sp.life) return false;
        sp.vy += sp.gravity * dt;
        sp.vx *= 1 - Math.min(0.9, 2.4 * dt);
        sp.x += sp.vx * dt;
        sp.y += sp.vy * dt;
        sp.rot += sp.spin * dt;
        const u = sp.age / sp.life;
        const k = dpr * sp.scale * (1 - u * 0.65);
        const cr = Math.cos(sp.rot);
        const sr = Math.sin(sp.rot);
        ctx2d.setTransform(k * cr, k * sr, -k * sr, k * cr, sp.x * dpr, sp.y * dpr);
        ctx2d.globalAlpha = Math.pow(1 - u, 1.25);
        ctx2d.fillStyle = sp.color;
        ctx2d.fill(STAR_SPARK_PATH);
        ctx2d.globalAlpha = 1;
        confettiDirty = true;
        return true;
      });
    }

    confettiBits = confettiBits.filter((b) => {
      if (b.age === undefined || (b.age += dt) < 0) return true;
      if (b.insidePouch) {
        b.ly -= (b.upSpeed * dt / packHeight) * 100;
        b.rot += b.spin * dt;
        if (b.ly > tearYAt(b.lx)) return true;
        [b.x, b.y, b.z] = packLocalToStage(b.lx, b.ly, b.lz);
        b.insidePouch = false;
        b.age = 0;
        b.rot0 = b.rot;
        b.vx = Math.sin(b.spreadAngle) * b.burstSpeed;
        b.vy = -Math.cos(b.spreadAngle) * b.burstSpeed;
        b.vz = rand(0, 150);
      }

      b.z += b.vz * dt;
      b.vy += 2600 * dt;
      b.vx += (Math.sin(b.phase) * b.flutterAmp + b.driftX) * dt;

      const speed = Math.hypot(b.vx, b.vy);
      const dragFactor = 1 / (1 + b.dragCoeff * Math.min(1, 0.06 + b.age / 0.45) * speed * dt);
      const tumbleRate = 0.35 + speed / 800;

      b.vx *= dragFactor;
      b.vy *= dragFactor;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.rot += b.spin * tumbleRate * dt;
      b.phase += 7 * tumbleRate * dt;

      if (b.y >= window.innerHeight / 2 + 40) return false;

      const persp = 1400 / (1400 - b.z);
      const k = dpr * persp * b.scale;
      const cr = Math.cos(b.rot * deg);
      const sr = Math.sin(b.rot * deg);
      const foreshorten = Math.cos((b.rot - b.rot0) * 0.7 * deg);

      ctx2d.setTransform(
        k * cr, k * sr, -k * sr * foreshorten, k * cr * foreshorten,
        (originX + b.x * persp) * dpr,
        (originY + (window.innerHeight * 0.08 + b.y) * persp) * dpr
      );
      ctx2d.fillStyle = b.color;
      ctx2d.fill(CONFETTI_SHAPES[b.shapeIdx]);
      confettiDirty = true;
      return true;
    });

    requestAnimationFrame(tick);
  }

  measureStage();
  enterFreshPack();
  requestAnimationFrame(tick);
})();
