/**
 * 跨端 WebGL 网格形变宠物渲染引擎（H5 浏览器 + 原生微信小程序 100% 共用）
 * - 锦鲤 BOON KOI：全身透明套装 + 毛绒眼皮滑动眨眼/笑眼 Shader
 * - 玉兔 Yutu：3 表情纹理融合 + 头饰/围巾多槽位网格形变叠加
 */

const COLS = 30;
const ROWS = 56;
const ACC_COLS = 12;
const ACC_ROWS = 12;

const JUMP_MS = 1100;
const TILT_MS = 950;
const MINI_MS = 620;
const EAT_MS = 1080;
const RINSE_MS = 960;
const BLINK_MS = 200;
const SLEEP_ENTER_MS = 850;
const WAKE_MS = 680;
const PET_RELEASE_MS = 380;
const SLEEP_DELAY_MS = 6500;
const HOME_OFFSET_Y = 245;
const HOME_SCALE_MUL = 1.08;

const VS_BODY =
  "attribute vec2 aPos; attribute vec2 aUv; uniform vec2 uView; varying vec2 vUv;" +
  "void main(){ vUv = aUv; gl_Position = vec4((aPos.x - 195.0) / (uView.x * 0.5), 1.0 - aPos.y / (uView.y * 0.5), 0.0, 1.0); }";

const FS_BODY =
  "precision mediump float; varying vec2 vUv; uniform sampler2D t0; uniform sampler2D t1; uniform sampler2D t2;" +
  "uniform float w1; uniform float w2; uniform float uEye; uniform vec4 uEyeL; uniform vec4 uEyeR;" +
  "float gate(float w){ w = clamp(w, 0.0, 1.0); return 1.0 - pow(1.0 - w, 2.6); }" +
  "vec3 eyeLid(vec2 uv, vec4 eye, float w){" +
  "  if (w <= 0.004) return vec3(0.0);" +
  "  vec2 d = (uv - eye.xy) / eye.zw;" +
  "  float rad = length(d);" +
  "  if (rad > 1.20) return vec3(0.0);" +
  "  float mask = smoothstep(1.16, 0.78, rad);" +
  "  float curve = mix(-0.12, 0.26, w);" +
  "  float lidY = mix(-1.12, 0.34, w) - curve * (d.x * d.x);" +
  "  float lowY = mix(1.22, 0.34, smoothstep(0.25, 1.0, w)) - curve * (d.x * d.x);" +
  "  float coverTop = smoothstep(lidY + 0.12, lidY - 0.08, d.y);" +
  "  float coverBot = smoothstep(lowY - 0.12, lowY + 0.08, d.y);" +
  "  float cover = clamp(max(coverTop, coverBot), 0.0, 1.0) * mask;" +
  "  float xTaper = smoothstep(0.78, 0.28, abs(d.x));" +
  "  float distLine = abs(d.y - lidY);" +
  "  float thick = mix(0.05, 0.09, w) * xTaper;" +
  "  float line = (1.0 - smoothstep(thick * 0.45, thick + 0.045, distLine)) * xTaper * smoothstep(0.10, 0.30, w) * mask;" +
  "  float castSh = smoothstep(0.30, 0.0, d.y - lidY) * smoothstep(-0.04, 0.06, d.y - lidY) * (1.0 - w * 0.78) * 0.28 * xTaper * mask;" +
  "  float sh = 1.0 + clamp(-0.045 * d.x - 0.055 * d.y, -0.09, 0.07);" +
  "  return vec3(cover, clamp(line + castSh * (1.0 - cover), 0.0, 1.0), sh);" +
  "}" +
  "vec4 happyEye(vec2 uv, vec4 eye, float w){" +
  "  if (w <= 0.004) return vec4(0.0, 0.0, 0.0, 1.0);" +
  "  vec2 d = (uv - eye.xy) / eye.zw;" +
  "  float rad = length(d);" +
  "  if (rad > 1.20) return vec4(0.0, 0.0, 0.0, 1.0);" +
  "  float mask = smoothstep(1.16, 0.78, rad);" +
  "  float cover = mask * w;" +
  "  float xTaper = smoothstep(0.68, 0.22, abs(d.x));" +
  "  float yArc = -0.20 + 0.62 * (d.x * d.x);" +
  "  float thick = (0.042 + 0.068 * xTaper);" +
  "  float stroke = (1.0 - smoothstep(thick * 0.48, thick + 0.036, abs(d.y - yArc))) * xTaper * w * mask;" +
  "  float dropSh = (1.0 - smoothstep(thick * 0.55, thick + 0.09, abs(d.y - (yArc + 0.065)))) * xTaper * w * mask * 0.34;" +
  "  float sh = 1.0 + clamp(-0.045 * d.x - 0.055 * d.y, -0.09, 0.07);" +
  "  return vec4(cover, stroke, dropSh, sh);" +
  "}" +
  "void main(){" +
  "  vec4 a = texture2D(t0, vUv);" +
  "  if (uEye > 0.5) {" +
  "    vec4 col = a;" +
  "    float c2 = clamp(w2, 0.0, 1.0);" +
  "    float c1 = clamp(w1, 0.0, 1.0);" +
  "    if (c2 > 0.004 || c1 > 0.004) {" +
  "      vec4 plush = texture2D(t2, vUv);" +
  "      vec3 furRgb = plush.rgb / max(plush.a, 0.001);" +
  "      vec3 rgb = col.rgb / max(col.a, 0.001);" +
  "      if (c2 > 0.004) {" +
  "        vec3 lL = eyeLid(vUv, uEyeL, c2); vec3 lR = eyeLid(vUv, uEyeR, c2);" +
  "        float cov = max(lL.x, lR.x);" +
  "        float sh = lL.x >= lR.x ? (lL.x > 0.001 ? lL.z : 1.0) : lR.z;" +
  "        rgb = mix(rgb, furRgb * sh, cov);" +
  "        float lash = max(lL.y, lR.y);" +
  "        rgb = mix(rgb, vec3(0.14, 0.115, 0.098), lash);" +
  "      }" +
  "      if (c1 > 0.004) {" +
  "        vec4 hL = happyEye(vUv, uEyeL, c1); vec4 hR = happyEye(vUv, uEyeR, c1);" +
  "        float covH = max(hL.x, hR.x);" +
  "        float shH = hL.x >= hR.x ? (hL.x > 0.001 ? hL.w : 1.0) : hR.w;" +
  "        rgb = mix(rgb, furRgb * shH, covH);" +
  "        float dropH = max(hL.z, hR.z);" +
  "        rgb = mix(rgb, vec3(0.45, 0.38, 0.31), dropH);" +
  "        float stH = max(hL.y, hR.y);" +
  "        rgb = mix(rgb, vec3(0.14, 0.115, 0.098), stH);" +
  "      }" +
  "      col = vec4(rgb * col.a, col.a);" +
  "    }" +
  "    gl_FragColor = col;" +
  "  } else {" +
  "    vec4 b = texture2D(t1, vUv); vec4 c = texture2D(t2, vUv);" +
  "    float c1 = gate(w1); float c2 = gate(w2); float s = c1 + c2; if (s > 1.0) { c1 /= s; c2 /= s; }" +
  "    gl_FragColor = a * (1.0 - c1 - c2) + b * c1 + c * c2;" +
  "  }" +
  "}";

const FS_ACC =
  "precision mediump float; varying vec2 vUv; uniform sampler2D t0;" +
  "void main(){ gl_FragColor = texture2D(t0, vUv); }";

const KEYS = [
  "hopY", "rot", "sx", "sy", "breath", "headRot", "headTx", "headTy",
  "earL", "earR", "lean", "wClosed", "wDoze", "shS", "shO"
];

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function sstep(e0, e1, x) { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); }
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
function easeOutBack(t) { const c = 1.6; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }
function rot2d(x, y, px, py, deg) {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a), s = Math.sin(a);
  const dx = x - px, dy = y - py;
  return [px + dx * c - dy * s, py + dx * s + dy * c];
}
function makePose(o) {
  const p = {
    hopY: 0, rot: 0, sx: 1, sy: 1, breath: 0,
    headRot: 0, headTx: 0, headTy: 0,
    earL: 0, earR: 0, lean: 0,
    wClosed: 0, wDoze: 0, shS: 1, shO: 1
  };
  if (o) {
    for (const k in o) {
      if (Object.prototype.hasOwnProperty.call(o, k)) p[k] = o[k];
    }
  }
  return p;
}
function mixPose(a, b, t) {
  const p = makePose();
  for (let i = 0; i < KEYS.length; i++) {
    const k = KEYS[i];
    p[k] = lerp(a[k], b[k], t);
  }
  return p;
}
function kf(list, u) {
  const cu = clamp(u, 0, 1);
  let a = list[0], b = list[list.length - 1];
  for (let i = 1; i < list.length; i++) {
    if (cu <= list[i].o) { a = list[i - 1]; b = list[i]; break; }
  }
  let t = clamp((cu - a.o) / ((b.o - a.o) || 1), 0, 1);
  t = a.e === "out" ? easeOutCubic(t)
    : a.e === "in" ? t * t * t
      : a.e === "back" ? easeOutBack(t)
        : a.e === "io" ? easeInOut(t)
          : t;
  return mixPose(makePose(a), makePose(b), t);
}

const JUMP_KFS = [
  { o: 0,    e: "in",   sx: 1,    sy: 1 },
  { o: 0.13, e: "out",  sx: 1.10, sy: 0.84, earL: -10, earR: 10, shS: 1.15 },
  { o: 0.24, e: "out",  sx: 0.93, sy: 1.10, hopY: -26, earL: -22, earR: 22, rot: -1.5, shS: 0.9 },
  { o: 0.44, e: "in",   sx: 1.0,  sy: 1.02, hopY: -70, earL: -4,  earR: 4,  rot: 1.5 },
  { o: 0.70, e: "out",  sx: 0.95, sy: 1.07, hopY: -20, earL: 8,   earR: -8, rot: -1 },
  { o: 0.80, e: "back", sx: 1.13, sy: 0.84, hopY: 0,   earL: -20, earR: 20, shS: 1.18 },
  { o: 0.90, e: "io",   sx: 0.97, sy: 1.04, earL: 6,   earR: -6 },
  { o: 1,    e: "out",  sx: 1,    sy: 1 }
];

const MINI_KFS = [
  { o: 0,    e: "in",   hopY: 0,   sx: 1,    sy: 1,    shS: 1,    shO: 1 },
  { o: 0.18, e: "out",  hopY: 4,   sx: 1.08, sy: 0.9,  shS: 1.12, shO: 0.9 },
  { o: 0.40, e: "out",  hopY: -28, sx: 0.96, sy: 1.06, earL: -10, earR: 10, shS: 0.6, shO: 0.4 },
  { o: 0.78, e: "back", hopY: 3,   sx: 1.08, sy: 0.9,  shS: 1.12, shO: 0.85 },
  { o: 1,    e: "out",  hopY: 0,   sx: 1,    sy: 1,    shS: 1,    shO: 1 }
];

function blinkAmt(u) {
  if (u < 0 || u > 1) return 0;
  if (u < 0.22) return easeOutCubic(u / 0.22);
  if (u < 0.50) return 1;
  return 1 - easeInOut((u - 0.50) / 0.50);
}

/**
 * 平台适配层：统一浏览器与小程序的 Image / requestAnimationFrame
 */
function createPlatformAdapter(canvas) {
  const isMiniCanvas = typeof canvas.createImage === "function";
  return {
    createImage() {
      if (isMiniCanvas) return canvas.createImage();
      const img = new Image();
      img.crossOrigin = "anonymous";
      return img;
    },
    raf(cb) {
      if (typeof canvas.requestAnimationFrame === "function") {
        return canvas.requestAnimationFrame(cb);
      }
      return requestAnimationFrame(cb);
    },
    cancelRaf(id) {
      if (typeof canvas.cancelAnimationFrame === "function") {
        canvas.cancelAnimationFrame(id);
      } else if (typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(id);
      }
    }
  };
}

export class PetStage {
  constructor(canvas, opts) {
    this.canvas = canvas;
    this.adapter = createPlatformAdapter(canvas);
    this.dpr = Math.min(3, (opts && opts.dpr) || 2);
    this.onShadowUpdate = (opts && opts.onShadowUpdate) || null;
    this.onSleepChange = (opts && opts.onSleepChange) || null;
    this.onReady = (opts && opts.onReady) || null;

    this.canvas.width = Math.round(390 * this.dpr);
    this.canvas.height = Math.round(844 * this.dpr);

    const glOpts = {
      alpha: true,
      premultipliedAlpha: true,
      antialias: true
    };
    const gl =
      this.canvas.getContext("webgl", glOpts) ||
      this.canvas.getContext("experimental-webgl", glOpts);
    if (!gl) {
      throw new Error("当前设备暂不支持 WebGL");
    }
    this.gl = gl;
    this._initGL();

    this.texCache = new Map();
    this.accMeshes = new Map();
    this.pet = null;
    this.worn = { set: null, head: null, neck: null };
    this.bodyTextures = { base: null, closed: null, doze: null };
    this.petReady = false;
    this.loadToken = 0;

    this.mode = "idle";
    this.modeStart = Date.now();
    this.blinkAt = Date.now() + 2200;
    this.sleepAt = Date.now() + SLEEP_DELAY_MS;
    this.tiltDir = 1;
    this.petLean = 0;
    this.fromPose = makePose();
    this.lastPose = makePose();
    this.spring = { r: 0, vr: 0, y: 0, vy: 0, t: -1 };
    this.mood = "normal";
    this.drawerOpen = Boolean(opts && opts.drawerOpen);
    this.offsetY = this.drawerOpen ? 0 : HOME_OFFSET_Y;
    this.targetOffsetY = this.offsetY;
    this.scaleMul = this.drawerOpen ? 1 : HOME_SCALE_MUL;
    this.targetScaleMul = this.scaleMul;
    this.scrubLean = 0;
    this.sleepingNotified = false;
    this.lastShadowKey = "";

    this.rafId = null;
    this.destroyed = false;
    this._loop = this._loop.bind(this);
    this.rafId = this.adapter.raf(this._loop);
  }

  _compile(type, src) {
    const gl = this.gl;
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error("[PetStage] shader error:", gl.getShaderInfoLog(s));
    }
    return s;
  }

  _initGL() {
    const gl = this.gl;
    const prog = gl.createProgram();
    gl.attachShader(prog, this._compile(gl.VERTEX_SHADER, VS_BODY));
    gl.attachShader(prog, this._compile(gl.FRAGMENT_SHADER, FS_BODY));
    gl.linkProgram(prog);
    this.prog = prog;
    this.aPos = gl.getAttribLocation(prog, "aPos");
    this.aUv = gl.getAttribLocation(prog, "aUv");
    this.uT0 = gl.getUniformLocation(prog, "t0");
    this.uT1 = gl.getUniformLocation(prog, "t1");
    this.uT2 = gl.getUniformLocation(prog, "t2");
    this.uW1 = gl.getUniformLocation(prog, "w1");
    this.uW2 = gl.getUniformLocation(prog, "w2");
    this.uEye = gl.getUniformLocation(prog, "uEye");
    this.uEyeL = gl.getUniformLocation(prog, "uEyeL");
    this.uEyeR = gl.getUniformLocation(prog, "uEyeR");
    this.uView = gl.getUniformLocation(prog, "uView");

    const progA = gl.createProgram();
    gl.attachShader(progA, this._compile(gl.VERTEX_SHADER, VS_BODY));
    gl.attachShader(progA, this._compile(gl.FRAGMENT_SHADER, FS_ACC));
    gl.linkProgram(progA);
    this.progA = progA;
    this.aPosA = gl.getAttribLocation(progA, "aPos");
    this.aUvA = gl.getAttribLocation(progA, "aUv");
    this.uT0A = gl.getUniformLocation(progA, "t0");
    this.uViewA = gl.getUniformLocation(progA, "uView");

    this.viewW = 390.0;
    this.viewH = 844.0;
    gl.useProgram(this.prog);
    gl.uniform2f(this.uView, this.viewW, this.viewH);
    gl.useProgram(this.progA);
    gl.uniform2f(this.uViewA, this.viewW, this.viewH);

    this.nv = (COLS + 1) * (ROWS + 1);
    this.rest = new Float32Array(this.nv * 2);
    this.uv = new Float32Array(this.nv * 2);
    this.pos = new Float32Array(this.nv * 2);
    const idx = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const a = r * (COLS + 1) + c, b = a + 1, d = a + COLS + 1, e = d + 1;
        idx.push(a, d, b, b, d, e);
      }
    }
    this.idxCount = idx.length;
    this.posBuf = gl.createBuffer();
    this.uvBuf = gl.createBuffer();
    this.idxBuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.idxBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  _loadTexture(url) {
    if (this.texCache.has(url)) {
      return Promise.resolve(this.texCache.get(url));
    }
    return new Promise((resolve, reject) => {
      const img = this.adapter.createImage();
      img.onload = () => {
        if (this.destroyed) return;
        const gl = this.gl;
        const t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        this.texCache.set(url, t);
        resolve(t);
      };
      img.onerror = (err) => reject(err);
      img.src = url;
    });
  }

  _getAccMesh(it) {
    const key = `${this.pet.id}:${it.id}`;
    if (this.accMeshes.has(key)) return this.accMeshes.get(key);
    const gl = this.gl;
    const nv = (ACC_COLS + 1) * (ACC_ROWS + 1);
    const rest = new Float32Array(nv * 2);
    const uv = new Float32Array(nv * 2);
    const pos = new Float32Array(nv * 2);
    for (let r = 0, i = 0; r <= ACC_ROWS; r++) {
      for (let c = 0; c <= ACC_COLS; c++, i++) {
        const u = c / ACC_COLS, v = r / ACC_ROWS;
        rest[i * 2] = it.x + u * it.w;
        rest[i * 2 + 1] = it.y + v * it.h;
        uv[i * 2] = u;
        uv[i * 2 + 1] = v;
      }
    }
    const idx = [];
    for (let r = 0; r < ACC_ROWS; r++) {
      for (let c = 0; c < ACC_COLS; c++) {
        const a = r * (ACC_COLS + 1) + c, b = a + 1, d = a + ACC_COLS + 1, e = d + 1;
        idx.push(a, d, b, b, d, e);
      }
    }
    const uvBuf = gl.createBuffer();
    const posBuf = gl.createBuffer();
    const idxBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
    gl.bufferData(gl.ARRAY_BUFFER, uv, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, pos, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
    const mesh = { rest, pos, nv, idxCount: idx.length, uvBuf, posBuf, idxBuf, slot: it.slot, texUrl: it.texUrl };
    this.accMeshes.set(key, mesh);
    return mesh;
  }

  setViewport(cssW, cssH) {
    if (!cssW || !cssH || cssW <= 0 || cssH <= 0) return;
    const gl = this.gl;
    this.viewH = 844.0;
    this.viewW = 844.0 * (cssW / cssH);
    const pw = Math.max(1, Math.round(cssW * this.dpr));
    const ph = Math.max(1, Math.round(cssH * this.dpr));
    if (this.canvas.width !== pw || this.canvas.height !== ph) {
      this.canvas.width = pw;
      this.canvas.height = ph;
    }
    gl.viewport(0, 0, pw, ph);
    gl.useProgram(this.prog);
    gl.uniform2f(this.uView, this.viewW, this.viewH);
    gl.useProgram(this.progA);
    gl.uniform2f(this.uViewA, this.viewW, this.viewH);
  }

  setPet(petConfig, initialWorn) {
    const token = ++this.loadToken;
    this.pet = petConfig;
    this.petReady = false;
    this.worn = Object.assign({ set: null, head: null, neck: null }, initialWorn || {});
    this.ox = petConfig.feetStageX - petConfig.cx * petConfig.scale;
    this.oy = petConfig.feetStageY - petConfig.feetY * petConfig.scale;

    for (let r = 0, i = 0; r <= ROWS; r++) {
      for (let c = 0; c <= COLS; c++, i++) {
        const u = c / COLS, v = r / ROWS;
        this.rest[i * 2] = u * petConfig.canvasW;
        this.rest[i * 2 + 1] = v * petConfig.canvasH;
        this.uv[i * 2] = u;
        this.uv[i * 2 + 1] = v;
      }
    }
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.uv, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.pos, gl.DYNAMIC_DRAW);

    this.hasDoze = false;
    this.hasClosed = false;

    // 首帧渐进加载：仅等 base 一张图到位即立刻出宠物，doze/closed 后台静默补齐
    this._loadTexture(petConfig.textures.base)
      .then((tBase) => {
        if (this.destroyed || token !== this.loadToken) return;
        this.bodyTextures = { base: tBase, closed: tBase, doze: tBase };
        this.petReady = true;
        this._resetIdle(Date.now());
        if (this.worn.set) this._preloadWornItem(this.worn.set);
        if (this.worn.head) this._preloadWornItem(this.worn.head);
        if (this.worn.neck) this._preloadWornItem(this.worn.neck);
        if (this.onReady) this.onReady(petConfig.id);

        if (petConfig.textures.doze) {
          this._loadTexture(petConfig.textures.doze)
            .then((tDoze) => {
              if (this.destroyed || token !== this.loadToken) return;
              this.bodyTextures.doze = tDoze;
              this.hasDoze = true;
            })
            .catch(() => {});
        }
        // 锦鲤启用动态着色器时无需下载 closed 贴图，直接省去一次网络请求
        if (!petConfig.useEyeShader && petConfig.textures.closed) {
          this._loadTexture(petConfig.textures.closed)
            .then((tClosed) => {
              if (this.destroyed || token !== this.loadToken) return;
              this.bodyTextures.closed = tClosed;
              this.hasClosed = true;
            })
            .catch(() => {});
        } else {
          this.hasClosed = true;
        }

        // 首帧稳定后后台静默预热前 4 套常用套装，点击换装零等待
        setTimeout(() => {
          if (this.destroyed || token !== this.loadToken || !petConfig.items) return;
          const warmCount = Math.min(4, petConfig.items.length);
          for (let i = 0; i < warmCount; i++) {
            const it = petConfig.items[i];
            if (it && it.texUrl && !this.texCache.has(it.texUrl)) {
              this._loadTexture(it.texUrl).catch(() => {});
            }
          }
        }, 600);
      })
      .catch((err) => {
        console.error("[PetStage] failed to load pet base texture:", err);
      });
  }

  _preloadWornItem(itemId) {
    if (!this.pet || !itemId) return;
    const it = this.pet.items.find((x) => x.id === itemId);
    if (!it) return;
    if (it.slot !== "set") this._getAccMesh(it);
    this._loadTexture(it.texUrl).catch((err) => {
      console.error("[PetStage] failed to load item texture:", it.id, err);
    });
    if (it.closedTexUrl) {
      this._loadTexture(it.closedTexUrl).catch((err) => {
        console.error("[PetStage] failed to load item closed texture:", it.id, err);
      });
    }
    if (it.dozeTexUrl) {
      this._loadTexture(it.dozeTexUrl).catch((err) => {
        console.error("[PetStage] failed to load item doze texture:", it.id, err);
      });
    }
  }

  setWorn(nextWorn, triggerHop) {
    this.worn = Object.assign({ set: null, head: null, neck: null }, nextWorn || {});
    if (this.worn.set) this._preloadWornItem(this.worn.set);
    if (this.worn.head) this._preloadWornItem(this.worn.head);
    if (this.worn.neck) this._preloadWornItem(this.worn.neck);
    if (triggerHop && (this.mode === "idle" || this.mode === "pet-release" || this.mode === "doze")) {
      this._begin("minihop", Date.now());
    }
  }

  _begin(nextMode, now) {
    this.mode = nextMode;
    this.modeStart = now;
    this.sleepAt = now + SLEEP_DELAY_MS;
    this._notifySleep(nextMode === "doze" || nextMode === "doze-enter");
  }

  _resetIdle(now) {
    this.mode = "idle";
    this.modeStart = now;
    this.sleepAt = now + SLEEP_DELAY_MS;
    this.blinkAt = now + 1800 + Math.random() * 2400;
    this._notifySleep(false);
  }

  _notifySleep(flag) {
    if (this.sleepingNotified !== flag) {
      this.sleepingNotified = flag;
      if (this.onSleepChange) this.onSleepChange(flag);
    }
  }

  _currentTransform() {
    const pet = this.pet;
    const s = pet.scale * this.scaleMul;
    const fx = pet.feetStageX;
    const fy = pet.feetStageY + this.offsetY;
    return {
      s,
      fx,
      fy,
      ox: fx - pet.cx * s,
      oy: fy - pet.feetY * s
    };
  }

  setDrawerOpen(open) {
    this.drawerOpen = Boolean(open);
    this.targetOffsetY = this.drawerOpen ? 0 : HOME_OFFSET_Y;
    this.targetScaleMul = this.drawerOpen ? 1 : HOME_SCALE_MUL;
  }

  setMood(mood) {
    this.mood = mood || "normal";
  }

  playEat() {
    if (!this.pet || !this.petReady) return;
    this._begin("eat", Date.now());
  }

  startScrub(stageX) {
    if (!this.pet || !this.petReady) return;
    const now = Date.now();
    this.scrubLean = clamp((stageX - 195) / 90, -1, 1);
    if (this.mode !== "scrub") {
      this._begin("scrub", now);
    } else {
      this.sleepAt = now + SLEEP_DELAY_MS;
    }
  }

  stopScrub() {
    if (this.mode === "scrub") {
      this._resetIdle(Date.now());
    }
  }

  playRinse() {
    if (!this.pet || !this.petReady) return;
    this._begin("rinse", Date.now());
  }

  getPetAnchor() {
    if (!this.pet) return { x: 195, mouthY: 500, topY: 360, feetY: 657 };
    const tr = this._currentTransform();
    const h = this.pet.head;
    return {
      x: tr.ox + this.pet.cx * tr.s,
      mouthY: tr.oy + (h.y + h.ry * 0.45) * tr.s,
      topY: tr.oy + Math.max(0, h.y - h.ry * 1.45) * tr.s,
      feetY: tr.fy
    };
  }

  isPointOnPet(stageX, stageY, pad = 28) {
    if (!this.pet || !this.petReady) return false;
    const tr = this._currentTransform();
    const sx = (stageX - tr.ox) / tr.s;
    const sy = (stageY - tr.oy) / tr.s;
    const padSrc = pad / tr.s;
    return (
      sx >= -padSrc &&
      sx <= this.pet.canvasW + padSrc &&
      sy >= -padSrc &&
      sy <= this.pet.canvasH + padSrc
    );
  }

  onTap(stageX, stageY) {
    if (!this.pet || !this.petReady) return;
    const now = Date.now();
    if (this.mode === "doze" || this.mode === "doze-enter") {
      this.fromPose = this.lastPose;
      this._begin("wake", now);
      return;
    }
    const tr = this._currentTransform();
    const sx = (stageX - tr.ox) / tr.s;
    const sy = (stageY - tr.oy) / tr.s;
    const h = this.pet.head;
    const hd = Math.pow((sx - h.x) / h.rx, 2) + Math.pow((sy - h.y) / h.ry, 2);
    if (hd <= 1.05 || sy < this.pet.neck.y) {
      this.tiltDir = sx < this.pet.cx ? -1 : 1;
      this._begin("tilt", now);
    } else {
      this._begin("jump", now);
    }
  }

  onPetMove(stageX) {
    if (!this.pet || !this.petReady) return;
    const now = Date.now();
    this.petLean = clamp((stageX - 195) / 85, -1, 1);
    if (this.mode !== "pet") {
      this._begin("pet", now);
    } else {
      this.sleepAt = now + SLEEP_DELAY_MS;
    }
  }

  onPetEnd() {
    if (this.mode === "pet") {
      this._begin("pet-release", Date.now());
    }
  }

  _stepSpring(p, now) {
    const sp = this.spring;
    const dt = sp.t < 0 ? 0 : (now - sp.t) / 1000;
    sp.t = now;
    if (dt <= 0 || dt > 0.1) {
      sp.r = p.headRot; sp.vr = 0; sp.y = p.hopY; sp.vy = 0;
      return;
    }
    const n = Math.max(1, Math.ceil(dt / 0.008));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      sp.vr += (-(sp.r - p.headRot) * 150 - sp.vr * 9) * h;
      sp.r += sp.vr * h;
      sp.vy += (-(sp.y - p.hopY) * 140 - sp.vy * 9) * h;
      sp.y += sp.vy * h;
    }
    const k = 1 - Math.exp(-dt * 11.5);
    this.offsetY += (this.targetOffsetY - this.offsetY) * k;
    this.scaleMul += (this.targetScaleMul - this.scaleMul) * k;
  }

  _deform(x, y, p, eL, eR) {
    const pet = this.pet;
    const h = pet.head;
    const hd = Math.sqrt(Math.pow((x - h.x) / h.rx, 2) + Math.pow((y - h.y) / h.ry, 2));
    const earTop = pet.id === "yutu" ? pet.earL.y + 82 : pet.earL.y + 24;
    const earBot = pet.id === "yutu" ? pet.earL.y - 18 : pet.earL.y - 70;
    const out = sstep(0.9, 1.04, hd) * sstep(earTop, earBot, y);
    if (out > 0) {
      const side = sstep(pet.cx - 30, pet.cx + 30, x);
      const piv = side < 0.5 ? pet.earL : pet.earR;
      const span = pet.id === "yutu" ? 330 : 80;
      const along = clamp((piv.y - y) / span, 0, 1);
      const ang = lerp(eL, eR, side) * out * (0.55 + 0.45 * along) * pet.earAmp;
      const r = rot2d(x, y, piv.x, piv.y, ang);
      x = r[0]; y = r[1];
    }
    const bSpan = pet.id === "yutu" ? 140 : h.ry * 0.9;
    const bw = Math.exp(-Math.pow((y - pet.bodyY) / bSpan, 2));
    x += (x - pet.cx) * p.breath * bw;

    const wBody = pet.id === "yutu"
      ? sstep(pet.neck.y - 68, pet.neck.y + 72, y)
      : sstep(pet.neck.y - 70, pet.neck.y + 24, y);
    const neckY = pet.feetY + (pet.neck.y - pet.feetY) * p.sy;
    const yBody = pet.feetY + (y - pet.feetY) * p.sy;
    const yHead = y + (neckY - pet.neck.y);
    const feetPin = pet.id === "yutu"
      ? sstep(pet.feetY - 145, pet.feetY - 25, y)
      : sstep(pet.feetY - 130, pet.feetY - 12, y);
    const kx = lerp(p.sx, 1 + (p.sx - 1) * 0.12, 1 - wBody);
    const kx2 = lerp(kx, 1 + (kx - 1) * 0.4, feetPin);
    x = pet.cx + (x - pet.cx) * kx2;
    y = lerp(yHead, yBody, wBody);

    const wh = pet.id === "yutu"
      ? sstep(pet.neck.y + 152, pet.neck.y - 48, y)
      : sstep(pet.neck.y + 36, pet.neck.y - 80, y);
    if (wh > 0) {
      const r = rot2d(x, y, pet.neck.x, neckY, p.headRot * wh);
      x = r[0] + p.headTx * wh;
      y = r[1] + p.headTy * wh;
    }
    const leanAmp = pet.id === "yutu" ? 20 : 16;
    const leanTop = pet.id === "yutu" ? pet.neck.y - 108 : h.y;
    x += p.lean * leanAmp * sstep(pet.feetY, leanTop, y);
    return [x, y];
  }

  _idlePose(t, blink) {
    const lowMood = this.mood === "hungry" || this.mood === "dirty";
    const speed = lowMood ? 3500 : 2600;
    const b = Math.sin((t / speed) * Math.PI * 2);
    const tw = (t % 4300) / 4300;
    const twitch = !lowMood && tw > 0.9 ? Math.sin(((tw - 0.9) / 0.1) * Math.PI * 2) * 6 : 0;
    const isKoi = this.pet && this.pet.id === "koi";
    return makePose({
      sx: 1 - 0.006 * b,
      sy: (lowMood ? 0.985 : 1) + 0.012 * b,
      breath: (isKoi ? 0.014 : 0.018) * b,
      headRot: (lowMood ? 3.5 : isKoi ? 6.5 : 0.8) * Math.sin((t / 3600) * Math.PI * 2),
      headTy: lowMood ? 5 : 0,
      earL: (lowMood ? -7 : -0.9) + 1.8 * Math.sin((t / 2500) * Math.PI * 2 + 0.3),
      earR: (lowMood ? (isKoi ? 6 : 16) : 0.9) + 1.8 * Math.sin((t / 2800) * Math.PI * 2 + 1.4) + twitch * (isKoi ? 0.5 : 1),
      wDoze: blink || 0
    });
  }

  _dozePose(t) {
    const b = Math.sin((t / 4400) * Math.PI * 2);
    const isKoi = this.pet && this.pet.id === "koi";
    return makePose({
      sx: 1.01,
      sy: 0.985 + 0.008 * b,
      breath: 0.022 * b,
      headRot: 6 + 1.2 * b,
      headTy: isKoi ? 6 : 8,
      rot: 1,
      earL: -5 + b,
      earR: (isKoi ? 8 : 56) + 2.5 * b,
      wDoze: 1,
      shS: 1.03
    });
  }

  _petPose(lean) {
    return makePose({
      sx: 1.04,
      sy: 0.96,
      headRot: lean * 9,
      headTx: lean * 6,
      headTy: 5,
      earL: -8 + lean * 4,
      earR: 8 + lean * 4,
      lean,
      wClosed: 1,
      shS: 1.06
    });
  }

  _computePose(now) {
    const t = now - this.modeStart;
    if (this.mode === "idle") {
      if (now >= this.sleepAt) {
        this.fromPose = this.lastPose;
        this._begin("doze-enter", now);
        return this.lastPose;
      }
      let bl = 0;
      if (now >= this.blinkAt) {
        const u = (now - this.blinkAt) / BLINK_MS;
        if (u <= 1) bl = blinkAmt(u);
        else this.blinkAt = now + 2200 + Math.random() * 2600;
      }
      return this._idlePose(now, bl);
    }
    if (this.mode === "jump") {
      if (t >= JUMP_MS) { this._resetIdle(now); return this._idlePose(now, 0); }
      return kf(JUMP_KFS, t / JUMP_MS);
    }
    if (this.mode === "minihop") {
      if (t >= MINI_MS) { this._resetIdle(now); return this._idlePose(now, 0); }
      return kf(MINI_KFS, t / MINI_MS);
    }
    if (this.mode === "eat") {
      if (t >= EAT_MS) { this._resetIdle(now); return this._idlePose(now, 0); }
      return kf([
        { o: 0,    e: "out", sx: 1,    sy: 1,    wClosed: 0 },
        { o: 0.14, e: "io",  sx: 1.09, sy: 0.91, headTy: 5,  headRot: -4, wClosed: 0.95, earL: -10, earR: 10, shS: 1.09 },
        { o: 0.30, e: "io",  sx: 0.96, sy: 1.06, headTy: -3, headRot: 4,  wClosed: 1,    earL: 5,   earR: -5, hopY: -6 },
        { o: 0.46, e: "io",  sx: 1.09, sy: 0.91, headTy: 5,  headRot: -4, wClosed: 1,    earL: -10, earR: 10, shS: 1.09 },
        { o: 0.64, e: "io",  sx: 0.96, sy: 1.07, headTy: -4, headRot: 3,  wClosed: 1,    earL: 6,   earR: -6, hopY: -12 },
        { o: 0.82, e: "back", sx: 1.05, sy: 0.95, headTy: 1, headRot: 0,  wClosed: 0.55, hopY: 0 },
        { o: 1,    e: "out", sx: 1,    sy: 1,    wClosed: 0 }
      ], t / EAT_MS);
    }
    if (this.mode === "scrub") {
      const w = Math.sin((now / 210) * Math.PI * 2);
      return makePose({
        sx: 1.03 + 0.025 * w,
        sy: 0.97 - 0.025 * w,
        headRot: this.scrubLean * 8 + w * 4.5,
        headTx: this.scrubLean * 5,
        headTy: 4,
        rot: w * 1.8,
        earL: -9 + w * 6,
        earR: 9 - w * 6,
        lean: this.scrubLean * 0.75,
        wClosed: 0.92,
        shS: 1.05
      });
    }
    if (this.mode === "rinse") {
      if (t >= RINSE_MS) { this._resetIdle(now); return this._idlePose(now, 0); }
      const u = t / RINSE_MS;
      if (u < 0.62) {
        const shake = Math.sin((u / 0.62) * Math.PI * 6);
        const env = Math.sin((u / 0.62) * Math.PI);
        return makePose({
          sx: 1 + 0.06 * Math.abs(shake) * env,
          sy: 1 - 0.05 * Math.abs(shake) * env,
          rot: shake * 6.5 * env,
          headRot: shake * 12 * env,
          earL: -18 * shake * env,
          earR: 18 * shake * env,
          wClosed: 0.85 * env,
          shS: 1.08
        });
      }
      const hu = (u - 0.62) / 0.38;
      return kf([
        { o: 0,    e: "out", sx: 1.08, sy: 0.9,  hopY: 0,   wClosed: 0.6 },
        { o: 0.42, e: "out", sx: 0.95, sy: 1.08, hopY: -36, wClosed: 1, earL: -12, earR: 12, shS: 0.68, shO: 0.45 },
        { o: 0.78, e: "back", sx: 1.08, sy: 0.91, hopY: 0,  wClosed: 0.4, shS: 1.12 },
        { o: 1,    e: "out", sx: 1,    sy: 1,    hopY: 0,   wClosed: 0 }
      ], hu);
    }
    if (this.mode === "tilt") {
      if (t >= TILT_MS) { this._resetIdle(now); return this._idlePose(now, 0); }
      const s = this.tiltDir;
      return kf([
        { o: 0,    e: "out" },
        { o: 0.24, e: "io",  headRot: 13 * s, rot: 1.5 * s, headTy: 3, earL: -6 * s, earR: -6 * s },
        { o: 0.40, e: "io",  headRot: 12 * s, rot: 1.5 * s, headTy: 3, earL: 4 * s,  earR: 4 * s },
        { o: 0.55, e: "lin", headRot: 12 * s, rot: 1.5 * s, headTy: 3, wDoze: 1 },
        { o: 0.66, e: "out", headRot: 10 * s, rot: 1 * s,   headTy: 2, wDoze: 0 },
        { o: 0.84, e: "io",  headRot: 4 * s,  earL: 3 * s,  earR: 3 * s },
        { o: 1,    e: "out" }
      ], t / TILT_MS);
    }
    if (this.mode === "pet") {
      return this._petPose(this.petLean);
    }
    if (this.mode === "pet-release") {
      if (t >= PET_RELEASE_MS) { this._resetIdle(now); return this._idlePose(now, 0); }
      const u = t / PET_RELEASE_MS;
      const p = mixPose(this._petPose(this.petLean), this._idlePose(now, 0), easeInOut(u));
      p.wClosed = u < 0.4 ? 1 : 1 - easeOutCubic((u - 0.4) / 0.6);
      return p;
    }
    if (this.mode === "doze-enter") {
      if (t >= SLEEP_ENTER_MS) { this._begin("doze", now); return this._dozePose(now); }
      const u = t / SLEEP_ENTER_MS;
      const target = this._dozePose(0);
      const p = mixPose(this.fromPose, target, easeInOut(clamp(u / 0.65, 0, 1)));
      p.wDoze = u < 0.2 ? easeOutCubic(u / 0.2) : 1;
      p.earR = lerp(this.fromPose.earR, target.earR, easeInOut(clamp((u - 0.35) / 0.65, 0, 1)));
      return p;
    }
    if (this.mode === "doze") {
      return this._dozePose(t);
    }
    if (this.mode === "wake") {
      if (t >= WAKE_MS) { this._resetIdle(now); return this._idlePose(now, 0); }
      return kf([
        Object.assign({ o: 0, e: "out" }, this.fromPose),
        { o: 0.25, e: "out", wDoze: 0.4, headRot: 2, sy: 1.05, sx: 0.97, hopY: -4 },
        { o: 0.55, e: "io",  wDoze: 0,   sy: 1.08, sx: 0.95, hopY: -12, earL: 6, earR: -8 },
        { o: 1,    e: "out" }
      ], t / WAKE_MS);
    }
    return this._idlePose(now, 0);
  }

  _draw(p, now) {
    const gl = this.gl;
    const pet = this.pet;
    this.lastPose = p;
    this._stepSpring(p, now);

    const tr = this._currentTransform();
    const lagR = clamp(this.spring.r - p.headRot, -25, 25);
    const lagY = clamp((this.spring.y - p.hopY) * 0.6, -18, 28);
    const eL = p.earL + lagR * 1.1 - lagY;
    const eR = p.earR + lagR * 1.1 + lagY;
    const cr = Math.cos((p.rot * Math.PI) / 180);
    const sr = Math.sin((p.rot * Math.PI) / 180);

    for (let i = 0; i < this.nv; i++) {
      const d = this._deform(this.rest[i * 2], this.rest[i * 2 + 1], p, eL, eR);
      const dx = d[0] - pet.cx;
      const dy = d[1] - pet.feetY;
      const rx = pet.cx + dx * cr - dy * sr;
      const ry = pet.feetY + dx * sr + dy * cr;
      this.pos[i * 2] = tr.ox + rx * tr.s;
      this.pos[i * 2 + 1] = tr.oy + ry * tr.s + p.hopY;
    }

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    let t0 = this.bodyTextures.base;
    let t1 = this.bodyTextures.closed;
    let t2 = this.bodyTextures.doze;
    let activeItem = null;
    if (pet.mode === "sets" && this.worn.set) {
      const it = pet.items.find((x) => x.id === this.worn.set);
      if (it && this.texCache.has(it.texUrl)) {
        t0 = this.texCache.get(it.texUrl);
        activeItem = it;
        if (!pet.useEyeShader) {
          t1 = (it.closedTexUrl && this.texCache.has(it.closedTexUrl)) ? this.texCache.get(it.closedTexUrl) : t0;
          t2 = (it.dozeTexUrl && this.texCache.has(it.dozeTexUrl)) ? this.texCache.get(it.dozeTexUrl) : t0;
        }
      }
    }

    gl.useProgram(this.prog);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, t0); gl.uniform1i(this.uT0, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, t1); gl.uniform1i(this.uT1, 1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, t2); gl.uniform1i(this.uT2, 2);

    const rawW1 = clamp(p.wClosed, 0, 1);
    const rawW2 = clamp(p.wDoze, 0, pet.useEyeShader ? 1 : 1 - rawW1);
    const safeW1 = pet.useEyeShader ? (this.hasDoze ? rawW1 : 0) : (this.hasClosed ? rawW1 : 0);
    const safeW2 = this.hasDoze ? rawW2 : 0;
    gl.uniform1f(this.uW1, safeW1);
    gl.uniform1f(this.uW2, safeW2);
    gl.uniform1f(this.uEye, pet.useEyeShader ? 1.0 : 0.0);
    gl.uniform4fv(this.uEyeL, (activeItem && activeItem.eyeLUV) ? activeItem.eyeLUV : pet.eyeLUV);
    gl.uniform4fv(this.uEyeR, (activeItem && activeItem.eyeRUV) ? activeItem.eyeRUV : pet.eyeRUV);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuf);
    gl.enableVertexAttribArray(this.aUv);
    gl.vertexAttribPointer(this.aUv, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.pos);
    gl.enableVertexAttribArray(this.aPos);
    gl.vertexAttribPointer(this.aPos, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.idxBuf);
    gl.drawElements(gl.TRIANGLES, this.idxCount, gl.UNSIGNED_SHORT, 0);

    if (pet.mode === "accessories") {
      const slots = [this.worn.neck, this.worn.head];
      for (let s = 0; s < slots.length; s++) {
        const id = slots[s];
        if (!id) continue;
        const it = pet.items.find((x) => x.id === id);
        if (!it || !this.texCache.has(it.texUrl)) continue;
        const mesh = this._getAccMesh(it);
        const p2 = it.slot === "neck"
          ? makePose({ sx: p.sx, sy: p.sy, breath: p.breath, lean: p.lean })
          : p;
        for (let i = 0; i < mesh.nv; i++) {
          const d = this._deform(mesh.rest[i * 2], mesh.rest[i * 2 + 1], p2, 0, 0);
          const dx = d[0] - pet.cx;
          const dy = d[1] - pet.feetY;
          const rx = pet.cx + dx * cr - dy * sr;
          const ry = pet.feetY + dx * sr + dy * cr;
          mesh.pos[i * 2] = tr.ox + rx * tr.s;
          mesh.pos[i * 2 + 1] = tr.oy + ry * tr.s + p.hopY;
        }
        gl.useProgram(this.progA);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.texCache.get(it.texUrl));
        gl.uniform1i(this.uT0A, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.uvBuf);
        gl.enableVertexAttribArray(this.aUvA);
        gl.vertexAttribPointer(this.aUvA, 2, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.posBuf);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, mesh.pos);
        gl.enableVertexAttribArray(this.aPosA);
        gl.vertexAttribPointer(this.aPosA, 2, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.idxBuf);
        gl.drawElements(gl.TRIANGLES, mesh.idxCount, gl.UNSIGNED_SHORT, 0);
      }
    }

    if (this.onShadowUpdate) {
      const air = clamp(-p.hopY / 70, 0, 1);
      const softS = +(p.shS * this.scaleMul * (1 - 0.5 * air)).toFixed(2);
      const softO = +(p.shO * (1 - 0.7 * air)).toFixed(2);
      const conS = +(p.shS * this.scaleMul * (1 - 0.6 * air)).toFixed(2);
      const conO = +(1 - 0.85 * air).toFixed(2);
      const key = `${softS}|${softO}|${conS}|${conO}`;
      if (key !== this.lastShadowKey) {
        this.lastShadowKey = key;
        this.onShadowUpdate({ softS, softO, conS, conO });
      }
    }
  }

  _loop() {
    if (this.destroyed) return;
    if (this.pet && this.petReady) {
      const now = Date.now();
      const pose = this._computePose(now);
      this._draw(pose, now);
    }
    this.rafId = this.adapter.raf(this._loop);
  }

  destroy() {
    this.destroyed = true;
    if (this.rafId) {
      this.adapter.cancelRaf(this.rafId);
    }
  }
}
