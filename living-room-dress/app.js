/* ==========================================================================
   蛋宝宝 · 窗边起居室 × 专属试衣台 × 零 Token 明信片合成
   Loads ../assets/shared/catalog.json (24 Yutu sets + 12 Koi sets, PNG-only)
   ========================================================================== */
(function () {
  "use strict";

  const STAGE_W = 1024, STAGE_H = 576;
  const CORK_HOME = { x: 508, y: 408 };
  const RUMMAGE_SPOT = { x: 526, y: 418 };
  const COLS = 30, ROWS = 56, NV = (COLS + 1) * (ROWS + 1);
  const ACC_COLS = 12, ACC_ROWS = 12;

  function sharedUrl(p) {
    return p.startsWith("assets/") ? "../" + p : p;
  }

  const POSTCARD_SCENES = [
    { id: "sunset_meadow", label: "晚霞云朵坡", src: "../assets/shared/png/bgs/bg_sunset_meadow.png", tint: "rgba(255,186,138,0.12)", pose: "tilt", anchorY: 0.865, scaleK: 1.32,
      copy: { yutu: "傍晚路过云朵坡，风把长耳朵吹得软软的。还好出门前换上了你挑的新穿搭，晚霞刚好落在身上。", koi: "顺着晚霞飘到了云朵坡，尾巴尖沾了一点橘子汽水色的光，拍张照寄回书桌给你看～" } },
    { id: "moon_courtyard", label: "桂月亭台夜", src: "../assets/shared/png/bgs/bg_moon_courtyard.png", tint: "rgba(130,158,235,0.13)", pose: "cute", anchorY: 0.865, scaleK: 1.30,
      copy: { yutu: "今晚的月亮又圆又亮，亭子边的桂花落在衣角上啦，偷偷许了个愿带回家。", koi: "夜里的石阶凉丝丝的，踩着月光散步，听见草丛里小虫子在唱歌。" } },
    { id: "mint_room", label: "街角薄荷屋", src: "../assets/shared/png/bgs/bg_mint_room.png", tint: "rgba(195,224,198,0.10)", pose: "jump", anchorY: 0.865, scaleK: 1.30,
      copy: { yutu: "偶遇一间薄荷色的小茶屋！老板夸我今天穿得特别精神，还送了一小块热松饼。", koi: "在薄荷屋窗边躲了一阵太阳，新衣服和这里的复古绿地板超配对不对！" } },
    { id: "lotus_pond", label: "荷灯许愿池", src: "../assets/shared/png/bgs/bg_lotus_pond.png", tint: "rgba(116,190,218,0.12)", pose: "tilt", anchorY: 0.865, scaleK: 1.32,
      copy: { yutu: "水面上漂着一盏盏暖融融的小荷灯，我蹲在岸边看了好久，给你留了一朵最亮的。", koi: "回到熟悉的水边啦！水波一晃一晃把身上的新打扮映得亮晶晶的～" } },
    { id: "studio_desk", label: "起居室定妆", src: "scene/room_empty.png", tint: "rgba(255,224,182,0.08)", pose: "cute", anchorY: 0.855, scaleK: 1.34, crop16x9: true,
      copy: { yutu: "在窗边软木垫试衣台刚换好的新造型！趁咖啡还冒着热气，咔嚓留一张定妆纪念。", koi: "站在阳光晒暖的软木垫上转了个圈，这套新穿搭正式收录进今日份好心情！" } }
  ];

  const STATE_META = {
    free_stand: { icon: "☀️", short: "桌面待机", mood: "在软木垫上晒太阳" },
    fitting: { icon: "🪞", short: "专属试衣间", mood: "正在镜前试新衣" },
    sleep: { icon: "💤", short: "钻被窝睡觉", mood: "窝在小木床里熟睡" },
    drawing: { icon: "🖍️", short: "趴着画画", mood: "握着铅笔认真涂鸦" },
    dress_rummage: { icon: "🧳", short: "翻衣箱臭美", mood: "翻着小衣箱挑穿搭" },
    away: { icon: "📮", short: "外出偶遇中", mood: "穿新衣出门溜达啦" }
  };

  const PATCH_LINES = {
    sleep: ["我把自己卷成小饭团啦…", "枕头批准我再眯五分钟～", "衣服叠在床头啦，呼噜噜…", "被窝里有太阳晒过的味道♡"],
    drawing: ["这朵小云涂什么颜色好呢？", "画了一只穿新衣服的自己！", "点点画纸，把这幅小画送给你！"],
    dress_rummage: ["今天穿哪套出门最好看呢？", "快来帮我搭一套新衣服嘛！"]
  };

  const EMOTE_LINES = {
    yutu: {
      laugh: ["哈哈哈，好痒呀～", "嘿嘿，再来一次！", "笑得耳朵都抖啦"],
      sad: ["呜…胡萝卜掉了", "陪我玩一会儿嘛…"],
      think: ["嗯…今天穿哪套呢？", "窗外有小鸟飞过耶"],
      cute: ["抱抱我嘛～", "这套衣服超合身对吧♡"]
    },
    koi: {
      laugh: ["咕噜噜，笑出泡泡啦！", "哈哈，好运来啦～"],
      sad: ["呜…泡泡破掉了", "摸摸我才能好起来…"],
      think: ["咦？软木垫暖洋洋的", "让我咕噜一下…"],
      cute: ["摸摸我，好运加倍♡", "转个圈给你看新穿搭～"]
    }
  };

  // Per AGENTS.md: NEVER add pink cheek blush on Yutu!
  const FACES = {
    yutu: {
      rect: [230, 425, 620, 680], allowBlush: false,
      eyes: [{ x: 341, y: 553, r: 27, ex: 327, ey: 549, erx: 43, ery: 52 }, { x: 503, y: 554, r: 27, ex: 521, ey: 549, erx: 44, ery: 51 }],
      lookUp: [4, -11], bubbleY: 95
    },
    koi: {
      rect: [156, 252, 506, 532], allowBlush: true, cheeks: [[202, 438], [450, 438]], cheekR: 28,
      eyes: [{ x: 247, y: 371, r: 27, ex: 243, ey: 368, erx: 51, ery: 57 }, { x: 398, y: 371, r: 27, ex: 398, ey: 369, erx: 52, ery: 56 }],
      lookUp: [5, -14], bubbleY: 110
    }
  };

  const SAVE_KEY = "eggbabe-living-room-dress-v2";
  let catalog = null;
  let state = {
    petId: "yutu",
    roomState: "free_stand",
    period: "day",
    stars: 120,
    unreadMail: true,
    owned: {
      yutu: ["set_cozy_knit", "set_moon_palace", "set_rain_frog", "set_barista_bunny"],
      koi: ["set_duck", "set_strawberry_pj", "set_sailor"]
    },
    savedSet: { yutu: "set_cozy_knit", koi: "set_duck" },
    album: []
  };

  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p && typeof p.stars === "number") {
        state.petId = p.petId === "koi" ? "koi" : "yutu";
        state.stars = p.stars;
        if (p.owned) state.owned = Object.assign(state.owned, p.owned);
        if (p.savedSet) state.savedSet = Object.assign(state.savedSet, p.savedSet);
        if (Array.isArray(p.album)) state.album = p.album.slice(0, 12);
      }
    }
  } catch (e) {}

  function persistState() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        petId: state.petId, stars: state.stars, owned: state.owned, savedSet: state.savedSet, album: state.album.slice(0, 10)
      }));
    } catch (e) {}
  }

  let workingSetId = state.savedSet[state.petId];
  let activeFilter = "all";
  let activePostcardSceneId = POSTCARD_SCENES[0].id;
  let currentPostcardData = null;

  const appEl = document.getElementById("app");
  const viewportEl = document.getElementById("viewport");
  const cameraRigEl = document.getElementById("camera-rig");
  const patchImgEl = document.getElementById("patch-img");
  const wallPolaroidEl = document.getElementById("wall-polaroid");
  const wallPolaroidImgEl = document.getElementById("wall-polaroid-img");
  const bedHatPropEl = document.getElementById("bed-hat-prop");
  const tableAccPropEl = document.getElementById("table-acc-prop");
  const patchHeadAccEl = document.getElementById("patch-head-acc");
  const trunkPropEl = document.getElementById("trunk-prop");
  const awayNoteEl = document.getElementById("away-note");
  const deskMirrorPropEl = document.getElementById("desk-mirror-prop");
  const shSoftEl = document.getElementById("pet-shadow-soft");
  const shConEl = document.getElementById("pet-shadow-contact");
  const glCanvas = document.getElementById("gl-pet");
  const actionGlowEl = document.getElementById("scene-action-glow");
  const hitLayerEl = document.getElementById("scene-hit-layer");
  const bubbleEl = document.getElementById("pet-bubble");

  const hudPetNameEl = document.getElementById("hud-pet-name");
  const hudStateIconEl = document.getElementById("hud-state-icon");
  const hudStateLabelEl = document.getElementById("hud-state-label");
  const hudStarCountEl = document.getElementById("hud-star-count");
  const sheetStarCountEl = document.getElementById("sheet-star-count");
  const wakeBtnEl = document.getElementById("wake-to-desk-btn");

  const testerBtnEl = document.getElementById("btn-toggle-tester");
  const testerMenuEl = document.getElementById("tester-menu");
  const testerCurrentLabelEl = document.getElementById("tester-current-label");
  const testerChevronEl = document.getElementById("tester-chevron");

  const envelopeBtnEl = document.getElementById("btn-envelope");
  const envelopeDotEl = document.getElementById("envelope-dot");
  const envelopeHintEl = document.getElementById("envelope-hint");

  const wardrobeTabsEl = document.getElementById("wardrobe-tabs");
  const wardrobeGridEl = document.getElementById("wardrobe-grid");
  const revertBtnEl = document.getElementById("btn-revert-preview");
  const confirmOutfitBtnEl = document.getElementById("btn-confirm-outfit");

  const postcardModalEl = document.getElementById("postcard-modal");
  const postcardPreviewImgEl = document.getElementById("postcard-preview-img");
  const postcardSceneBarEl = document.getElementById("postcard-scene-bar");
  const postcardStoryTextEl = document.getElementById("postcard-story-text");
  const postcardEyebrowEl = document.getElementById("postcard-eyebrow");
  const collectPostcardBtnEl = document.getElementById("btn-collect-postcard");
  const albumModalEl = document.getElementById("album-modal");
  const albumGridEl = document.getElementById("album-grid");
  const toastEl = document.getElementById("toast");

  let toastTimer = 0;
  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2200);
  }

  let sceneScale = 1;
  function updateViewportScale() {
    const vw = window.innerWidth, vh = window.innerHeight;
    if (vw / Math.max(1, vh) >= 1.3) {
      const pad = vw > 1120 && vh > 660 ? 24 : 0;
      sceneScale = Math.min((vw - pad * 2) / STAGE_W, (vh - pad * 2) / STAGE_H);
      appEl.style.setProperty("--frame-radius", pad > 0 ? "22px" : "0px");
    } else {
      sceneScale = vh / STAGE_H;
      appEl.style.setProperty("--frame-radius", "0px");
    }
    appEl.style.setProperty("--scene-scale", sceneScale.toFixed(4));
  }
  function centerViewportOnDesk(smooth) {
    const maxS = viewportEl.scrollWidth - viewportEl.clientWidth;
    if (maxS <= 4) return;
    viewportEl.scrollTo({ left: Math.max(0, Math.min(maxS, 508 * sceneScale - viewportEl.clientWidth * 0.5)), behavior: smooth ? "smooth" : "auto" });
  }
  viewportEl.addEventListener("scroll", () => {
    const maxS = viewportEl.scrollWidth - viewportEl.clientWidth;
    if (maxS <= 8) return;
    const r = viewportEl.scrollLeft / maxS;
    const idx = r < 0.33 ? 0 : r < 0.68 ? 1 : 2;
    document.querySelectorAll(".pan-dot").forEach((d, i) => d.classList.toggle("active", i === idx));
  });
  window.addEventListener("resize", updateViewportScale);
  updateViewportScale();

  /* ---------- WebGL Full-Body Set & Eye-Shader Engine (Synced with eggbabe-uni) ---------- */
  const DPR = Math.min(2.25, window.devicePixelRatio || 1);
  glCanvas.width = Math.round(STAGE_W * DPR);
  glCanvas.height = Math.round(STAGE_H * DPR);
  const gl = glCanvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: true, preserveDrawingBuffer: true });

  const vsSrc = "attribute vec2 aPos; attribute vec2 aUv; varying vec2 vUv; void main(){ vUv = aUv; gl_Position = vec4(aPos.x / 512.0 - 1.0, 1.0 - aPos.y / 288.0, 0.0, 1.0); }";
  const fsBodySrc =
    "precision mediump float; varying vec2 vUv; uniform sampler2D t0; uniform sampler2D t1; uniform sampler2D t2;" +
    "uniform float w1; uniform float w2; uniform float uEye; uniform vec4 uEyeL; uniform vec4 uEyeR;" +
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
    "  vec4 a = texture2D(t0, vUv);" +
    "  if (uEye > 0.5) {" +
    "    vec4 col = a; float c2 = clamp(w2, 0.0, 1.0); float c1 = clamp(w1, 0.0, 1.0);" +
    "    if (c2 > 0.004 || c1 > 0.004) {" +
    "      vec4 plush = texture2D(t2, vUv); vec3 furRgb = plush.rgb / max(plush.a, 0.001); vec3 rgb = col.rgb / max(col.a, 0.001);" +
    "      if (c2 > 0.004) { vec3 lL = eyeLid(vUv, uEyeL, c2); vec3 lR = eyeLid(vUv, uEyeR, c2); float cov = max(lL.x, lR.x); rgb = mix(rgb, furRgb * (lL.x >= lR.x ? lL.z : lR.z), cov); rgb = mix(rgb, vec3(0.14,0.115,0.098), max(lL.y, lR.y)); }" +
    "      if (c1 > 0.004) { vec4 hL = happyEye(vUv, uEyeL, c1); vec4 hR = happyEye(vUv, uEyeR, c1); rgb = mix(rgb, furRgb, max(hL.x, hR.x)); rgb = mix(rgb, vec3(0.14,0.115,0.098), max(hL.y, hR.y)); }" +
    "      col = vec4(rgb * col.a, col.a);" +
    "    }" +
    "    gl_FragColor = col;" +
    "  } else {" +
    "    vec4 b = texture2D(t1, vUv); vec4 c = texture2D(t2, vUv);" +
    "    float c1 = gate(w1); float c2 = gate(w2); float s = c1 + c2; if (s > 1.0) { c1 /= s; c2 /= s; }" +
    "    gl_FragColor = a * (1.0 - c1 - c2) + b * c1 + c * c2;" +
    "  }" +
    "}";
  const fsFaceSrc = "precision mediump float; varying vec2 vUv; uniform sampler2D tF; uniform float uA; void main(){ gl_FragColor = texture2D(tF, vUv) * uA; }";

  function sh(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; }
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, vsSrc)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fsBodySrc)); gl.linkProgram(prog);
  const progF = gl.createProgram();
  gl.attachShader(progF, sh(gl.VERTEX_SHADER, vsSrc)); gl.attachShader(progF, sh(gl.FRAGMENT_SHADER, fsFaceSrc)); gl.linkProgram(progF);

  const loc = {
    aPos: gl.getAttribLocation(prog, "aPos"), aUv: gl.getAttribLocation(prog, "aUv"),
    t0: gl.getUniformLocation(prog, "t0"), t1: gl.getUniformLocation(prog, "t1"), t2: gl.getUniformLocation(prog, "t2"),
    w1: gl.getUniformLocation(prog, "w1"), w2: gl.getUniformLocation(prog, "w2"),
    uEye: gl.getUniformLocation(prog, "uEye"), uEyeL: gl.getUniformLocation(prog, "uEyeL"), uEyeR: gl.getUniformLocation(prog, "uEyeR")
  };
  const locF = {
    aPos: gl.getAttribLocation(progF, "aPos"), aUv: gl.getAttribLocation(progF, "aUv"),
    tF: gl.getUniformLocation(progF, "tF"), uA: gl.getUniformLocation(progF, "uA")
  };

  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
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
      cfg: Object.assign({}, pCfg, { baseScale: petId === "yutu" ? 0.212 : 0.268 }),
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
    const lw = (px) => px / rt.cfg.baseScale;
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

  /* ---------- Deformation & Animation ---------- */
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

  let petPos = { x: CORK_HOME.x, y: CORK_HOME.y };
  let hopMove = null;
  const spring = { r: 0, vr: 0, y: 0, vy: 0, t: -1 };
  let animMode = "idle", modeT0 = performance.now(), idleT0 = modeT0, nextBlink = 2400, sleepAt = modeT0 + 8500;
  let lastPose = P({}), blendFrom = null, blendUntil = 0, petLean = 0, zzAt = 0, bubbleUntil = 0;
  let activeEmote = { kind: null, alpha: 0 };

  const deskDepthScale = (y) => state.roomState === "fitting" ? 1.02 : lerp(0.87, 1.05, clamp((y - 365) / 150, 0, 1));
  const currentScale = (rt) => rt.cfg.baseScale * deskDepthScale(petPos.y);
  const isWebGLVisible = () => state.roomState === "free_stand" || state.roomState === "fitting" || state.roomState === "dress_rummage";
  const activeSetId = () => state.roomState === "fitting" ? workingSetId : state.savedSet[state.petId];

  function renderPetFrame(rt, p, setId, clock, customAnchor) {
    if (!rt) return;
    lastPose = p;
    const dt = spring.t < 0 ? 0 : (clock - spring.t) / 1000; spring.t = clock;
    if (dt <= 0 || dt > 0.1) { spring.r = p.headRot; spring.vr = 0; spring.y = p.hopY; spring.vy = 0; }
    else {
      const n = Math.max(1, Math.ceil(dt / 0.008)), h = dt / n;
      for (let i = 0; i < n; i++) {
        spring.vr += (-(spring.r - p.headRot) * 150 - spring.vr * 9) * h; spring.r += spring.vr * h;
        spring.vy += (-(spring.y - p.hopY) * 140 - spring.vy * 9) * h; spring.y += spring.vy * h;
      }
    }
    const cfg = rt.cfg;
    const S = customAnchor ? cfg.baseScale * customAnchor.scaleK : currentScale(rt);
    const ax = customAnchor ? customAnchor.x : petPos.x, ay = customAnchor ? customAnchor.y : petPos.y;
    const OX = ax - cfg.cx * S, OY = ay - cfg.feetY * S;
    const lagR = clamp(spring.r - p.headRot, -25, 25), lagY = clamp((spring.y - p.hopY) * 0.6, -18, 28);
    const eL = p.earL + lagR * 1.1 - lagY, eR = p.earR + lagR * 1.1 + lagY;
    const cr = Math.cos((p.rot * Math.PI) / 180), sr = Math.sin((p.rot * Math.PI) / 180);

    for (let i = 0; i < NV; i++) {
      const d = deformVertex(cfg, rt.rest[i * 2], rt.rest[i * 2 + 1], p, eL, eR);
      const dx = d[0] - cfg.cx, dy = d[1] - cfg.feetY;
      rt.pos[i * 2] = OX + (cfg.cx + dx * cr - dy * sr) * S;
      rt.pos[i * 2 + 1] = OY + (cfg.feetY + dx * sr + dy * cr) * S + p.hopY;
    }

    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(prog);
    const setPack = (setId && rt.setTexMap[setId]) || rt.defaultTex;
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, setPack.base); gl.uniform1i(loc.t0, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, setPack.closed); gl.uniform1i(loc.t1, 1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, setPack.doze); gl.uniform1i(loc.t2, 2);

    const eyeL = (setPack.eyeLUV) || cfg.eyeLUV || [0, 0, 1, 1];
    const eyeR = (setPack.eyeRUV) || cfg.eyeRUV || [0, 0, 1, 1];
    gl.uniform1f(loc.uEye, cfg.useEyeShader ? 1.0 : 0.0);
    gl.uniform4f(loc.uEyeL, eyeL[0], eyeL[1], eyeL[2], eyeL[3]);
    gl.uniform4f(loc.uEyeR, eyeR[0], eyeR[1], eyeR[2], eyeR[3]);

    const wc = clamp(p.wClosed, 0, 1);
    gl.uniform1f(loc.w1, wc);
    gl.uniform1f(loc.w2, clamp(p.wDoze, 0, 1 - wc));

    gl.bindBuffer(gl.ARRAY_BUFFER, rt.uvBuf); gl.vertexAttribPointer(loc.aUv, 2, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(loc.aUv);
    gl.bindBuffer(gl.ARRAY_BUFFER, rt.posBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, rt.pos); gl.vertexAttribPointer(loc.aPos, 2, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(loc.aPos);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bodyIdxBuf);
    gl.drawElements(gl.TRIANGLES, bodyIdx.length, gl.UNSIGNED_SHORT, 0);

    if (activeEmote.kind && activeEmote.alpha > 0.01) {
      const fTex = paintFaceOverlay(rt, activeEmote.kind), fg = rt.faceGrid;
      for (let i = 0; i < fg.nv; i++) {
        const d = deformVertex(cfg, fg.rest[i * 2], fg.rest[i * 2 + 1], p, 0, 0);
        const dx = d[0] - cfg.cx, dy = d[1] - cfg.feetY;
        fg.pos[i * 2] = OX + (cfg.cx + dx * cr - dy * sr) * S;
        fg.pos[i * 2 + 1] = OY + (cfg.feetY + dx * sr + dy * cr) * S + p.hopY;
      }
      gl.useProgram(progF);
      gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, fTex);
      gl.uniform1i(locF.tF, 3); gl.uniform1f(locF.uA, clamp(activeEmote.alpha, 0, 1));
      gl.bindBuffer(gl.ARRAY_BUFFER, fg.uvBuf); gl.vertexAttribPointer(locF.aUv, 2, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(locF.aUv);
      gl.bindBuffer(gl.ARRAY_BUFFER, fg.posBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, fg.pos); gl.vertexAttribPointer(locF.aPos, 2, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(locF.aPos);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, fg.idxBuf);
      gl.drawElements(gl.TRIANGLES, fg.idxLen, gl.UNSIGNED_SHORT, 0);
    }

    if (!customAnchor) {
      const dScale = deskDepthScale(petPos.y), air = clamp(-p.hopY / 56, 0, 1);
      shSoftEl.style.left = (ax + 6).toFixed(1) + "px"; shSoftEl.style.top = (ay - 2).toFixed(1) + "px";
      shSoftEl.style.transform = `translate(-50%,-50%) scale(${(dScale * p.shS * (1 - 0.48 * air)).toFixed(3)})`;
      shSoftEl.style.opacity = isWebGLVisible() ? (p.shO * (1 - 0.65 * air)).toFixed(3) : "0";
      shConEl.style.left = (ax + 2).toFixed(1) + "px"; shConEl.style.top = (ay + 1).toFixed(1) + "px";
      shConEl.style.transform = `translate(-50%,-50%) scale(${(dScale * p.shS * (1 - 0.58 * air)).toFixed(3)})`;
      shConEl.style.opacity = isWebGLVisible() ? (1 - 0.82 * air).toFixed(3) : "0";
    }
  }

  function idlePose(t, blink) {
    const b = Math.sin((t / 2600) * Math.PI * 2);
    const tw = (t % 4300) / 4300, twitch = tw > 0.9 ? Math.sin(((tw - 0.9) / 0.1) * Math.PI * 2) * 6 : 0;
    return P({ sx: 1 - 0.006 * b, sy: 1 + 0.012 * b, breath: 0.018 * b, headRot: 0.8 * Math.sin((t / 3400) * Math.PI * 2),
      earL: -1 + 2.2 * Math.sin((t / 2300) * Math.PI * 2 + 0.3), earR: 1 + 2.2 * Math.sin((t / 2700) * Math.PI * 2 + 1.4) + twitch, wDoze: blink || 0 });
  }
  function minihopPose(u, leanDir) {
    const p = kfPose([
      { o: 0, e: "in", hopY: 0, sx: 1, sy: 1, shS: 1, shO: 1 },
      { o: 0.18, e: "out", hopY: 3, sx: 1.08, sy: 0.9, shS: 1.12, shO: 0.92 },
      { o: 0.44, e: "out", hopY: -26, sx: 0.95, sy: 1.07, earL: -10, earR: 10, shS: 0.65, shO: 0.45 },
      { o: 0.80, e: "back", hopY: 2, sx: 1.08, sy: 0.91, shS: 1.12, shO: 0.88 },
      { o: 1, e: "out", hopY: 0, sx: 1, sy: 1, shS: 1, shO: 1 }
    ], u);
    if (leanDir) p.rot = Math.sin(u * Math.PI) * 4.2 * leanDir;
    return p;
  }
  const jumpPose = (u) => kfPose([{ o: 0, e: "in", sx: 1, sy: 1 }, { o: 0.14, e: "out", sx: 1.10, sy: 0.85, earL: -10, earR: 10, shS: 1.15 }, { o: 0.42, e: "in", sx: 0.96, sy: 1.06, hopY: -44, earL: -16, earR: 16, rot: 1.5 }, { o: 0.78, e: "back", sx: 1.12, sy: 0.85, hopY: 0, earL: -16, earR: 16, shS: 1.16 }, { o: 1, e: "out", sx: 1, sy: 1 }], u);
  const tiltPose = (u, s) => kfPose([{ o: 0, e: "out" }, { o: 0.28, e: "io", headRot: 12 * s, rot: 1.5 * s, headTy: 3, earL: -5 * s, earR: -5 * s }, { o: 0.55, e: "lin", headRot: 11 * s, rot: 1.5 * s, headTy: 3, wDoze: 0.95 }, { o: 0.70, e: "out", headRot: 9 * s, rot: 1 * s, headTy: 2, wDoze: 0 }, { o: 1, e: "out" }], u);
  const petPose = (lean, t) => { const tw = Math.sin((t / 2800) * Math.PI * 2); return P({ sx: 1.02, sy: 0.98, lean, headRot: 7 * lean, rot: 2 * lean, headTy: 3, earL: -14 + 2 * tw, earR: 14 - 2 * tw, wClosed: 1, breath: 0.012 * tw }); };
  const dozePose = (t) => { const b = Math.sin((t / 4200) * Math.PI * 2); return P({ sx: 1.01, sy: 0.985 + 0.008 * b, breath: 0.02 * b, headRot: 5 + 1.1 * b, headTy: 6, rot: 1, earL: -5, earR: 40 + 3 * b, wDoze: 1, shS: 1.03 }); };

  function beginAnim(m, now) { animMode = m; modeT0 = now; blendFrom = lastPose; blendUntil = now + 150; if (m !== "emote") activeEmote.alpha = 0; }
  function toIdle(now) { animMode = "idle"; idleT0 = now; nextBlink = 2200 + Math.random() * 1600; sleepAt = now + 9000; blendFrom = lastPose; blendUntil = now + 220; activeEmote.alpha = 0; }
  function blendPose(p, now) { return (!blendFrom || now >= blendUntil) ? p : mixPose(blendFrom, p, easeOutCubic(clamp(1 - (blendUntil - now) / 180, 0, 1))); }

  function showBubbleAt(x, y, text, durMs) {
    bubbleEl.textContent = text;
    bubbleEl.style.left = clamp(x, 95, STAGE_W - 95).toFixed(1) + "px";
    bubbleEl.style.top = Math.max(46, y).toFixed(1) + "px";
    bubbleEl.classList.add("show");
    bubbleUntil = performance.now() + (durMs || 2300);
  }
  function spawnParticle(x, y, glyph, color) {
    const el = document.createElement("div"); el.className = "emo-fx"; el.textContent = glyph; el.style.color = color; cameraRigEl.appendChild(el);
    const dx = (Math.random() - 0.5) * 26;
    el.animate([{ transform: `translate(${x}px,${y}px) scale(.4)`, opacity: 0 }, { transform: `translate(${x + dx * 0.5}px,${y - 16}px) scale(1.15)`, opacity: 1, offset: 0.35 }, { transform: `translate(${x + dx}px,${y - 38}px) scale(.95)`, opacity: 0 }], { duration: 1050, easing: "ease-out", fill: "forwards" }).onfinish = () => el.remove();
  }
  function triggerWebGLEmote(kind) {
    const rt = petRuntimes[state.petId]; if (!rt) return;
    const kinds = ["laugh", "cute", "think", "sad"];
    const chosen = kind || kinds[Math.floor(Math.random() * kinds.length)];
    activeEmote.kind = chosen; activeEmote.alpha = 1;
    beginAnim("emote", performance.now());
    const lines = EMOTE_LINES[state.petId][chosen];
    const headTopY = petPos.y - (rt.cfg.feetY - rt.faceCfg.bubbleY) * currentScale(rt);
    showBubbleAt(petPos.x, headTopY, lines[Math.floor(Math.random() * lines.length)], 2300);
    spawnParticle(petPos.x + 28, headTopY + 26, chosen === "cute" ? "♥" : "✦", chosen === "cute" ? "#FF6F91" : "#F2B84B");
  }

  function hopToDeskPoint(rawX, rawY) {
    let cx = clamp(rawX, 436, 785), cy = clamp(rawY, 376, 520);
    const mdx = cx - 650, mdy = cy - 396;
    if (Math.hypot(mdx, mdy) < 66) { const ang = Math.atan2(mdy, mdx || -1); cx = 650 + Math.cos(ang) * 68; cy = clamp(396 + Math.sin(ang) * 68, 376, 520); }
    if (cx < 455 && cy > 448) cy = 448;
    const r = document.createElement("div"); r.className = "desk-ripple"; r.style.left = cx + "px"; r.style.top = cy + "px"; cameraRigEl.appendChild(r); setTimeout(() => r.remove(), 540);
    const hops = Math.hypot(cx - petPos.x, cy - petPos.y) > 135 ? 2 : 1;
    hopMove = { x0: petPos.x, y0: petPos.y, x1: cx, y1: cy, t0: performance.now(), dur: hops * 430, hops, dir: cx >= petPos.x ? 1 : -1 };
    beginAnim("walk-hop", hopMove.t0);
  }

  function hitTestWebGLPet(rt, scX, scY) {
    if (!rt || !isWebGLVisible()) return false;
    const S = currentScale(rt), OX = petPos.x - rt.cfg.cx * S, OY = petPos.y - rt.cfg.feetY * S;
    const lx = Math.floor((scX - OX) / S), ly = Math.floor((scY - lastPose.hopY - OY) / S);
    if (lx < 0 || ly < 0 || lx >= rt.cfg.canvasW || ly >= rt.cfg.canvasH) return false;
    return rt.hitCtx.getImageData(lx, ly, 1, 1).data[3] >= 32;
  }

  let dragState = null;
  hitLayerEl.addEventListener("pointerdown", (ev) => {
    const rect = cameraRigEl.getBoundingClientRect();
    const sc = { x: ((ev.clientX - rect.left) / Math.max(1, rect.width)) * STAGE_W, y: ((ev.clientY - rect.top) / Math.max(1, rect.height)) * STAGE_H };
    const rt = petRuntimes[state.petId];
    if (state.roomState === "sleep") {
      if (sc.x >= 55 && sc.x <= 395 && sc.y >= 195 && sc.y <= 470) {
        showBubbleAt(245, 215, PATCH_LINES.sleep[Math.floor(Math.random() * PATCH_LINES.sleep.length)], 2400);
        spawnParticle(270, 210, "zZ", "#7D8CC4");
      }
      return;
    }
    if (state.roomState === "drawing") {
      if (sc.x >= 435 && sc.x <= 630 && sc.y >= 200 && sc.y <= 445) {
        showBubbleAt(535, 200, PATCH_LINES.drawing[Math.floor(Math.random() * PATCH_LINES.drawing.length)], 2400);
        spawnParticle(570, 225, "✦", "#E5A93C");
      }
      return;
    }
    if (state.roomState === "away") { openPostcardModal("sunset_meadow", true); return; }
    if (hitTestWebGLPet(rt, sc.x, sc.y)) {
      if (animMode === "doze") { toIdle(performance.now()); showBubbleAt(petPos.x, petPos.y - 165, "唔…刚眯了一小会儿～", 1800); return; }
      dragState = { id: ev.pointerId, x0: sc.x, t0: performance.now(), petting: false };
      try { hitLayerEl.setPointerCapture(ev.pointerId); } catch (e) {}
      return;
    }
    if (state.roomState === "free_stand" || state.roomState === "dress_rummage") hopToDeskPoint(sc.x, sc.y);
  });

  hitLayerEl.addEventListener("pointermove", (ev) => {
    if (!dragState || ev.pointerId !== dragState.id) return;
    const rect = cameraRigEl.getBoundingClientRect();
    const dx = ((ev.clientX - rect.left) / Math.max(1, rect.width)) * STAGE_W - dragState.x0;
    if (!dragState.petting && Math.abs(dx) > 14) { dragState.petting = true; beginAnim("pet", performance.now()); spawnParticle(petPos.x, petPos.y - 165, "♥", "#FF6F91"); }
    if (dragState.petting) petLean = lerp(petLean, clamp(dx / 45, -1, 1), 0.32);
  });

  function endPtr(ev) {
    if (!dragState || ev.pointerId !== dragState.id) return;
    const d = dragState; dragState = null;
    if (d.petting) { toIdle(performance.now()); return; }
    if (performance.now() - d.t0 < 480) { state.roomState === "dress_rummage" ? enterFittingRoom() : triggerWebGLEmote(); }
  }
  hitLayerEl.addEventListener("pointerup", endPtr);
  hitLayerEl.addEventListener("pointercancel", endPtr);

  /* ---------- Room State & Bedside Removed Outfit Sync ---------- */
  function findSetItem(petId, setId) {
    if (!catalog || !setId) return null;
    return catalog.pets[petId].items.find((x) => x.id === setId) || null;
  }
  function isItemOwned(petId, setId) {
    return !setId || (state.owned[petId] || []).includes(setId);
  }

  function syncRoomVisuals() {
    const petId = state.petId, rs = state.roomState;
    const curSet = findSetItem(petId, activeSetId());

    appEl.classList.toggle("is-fitting", rs === "fitting");
    appEl.setAttribute("data-period", state.period);

    if (rs === "sleep") { patchImgEl.src = `scene/sleep_${petId}.png`; patchImgEl.classList.add("visible"); }
    else if (rs === "drawing") { patchImgEl.src = `scene/draw_${petId}.png`; patchImgEl.classList.add("visible"); }
    else patchImgEl.classList.remove("visible");

    glCanvas.classList.toggle("webgl-hidden", !isWebGLVisible());
    if (!isWebGLVisible()) { shSoftEl.style.opacity = "0"; shConEl.style.opacity = "0"; }

    bedHatPropEl.classList.add("hidden");
    tableAccPropEl.classList.add("hidden");
    patchHeadAccEl.classList.add("hidden");

    if (rs === "sleep" && curSet) {
      bedHatPropEl.src = sharedUrl(curSet.thumb);
      bedHatPropEl.style.left = "144px"; bedHatPropEl.style.top = "172px"; bedHatPropEl.style.width = "68px";
      bedHatPropEl.style.transform = "translate(-50%, -50%) rotate(-7deg)";
      bedHatPropEl.title = `睡前摘在床头的「${curSet.name}」`;
      bedHatPropEl.classList.remove("hidden");
    } else if (rs === "drawing" && curSet) {
      tableAccPropEl.src = sharedUrl(curSet.thumb);
      tableAccPropEl.style.left = "942px"; tableAccPropEl.style.top = "366px"; tableAccPropEl.style.width = "64px";
      tableAccPropEl.style.transform = "translate(-50%, -50%) rotate(8deg)";
      tableAccPropEl.title = `画画时叠在边几上的「${curSet.name}」`;
      tableAccPropEl.classList.remove("hidden");
    }

    trunkPropEl.classList.toggle("hidden", rs !== "dress_rummage");
    awayNoteEl.classList.toggle("hidden", rs !== "away");
    if (rs === "drawing") { actionGlowEl.style.left = "548px"; actionGlowEl.style.top = "450px"; actionGlowEl.classList.remove("hidden"); }
    else if (rs === "dress_rummage") { actionGlowEl.style.left = "436px"; actionGlowEl.style.top = "446px"; actionGlowEl.classList.remove("hidden"); }
    else actionGlowEl.classList.add("hidden");

    const meta = STATE_META[rs] || STATE_META.free_stand;
    hudPetNameEl.textContent = petId === "yutu" ? "玉兔" : "锦鲤";
    hudStateIconEl.textContent = meta.icon;
    hudStateLabelEl.textContent = meta.mood;
    hudStarCountEl.textContent = String(state.stars);
    sheetStarCountEl.textContent = String(state.stars);
    testerCurrentLabelEl.textContent = meta.short;
    wakeBtnEl.classList.toggle("hidden", rs === "free_stand" || rs === "fitting");

    document.querySelectorAll(".tester-opt[data-state]").forEach((btn) => {
      const act = btn.getAttribute("data-state") === rs;
      btn.classList.toggle("active", act);
      const mark = btn.querySelector("span:last-child");
      if (mark && !btn.classList.contains("reserved")) mark.textContent = act ? "✓" : "";
    });
    document.querySelectorAll(".pet-seg-btn").forEach((btn) => btn.classList.toggle("active", btn.getAttribute("data-pet") === petId));

    envelopeDotEl.classList.toggle("hidden", !state.unreadMail);
    envelopeBtnEl.classList.toggle("fab-arriving", state.unreadMail || rs === "away");
    envelopeHintEl.textContent = rs === "away" ? "收到新明信片" : "带妆明信片";

    if (state.album.length > 0) { wallPolaroidImgEl.src = state.album[0].img; wallPolaroidEl.classList.remove("hidden"); }
    else wallPolaroidEl.classList.add("hidden");
  }

  function setRoomState(nextState) {
    if (nextState === "gaming" || nextState === "reading") { showToast("已预留状态扩展槽位，补充同机位贴片即可点亮～"); return; }
    if (nextState === "fitting") { enterFittingRoom(); return; }
    state.roomState = nextState; hopMove = null; bubbleEl.classList.remove("show");
    if (nextState === "free_stand") { petPos = { x: CORK_HOME.x, y: CORK_HOME.y }; beginAnim("minihop", performance.now()); }
    else if (nextState === "dress_rummage") { petPos = { x: RUMMAGE_SPOT.x, y: RUMMAGE_SPOT.y }; triggerWebGLEmote("think"); }
    else if (nextState === "away") { state.unreadMail = true; showToast("崽穿新衣出门偶遇啦！点左下信封拆阅带妆明信片"); }
    syncRoomVisuals();
  }

  /* ---------- Boutique Fitting Room (`fitting`) ---------- */
  function enterFittingRoom() {
    workingSetId = state.savedSet[state.petId];
    activeFilter = "all";
    state.roomState = "fitting";
    hopMove = null;
    petPos = { x: CORK_HOME.x, y: CORK_HOME.y };
    centerViewportOnDesk(true);
    renderWardrobeUI();
    syncRoomVisuals();
    beginAnim("minihop", performance.now());
  }

  function exitFittingRoom(apply) {
    if (!apply) workingSetId = state.savedSet[state.petId];
    state.roomState = "free_stand";
    petPos = { x: CORK_HOME.x, y: CORK_HOME.y };
    syncRoomVisuals();
    beginAnim("minihop", performance.now());
  }

  function renderWardrobeUI() {
    if (!catalog) return;
    const petId = state.petId, items = catalog.pets[petId].items;
    wardrobeTabsEl.innerHTML = "";
    [
      { key: "all", label: `全部套装 (${items.length})` },
      { key: "owned", label: `已拥有 (${(state.owned[petId] || []).length})` },
      { key: "locked", label: "待解锁限定" }
    ].forEach((tab) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "slot-tab" + (activeFilter === tab.key ? " active" : "");
      b.textContent = tab.label;
      b.addEventListener("click", () => { activeFilter = tab.key; renderWardrobeUI(); });
      wardrobeTabsEl.appendChild(b);
    });

    wardrobeGridEl.innerHTML = "";
    items.filter((it) => {
      const ow = isItemOwned(petId, it.id);
      return activeFilter === "all" ? true : activeFilter === "owned" ? ow : !ow;
    }).forEach((it) => {
      const owned = isItemOwned(petId, it.id), selected = workingSetId === it.id;
      const card = document.createElement("button");
      card.type = "button";
      card.className = "dress-card" + (selected ? " selected" : "") + (owned ? " owned" : "");
      card.innerHTML =
        `<span class="card-price-tag">⭐ ${it.price}</span>` +
        `<span class="card-check-badge"><svg viewBox="0 0 12 12" width="11" height="11"><path d="M2 6.2l2.6 2.6L10 3.4" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg></span>` +
        `<img src="${sharedUrl(it.thumb)}" alt="${it.name}">` +
        `<span class="dress-card-name">${it.name}</span>`;
      card.addEventListener("click", async () => {
        workingSetId = workingSetId === it.id ? null : it.id;
        renderWardrobeUI();
        if (workingSetId) {
          await ensureSetLoaded(petRuntimes[petId], workingSetId);
          if (!owned) showBubbleAt(petPos.x, petPos.y - 170, `先试穿「${it.name}」看看效果～`, 1800);
        }
        beginAnim("minihop", performance.now());
      });
      wardrobeGridEl.appendChild(card);
    });

    const curItem = findSetItem(petId, workingSetId);
    const needUnlock = curItem && !isItemOwned(petId, curItem.id);
    sheetStarCountEl.textContent = String(state.stars);
    if (!needUnlock) {
      revertBtnEl.classList.add("hidden");
      confirmOutfitBtnEl.disabled = false;
      confirmOutfitBtnEl.textContent = "穿好啦";
    } else {
      revertBtnEl.classList.remove("hidden");
      confirmOutfitBtnEl.disabled = state.stars < curItem.price;
      confirmOutfitBtnEl.textContent = state.stars >= curItem.price ? `用 ⭐ ${curItem.price} 解锁并穿回房间` : `星星不足（需 ⭐ ${curItem.price}）`;
    }
  }

  revertBtnEl.addEventListener("click", () => { workingSetId = state.savedSet[state.petId]; renderWardrobeUI(); beginAnim("tilt", performance.now()); });
  confirmOutfitBtnEl.addEventListener("click", () => {
    const petId = state.petId, curItem = findSetItem(petId, workingSetId);
    if (curItem && !isItemOwned(petId, curItem.id)) {
      if (state.stars < curItem.price) return;
      state.stars -= curItem.price;
      state.owned[petId].push(curItem.id);
      showToast(`已解锁「${curItem.name}」！`);
    } else showToast("新穿搭已保存！");
    state.savedSet[petId] = workingSetId;
    persistState();
    exitFittingRoom(true);
    setTimeout(() => triggerWebGLEmote("cute"), 240);
  });

  async function switchPet(nextId) {
    if (nextId === state.petId || !catalog) return;
    await initPet(nextId);
    state.petId = nextId;
    workingSetId = state.savedSet[nextId];
    activeFilter = "all";
    persistState();
    if (state.roomState === "fitting") renderWardrobeUI();
    syncRoomVisuals();
    beginAnim("minihop", performance.now());
    showToast(`已切换伙伴：${catalog.pets[nextId].label}`);
  }

  /* ---------- Zero-Token Illustrated Postcard Compositor ---------- */
  const bgCache = {};
  function loadBg(src) {
    if (bgCache[src]) return Promise.resolve(bgCache[src]);
    return new Promise((resolve, reject) => {
      const img = new Image(); img.onload = () => { bgCache[src] = img; resolve(img); }; img.onerror = reject; img.src = src;
    });
  }

  async function synthesizePostcard(sceneId) {
    const rt = petRuntimes[state.petId], setId = activeSetId();
    if (setId) await ensureSetLoaded(rt, setId);
    const tpl = POSTCARD_SCENES.find((s) => s.id === sceneId) || POSTCARD_SCENES[0];
    const bgImg = await loadBg(tpl.src);
    const W = 800, H = 1000, out = document.createElement("canvas");
    out.width = W; out.height = H;
    const ctx = out.getContext("2d");

    const srcA = bgImg.naturalWidth / bgImg.naturalHeight, dstA = W / H;
    let sx = 0, sy = 0, sw = bgImg.naturalWidth, sh = bgImg.naturalHeight;
    if (srcA > dstA) { sw = sh * dstA; sx = (bgImg.naturalWidth - sw) * (tpl.crop16x9 ? 0.48 : 0.5); }
    else { sh = sw / dstA; sy = (bgImg.naturalHeight - sh) * 0.5; }
    ctx.drawImage(bgImg, sx, sy, sw, sh, 0, 0, W, H);

    const prevEmote = { kind: activeEmote.kind, alpha: activeEmote.alpha };
    activeEmote.kind = tpl.pose === "tilt" ? null : "cute";
    activeEmote.alpha = tpl.pose === "tilt" ? 0 : 1;
    const snapPose = tpl.pose === "jump" ? jumpPose(0.36) : tpl.pose === "tilt" ? tiltPose(0.32, 1) : P({ headRot: 7, rot: 1.5, sx: 1.02, sy: 0.98, wClosed: rt.cfg.useEyeShader ? 1 : 0 });

    const cap = { x: 512, y: 472, scaleK: tpl.scaleK };
    spring.t = -1;
    renderPetFrame(rt, snapPose, setId, performance.now(), cap);
    gl.finish();

    const footX = W * 0.5, footY = H * tpl.anchorY;
    ctx.save(); ctx.translate(footX, footY); ctx.scale(1, 0.28);
    const shG = ctx.createRadialGradient(0, 0, 8, 0, 0, 145);
    shG.addColorStop(0, "rgba(32,20,10,0.46)"); shG.addColorStop(0.55, "rgba(32,20,10,0.16)"); shG.addColorStop(1, "rgba(32,20,10,0)");
    ctx.fillStyle = shG; ctx.beginPath(); ctx.arc(0, 0, 145, 0, Math.PI * 2); ctx.fill(); ctx.restore();

    const petLayer = document.createElement("canvas"); petLayer.width = glCanvas.width; petLayer.height = glCanvas.height;
    const pctx = petLayer.getContext("2d");
    pctx.drawImage(glCanvas, 0, 0);
    pctx.globalCompositeOperation = "source-atop"; pctx.fillStyle = tpl.tint; pctx.fillRect(0, 0, petLayer.width, petLayer.height);

    const ds = 1.48;
    ctx.drawImage(petLayer, 0, 0, petLayer.width, petLayer.height, footX - cap.x * ds, footY - cap.y * ds, STAGE_W * ds, STAGE_H * ds);

    activeEmote.kind = prevEmote.kind; activeEmote.alpha = prevEmote.alpha;
    renderPetFrame(rt, lastPose, activeSetId(), performance.now());

    const curItem = findSetItem(state.petId, setId);
    const badge = curItem ? `穿搭 · ${curItem.name}` : `${rt.cfg.label} · 原生毛绒`;
    ctx.font = "600 22px 'PingFang SC', 'Microsoft YaHei', sans-serif";
    const tw = ctx.measureText(badge).width;
    ctx.fillStyle = "rgba(255,253,248,0.88)";
    ctx.beginPath(); ctx.roundRect(28, H - 68, tw + 32, 42, 21); ctx.fill();
    ctx.fillStyle = "#294732"; ctx.fillText(badge, 44, H - 40);

    return { sceneId: tpl.id, title: tpl.label, img: out.toDataURL("image/jpeg", 0.91), story: tpl.copy[state.petId], petId: state.petId };
  }

  async function openPostcardModal(sceneId, canCollect) {
    activePostcardSceneId = sceneId || activePostcardSceneId;
    postcardModalEl.classList.remove("hidden");
    state.unreadMail = false; syncRoomVisuals();
    postcardSceneBarEl.innerHTML = "";
    POSTCARD_SCENES.forEach((sc) => {
      const chip = document.createElement("button"); chip.type = "button";
      chip.className = "scene-chip" + (sc.id === activePostcardSceneId ? " active" : "");
      chip.textContent = sc.label;
      chip.addEventListener("click", () => openPostcardModal(sc.id, true));
      postcardSceneBarEl.appendChild(chip);
    });
    postcardEyebrowEl.textContent = sceneId === "studio_desk" ? "试衣台定妆 · 零 Token 实时合成" : "故事偶遇 · 零 Token 实时合成";
    collectPostcardBtnEl.style.display = canCollect === false ? "none" : "flex";
    currentPostcardData = await synthesizePostcard(activePostcardSceneId);
    postcardPreviewImgEl.src = currentPostcardData.img;
    postcardStoryTextEl.textContent = currentPostcardData.story;
  }

  function openSavedCard(item) {
    currentPostcardData = item; postcardModalEl.classList.remove("hidden"); postcardSceneBarEl.innerHTML = "";
    postcardEyebrowEl.textContent = `已收录纪念 · ${item.title}`;
    postcardPreviewImgEl.src = item.img; postcardStoryTextEl.textContent = item.story;
    collectPostcardBtnEl.style.display = "none";
  }

  /* ---------- Event Listeners & Loop ---------- */
  document.getElementById("btn-open-fitting").addEventListener("click", enterFittingRoom);
  deskMirrorPropEl.addEventListener("click", enterFittingRoom);
  trunkPropEl.addEventListener("click", enterFittingRoom);
  document.getElementById("btn-exit-fitting").addEventListener("click", () => exitFittingRoom(false));
  document.getElementById("btn-studio-snap").addEventListener("click", () => openPostcardModal("studio_desk", true));
  document.getElementById("btn-quick-switch-pet").addEventListener("click", () => switchPet(state.petId === "yutu" ? "koi" : "yutu"));
  document.querySelectorAll(".pet-seg-btn").forEach((b) => b.addEventListener("click", () => switchPet(b.getAttribute("data-pet"))));
  wakeBtnEl.addEventListener("click", () => setRoomState("free_stand"));
  bedHatPropEl.addEventListener("click", () => showToast(bedHatPropEl.title + " · 点右下「去换装」可更换"));
  tableAccPropEl.addEventListener("click", () => showToast(tableAccPropEl.title));
  actionGlowEl.addEventListener("click", () => {
    if (state.roomState === "dress_rummage") enterFittingRoom();
    else if (state.roomState === "drawing") { state.stars += 5; persistState(); syncRoomVisuals(); showToast("收下涂鸦心意，陪伴星星 +5 ⭐"); openPostcardModal("mint_room", true); }
  });
  awayNoteEl.addEventListener("click", () => openPostcardModal("sunset_meadow", true));

  testerBtnEl.addEventListener("click", (ev) => {
    ev.stopPropagation();
    const open = testerMenuEl.classList.toggle("hidden") === false;
    testerChevronEl.textContent = open ? "⌃" : "⌄";
  });
  document.addEventListener("click", (ev) => { if (!ev.target.closest("#tester-wrap")) { testerMenuEl.classList.add("hidden"); testerChevronEl.textContent = "⌄"; } });
  document.querySelectorAll(".tester-opt[data-state]").forEach((btn) => btn.addEventListener("click", () => {
    const st = btn.getAttribute("data-state"); setRoomState(st);
    if (st !== "gaming" && st !== "reading") { testerMenuEl.classList.add("hidden"); testerChevronEl.textContent = "⌄"; }
  }));
  document.querySelectorAll(".period-chip").forEach((chip) => chip.addEventListener("click", () => {
    state.period = chip.getAttribute("data-period");
    document.querySelectorAll(".period-chip").forEach((c) => c.classList.toggle("active", c === chip));
    syncRoomVisuals();
  }));

  envelopeBtnEl.addEventListener("click", () => openPostcardModal("sunset_meadow", true));
  wallPolaroidEl.addEventListener("click", () => { if (state.album.length > 0) openSavedCard(state.album[0]); });
  document.getElementById("btn-close-postcard").addEventListener("click", () => postcardModalEl.classList.add("hidden"));
  collectPostcardBtnEl.addEventListener("click", () => {
    if (!currentPostcardData) return;
    state.album.unshift(currentPostcardData); state.album = state.album.slice(0, 10); state.stars += 8;
    if (state.roomState === "away") { state.roomState = "free_stand"; petPos = { x: CORK_HOME.x, y: CORK_HOME.y }; }
    persistState(); postcardModalEl.classList.add("hidden"); syncRoomVisuals();
    showToast("已收下明信片并钉在起居室墙上！（陪伴星星 +8 ⭐）");
  });
  document.getElementById("btn-download-postcard").addEventListener("click", () => {
    if (!currentPostcardData) return;
    const a = document.createElement("a"); a.href = currentPostcardData.img; a.download = `eggbabe-postcard-${state.petId}.jpg`; a.click();
  });
  document.getElementById("btn-open-album").addEventListener("click", () => {
    albumGridEl.innerHTML = state.album.length ? "" : `<div class="album-empty">还没有收下明信片哦～<br>点左下「信封」或试衣间「定妆照」拍一张吧！</div>`;
    state.album.forEach((it) => {
      const c = document.createElement("button"); c.type = "button"; c.className = "album-item";
      c.innerHTML = `<img src="${it.img}" alt="${it.title}"><div class="album-item-caption">${it.title}</div>`;
      c.addEventListener("click", () => { albumModalEl.classList.add("hidden"); openSavedCard(it); });
      albumGridEl.appendChild(c);
    });
    albumModalEl.classList.remove("hidden");
  });
  document.getElementById("btn-close-album").addEventListener("click", () => albumModalEl.classList.add("hidden"));

  function tick(now) {
    requestAnimationFrame(tick);
    if (bubbleUntil > 0 && now > bubbleUntil) { bubbleUntil = 0; bubbleEl.classList.remove("show"); }
    const rt = petRuntimes[state.petId];
    if (!rt || !isWebGLVisible()) return;
    const t = now - modeT0;
    let pose;
    if (animMode === "walk-hop" && hopMove) {
      const u = clamp((now - hopMove.t0) / hopMove.dur, 0, 1);
      petPos.x = lerp(hopMove.x0, hopMove.x1, easeInOut(u));
      petPos.y = lerp(hopMove.y0, hopMove.y1, easeInOut(u));
      pose = minihopPose(u >= 1 ? 1 : (u * hopMove.hops) % 1, hopMove.dir);
      if (u >= 1) { hopMove = null; toIdle(now); }
    } else if (animMode === "minihop") { if (t >= 580) toIdle(now); pose = blendPose(minihopPose(t / 580, 0), now); }
    else if (animMode === "jump") { if (t >= 980) toIdle(now); pose = blendPose(jumpPose(t / 980), now); }
    else if (animMode === "tilt") { if (t >= 920) toIdle(now); pose = blendPose(tiltPose(t / 920, 1), now); }
    else if (animMode === "emote") {
      if (t >= 1800) { toIdle(now); pose = idlePose(0, 0); }
      else { const u = t / 1800; activeEmote.alpha = u < 0.1 ? u / 0.1 : u > 0.85 ? (1 - u) / 0.15 : 1; pose = activeEmote.kind === "laugh" ? jumpPose((t % 620) / 620) : tiltPose(u, 1); }
    } else if (animMode === "pet") pose = blendPose(petPose(petLean, t), now);
    else if (animMode === "doze") {
      pose = dozePose(t);
      if (now > zzAt) {
        zzAt = now + 1750;
        const el = document.createElement("div"); el.className = "zz-float"; el.textContent = "z"; cameraRigEl.appendChild(el);
        const x = petPos.x + 34, y = petPos.y - 140;
        el.animate([{ transform: `translate(${x}px,${y}px) scale(.7)`, opacity: 0 }, { transform: `translate(${x + 12}px,${y - 30}px) scale(1.2)`, opacity: 0.85, offset: 0.4 }, { transform: `translate(${x + 18}px,${y - 42}px)`, opacity: 0 }], { duration: 1400, fill: "forwards" }).onfinish = () => el.remove();
      }
    } else {
      if (state.roomState === "free_stand" && now >= sleepAt) { beginAnim("doze", now); pose = dozePose(0); }
      else {
        const it = now - idleT0; let bl = 0;
        if (it >= nextBlink) { const bu = (it - nextBlink) / 200; bl = bu < 0.22 ? bu / 0.22 : bu < 0.5 ? 1 : Math.max(0, 1 - (bu - 0.5) / 0.5); if (it > nextBlink + 200) nextBlink = it + 2500 + Math.random() * 1800; }
        pose = blendPose(idlePose(it, bl), now);
      }
    }
    renderPetFrame(rt, pose, activeSetId(), now);
  }

  async function boot() {
    const res = await fetch("../assets/shared/catalog.json");
    catalog = await res.json();
    await initPet(state.petId);
    initPet(state.petId === "yutu" ? "koi" : "yutu");
    syncRoomVisuals();
    centerViewportOnDesk(false);
    requestAnimationFrame(tick);
  }
  boot().catch((err) => console.error("Boot error:", err));
})();
