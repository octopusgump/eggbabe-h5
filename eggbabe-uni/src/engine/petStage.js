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

const FS_FACE =
  "precision mediump float; varying vec2 vUv; uniform sampler2D tF; uniform float uA;" +
  "void main(){ gl_FragColor = texture2D(tF, vUv) * uA; }";

const EMO_KINDS = ["laugh", "sad", "think", "cute"];
const EMO_REPICK_MS = 650;
const BLEND_MS = 140;

const EMO_FACES = {
  yutu: {
    rect: [230, 425, 620, 680], closedTex: true, stalk: false, stalkK: 1,
    eyes: [
      { x: 341, y: 553, r: 27, ex: 327, ey: 549, erx: 43, ery: 52 },
      { x: 503, y: 554, r: 27, ex: 521, ey: 549, erx: 44, ery: 51 }
    ],
    mouth: { x: 421, y: 620, w: 46, h: 30 }, eraseMouth: null,
    browLen: 46, browGap: 6, gloom: { x: 421, y: 432, w: 54, h: 44 },
    lookUp: [4, -11], bubble: { x: 421, y: 16 },
    anchors: { L: [248, 485], R: [594, 485], top: [421, 315] },
    lines: {
      laugh: ["哈哈哈，好痒呀～", "嘿嘿，再来一次！", "笑得耳朵都抖啦"],
      sad: ["呜…胡萝卜掉了", "没人陪我玩…", "心里空空的…"],
      think: ["嗯…月亮上有什么呢？", "让我想想哦…", "今天吃什么好呢？"],
      cute: ["抱抱我嘛～", "人家最可爱啦♡", "眯眯眼，看不见你啦"]
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
    lookUp: [5, -14], bubble: { x: 328, y: 82 },
    anchors: { L: [134, 327], R: [522, 327], top: [410, 204] },
    lines: {
      laugh: ["咕噜噜，笑出泡泡啦！", "哈哈，好运来啦～", "痒痒的，嘻嘻"],
      sad: ["呜…泡泡破掉了", "鳍鳍好累哦…", "今天运气有点差…"],
      think: ["咦？水面上是什么？", "让我咕噜一下…", "嗯…好运藏在哪？"],
      cute: ["摸摸我，好运加倍♡", "转个圈给你看～", "嘿嘿，我最锦鲤啦"]
    }
  }
};

function earSide(s, v) { return s > 0 ? { earL: 0, earR: v } : { earL: -v, earR: 0 }; }
function K(o, e, pose, extra) { return Object.assign({ o, e }, pose, extra || {}); }

const EMO_DEFS = {
  laugh: {
    ms: 2400,
    keys(s) {
      const hop = (o, d) => K(o, "in", { hopY: -10, sy: 1.03, sx: 0.98, headRot: 5 * d, earL: d > 0 ? -14 : -5, earR: d > 0 ? 5 : 14, stalk: 16 * d, wClosed: 1, shS: 0.92 });
      const land = (o, d) => K(o, "out", { hopY: 0, sy: 0.95, sx: 1.05, headRot: 2 * d, earL: -8, earR: 8, stalk: 4 * d, wClosed: 1, shS: 1.08 });
      return [
        K(0, "in", {}),
        K(0.08, "out", { sx: 1.08, sy: 0.88, earL: 12, earR: -12, wClosed: 1, shS: 1.12, stalk: -8 }),
        K(0.18, "out", { hopY: -34, sy: 1.10, sx: 0.94, earL: -20, earR: 20, rot: -2, wClosed: 1, shS: 0.9, stalk: -18 }),
        K(0.28, "in", { hopY: -42, sy: 1.02, sx: 0.99, headRot: 6, earL: -8, earR: 8, rot: -1, wClosed: 1, stalk: -12 }),
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
      const sniff = (o) => K(o, "out", Object.assign({}, base, { sy: 0.965, hopY: -3, headRot: -5 * s + 1.5, stalk: 40 * s + 4 }));
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
        K(0.15, "lin", tilt), K(0.33, "out", tilt), K(0.345, "in", Object.assign({}, tilt, { hopY: -3 })), K(0.36, "out", tilt),
        K(0.375, "in", Object.assign({}, tilt, { hopY: -3 })), K(0.39, "io", tilt), K(0.5, "io", tilt),
        K(0.62, "io", Object.assign({ headRot: -6 * s, rot: -0.5 * s, headTy: 2, stalk: -12 * s }, earSide(-s, 14))),
        K(0.72, "out", { sy: 0.9, sx: 1.06, headRot: -2 * s, earL: 6, earR: -6, shS: 1.1 }),
        K(0.80, "in", { hopY: -18, sy: 1.08, sx: 0.95, earL: -14, earR: 14, shS: 0.9 }),
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
        K(0.55, "in", { hopY: -14, sy: 1.06, sx: 0.96, earL: -10, earR: 10, wClosed: 1, shS: 0.9 }),
        K(0.60, "out", { hopY: 0, sy: 0.9, sx: 1.08, earL: -6, earR: 6, wClosed: 1, shS: 1.1 }),
        K(0.65, "in", { hopY: -14, sy: 1.06, sx: 0.96, earL: -10, earR: 10, wClosed: 1, shS: 0.9 }),
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
    this.imgCache = new Map();
    this.accMeshes = new Map();
    this.pet = null;
    this.worn = { set: null, head: null, neck: null };
    this.bodyTextures = { base: null, closed: null, doze: null };
    this.petReady = false;
    this.loadToken = 0;

    this.hitCanvas = typeof document !== "undefined" ? document.createElement("canvas") : null;
    this.hitCtx = this.hitCanvas ? this.hitCanvas.getContext("2d", { willReadFrequently: true }) : null;
    this.hitTexUrl = "";
    this.faceGrid = null;
    this.faceTexCache = {};
    this.emoKeyCache = {};
    this.fxNodes = [];
    this.emo = { kind: null, side: 1, t0: 0, u: 0, beat: 0, last: null, seek: false, active: false, endAt: 0, snap: {}, prevSnap: null, prevAt: 0 };
    this.live = true;

    this.mode = "idle";
    this.modeStart = Date.now();
    this.blinkAt = Date.now() + 2200;
    this.sleepAt = Date.now() + SLEEP_DELAY_MS;
    this.tiltDir = 1;
    this.petLean = 0;
    this.fromPose = makePose();
    this.lastPose = makePose();
    this.blendFrom = null;
    this.blendUntil = 0;
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
    this.cssW = 390;
    this.cssH = 844;

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

    const progF = gl.createProgram();
    gl.attachShader(progF, this._compile(gl.VERTEX_SHADER, VS_BODY));
    gl.attachShader(progF, this._compile(gl.FRAGMENT_SHADER, FS_FACE));
    gl.linkProgram(progF);
    this.progF = progF;
    this.aPosF = gl.getAttribLocation(progF, "aPos");
    this.aUvF = gl.getAttribLocation(progF, "aUv");
    this.uTF = gl.getUniformLocation(progF, "tF");
    this.uAF = gl.getUniformLocation(progF, "uA");
    this.uViewF = gl.getUniformLocation(progF, "uView");

    this.viewW = 390.0;
    this.viewH = 844.0;
    gl.useProgram(this.prog);
    gl.uniform2f(this.uView, this.viewW, this.viewH);
    gl.useProgram(this.progA);
    gl.uniform2f(this.uViewA, this.viewW, this.viewH);
    gl.useProgram(this.progF);
    gl.uniform2f(this.uViewF, this.viewW, this.viewH);

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
        this.imgCache.set(url, img);
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

  _initFaceGrid(petId) {
    const faceCfg = EMO_FACES[petId];
    if (!faceCfg) { this.faceGrid = null; return; }
    const FR = faceCfg.rect;
    this.faceGrid = this._getAccMesh({
      id: `__face_${petId}`,
      x: FR[0],
      y: FR[1],
      w: FR[2] - FR[0],
      h: FR[3] - FR[1],
      slot: "head",
      texUrl: ""
    });
    this.faceTexCache = {};
    this.emoKeyCache = {};
    this.hitTexUrl = "";
  }

  _syncHitCanvas(texUrl) {
    if (!this.hitCtx || !this.pet || !texUrl || this.hitTexUrl === texUrl) return;
    const img = this.imgCache.get(texUrl);
    if (!img) return;
    this.hitCanvas.width = this.pet.canvasW;
    this.hitCanvas.height = this.pet.canvasH;
    this.hitCtx.clearRect(0, 0, this.pet.canvasW, this.pet.canvasH);
    this.hitCtx.drawImage(img, 0, 0, this.pet.canvasW, this.pet.canvasH);
    this.hitTexUrl = texUrl;
  }

  setViewport(cssW, cssH) {
    if (!cssW || !cssH || cssW <= 0 || cssH <= 0) return;
    this.cssW = cssW;
    this.cssH = cssH;
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
    gl.useProgram(this.progF);
    gl.uniform2f(this.uViewF, this.viewW, this.viewH);
  }

  setPet(petConfig, initialWorn) {
    const token = ++this.loadToken;
    this.pet = petConfig;
    this.petReady = false;
    this.worn = Object.assign({ set: null, head: null, neck: null }, initialWorn || {});
    this.ox = petConfig.feetStageX - petConfig.cx * petConfig.scale;
    this.oy = petConfig.feetStageY - petConfig.feetY * petConfig.scale;
    this._clearFx();
    this.emo.active = false;
    this.emo.endAt = 0;
    this.emo.prevSnap = null;
    this.emo.seek = false;
    this._initFaceGrid(petConfig.id);

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
        this._syncHitCanvas(petConfig.textures.base);
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
    this.fromPose = this.lastPose;
    this.blendFrom = this.lastPose;
    this.blendUntil = now + BLEND_MS;
    this.sleepAt = now + SLEEP_DELAY_MS;
    this.live = true;
    this._notifySleep(nextMode === "doze" || nextMode === "doze-enter");
  }

  _resetIdle(now) {
    this.mode = "idle";
    this.modeStart = now;
    this.blendFrom = this.lastPose;
    this.blendUntil = now + 260;
    this.sleepAt = now + SLEEP_DELAY_MS;
    this.blinkAt = now + 1800 + Math.random() * 2400;
    this._notifySleep(false);
  }

  _blend(p, now) {
    if (!this.blendFrom || now >= this.blendUntil) return p;
    const span = this.mode === "idle" ? 260 : BLEND_MS;
    return mixPose(this.blendFrom, p, easeOutCubic(clamp(1 - (this.blendUntil - now) / span, 0, 1)));
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

  _emoKeys(kind, s) {
    const faceCfg = EMO_FACES[this.pet.id];
    const id = `${this.pet.id}:${kind}${s > 0 ? "+" : "-"}`;
    if (!this.emoKeyCache[id]) {
      const stalkK = (faceCfg && faceCfg.stalkK) || 1.5;
      this.emoKeyCache[id] = EMO_DEFS[kind].keys(s).map((k) => {
        const copy = Object.assign({}, k);
        if (faceCfg && faceCfg.stalk) {
          const v = (copy.stalk || 0) * stalkK;
          copy.earL = v;
          copy.earR = v;
        }
        if (faceCfg && !faceCfg.closedTex && copy.wClosed) copy.wClosed = 0;
        return copy;
      });
    }
    return this.emoKeyCache[id];
  }

  _emotePose(kind, u, s, ms) {
    const faceCfg = EMO_FACES[this.pet.id];
    const stalkK = (faceCfg && faceCfg.stalkK) || 1.5;
    const def = EMO_DEFS[kind];
    const list = this._emoKeys(kind, s);
    const p = kf(list, u);
    if (def.lag && !(faceCfg && faceCfg.stalk)) {
      for (const k in def.lag) p[k] = kf(list, u - def.lag[k])[k];
    }
    if (def.add) {
      const a = def.add(u, ms, s);
      for (const k in a) {
        if (k === "stalk") {
          if (faceCfg && faceCfg.stalk) {
            p.earL += a[k] * stalkK;
            p.earR += a[k] * stalkK;
          }
        } else {
          p[k] += a[k];
        }
      }
    }
    return p;
  }

  _headStageCss(x, y, pose) {
    const p = pose || this.lastPose;
    const pet = this.pet;
    const tr = this._currentTransform();
    const cr = Math.cos((p.rot * Math.PI) / 180);
    const sr = Math.sin((p.rot * Math.PI) / 180);
    const d = this._deform(x, y, p, 0, 0);
    const dx = d[0] - pet.cx;
    const dy = d[1] - pet.feetY;
    const stX = tr.ox + (pet.cx + dx * cr - dy * sr) * tr.s;
    const stY = tr.oy + (pet.feetY + dx * sr + dy * cr) * tr.s + p.hopY;
    return [
      ((stX - 195.0) / this.viewW + 0.5) * this.cssW,
      (stY / this.viewH) * this.cssH
    ];
  }

  _clearFx() {
    while (this.fxNodes.length) {
      const n = this.fxNodes.pop();
      if (n && n.parentNode) n.parentNode.removeChild(n);
    }
  }

  _spawnFx(b, s, elapsed, pose) {
    if (typeof document === "undefined" || !this.canvas || !this.pet) return;
    const faceCfg = EMO_FACES[this.pet.id];
    if (!faceCfg) return;
    const host = document.getElementById("stage-box") || this.canvas.parentElement;
    if (!host) return;
    const cx = this.pet.cx;
    const A = faceCfg.anchors;
    const topAnchor = (side) => [cx + (A.top[0] - cx) * (side || 1), A.top[1]];
    const anchor = (at, side) => {
      if (at === "L") return A.L;
      if (at === "R") return A.R;
      if (at === "S") return side > 0 ? A.R : A.L;
      return topAnchor(side);
    };
    const n = document.createElement("div");
    n.style.cssText = "position:absolute;left:0;top:0;z-index:10;pointer-events:none;opacity:0;font:800 18px/1 'PingFang SC','Noto Sans CJK SC',sans-serif;white-space:nowrap;text-shadow:0 1px 0 #fff,0 0 4px rgba(255,255,255,.85);will-change:transform,opacity;";
    let src, frames, dur;
    const rnd = ((b.u * 1000) % 7) / 7 - 0.5;
    if (b.fx === "haha") {
      src = anchor(b.at, s); n.textContent = b.t; n.style.color = "#e0785a"; n.style.fontSize = "17px";
      const dx = (b.at === "L" ? -1 : 1) * 14; dur = 900;
      frames = [[0, 0, 0.5, 0, -8 * rnd], [dx * 0.5, -12, 1.15, 1, 0], [dx, -34, 1, 0, 6 * rnd]];
    } else if (b.fx === "tear") {
      const e = faceCfg.eyes[b.eye];
      const out = e.x < cx ? -1 : 1;
      src = [e.ex + out * e.erx * 0.55, e.ey + e.ery * 0.58];
      n.style.width = "9px"; n.style.height = "13px";
      n.style.borderRadius = "50% 50% 50% 50% / 38% 38% 62% 62%";
      n.style.background = "radial-gradient(circle at 36% 60%, #ffffff 0, #7cc6f8 42%, #2f80c8 100%)";
      n.style.boxShadow = "0 1px 3px rgba(30,80,140,.38), 0 0 2px rgba(255,255,255,.9)";
      dur = 1000;
      frames = [[0, 0, 0.5, 0, 0], [out * 1, 2, 1.15, 1, 0], [out * 2.5, 16, 1.05, 1, 0], [out * 4, 34, 0.9, 0, 0]];
    } else if (b.fx === "q") {
      src = b.flip ? (s > 0 ? A.L : A.R) : topAnchor(s); n.textContent = "?";
      n.style.color = "#6b8fc4"; n.style.fontSize = b.big ? "26px" : "18px"; dur = 1200;
      frames = [[0, 0, 0.3, 0, -20], [0, -8, 1.1, 1, 8], [4, -18, 1, 1, -6], [6, -26, 1, 0, 4]];
    } else if (b.fx === "bang") {
      src = topAnchor(s); n.textContent = "!"; n.style.color = "#ef5b3f"; n.style.fontSize = "30px"; dur = 800;
      frames = [[0, 4, 0.2, 0, 0], [0, -6, 1.35, 1, 0], [0, -8, 1, 1, 0], [0, -14, 1, 0, 0]];
    } else if (b.fx === "heart") {
      src = anchor(b.at, s); n.textContent = "♥"; n.style.color = "#ff6f91"; n.style.fontSize = "19px"; dur = 1300;
      const d = b.at === "L" ? -1 : 1;
      frames = [[0, 0, 0.3, 0, 0], [d * 6, -14, 1.1, 1, -10 * d], [-d * 4, -30, 1, 0.9, 8 * d], [d * 4, -46, 0.9, 0, 0]];
    } else {
      src = anchor(b.at, s); n.textContent = "✦"; n.style.color = "#ffc23d"; n.style.fontSize = b.at === "S2" ? "14px" : "20px"; dur = 900;
      frames = [[0, 0, 0.2, 0, 0], [0, -4, 1.3, 1, 90], [0, -8, 0.6, 0, 180]];
    }
    const st = this._headStageCss(src[0], src[1], pose);
    host.appendChild(n);
    this.fxNodes.push(n);
    const kfs = frames.map((f, i) => ({
      transform: `translate(${(st[0] + f[0]).toFixed(1)}px,${(st[1] + f[1]).toFixed(1)}px) translate(-50%,-50%) scale(${f[2]}) rotate(${f[4]}deg)`,
      opacity: f[3],
      offset: i / (frames.length - 1)
    }));
    if (typeof n.animate === "function") {
      const an = n.animate(kfs, { duration: dur, easing: b.fx === "tear" ? "cubic-bezier(.5,0,.9,.6)" : "ease-out", fill: "forwards" });
      an.onfinish = () => {
        if (n.parentNode) n.parentNode.removeChild(n);
        const idx = this.fxNodes.indexOf(n);
        if (idx >= 0) this.fxNodes.splice(idx, 1);
      };
      if (elapsed != null) {
        an.pause();
        an.currentTime = clamp(elapsed, 0, dur - 1);
      }
    }
  }

  triggerEmote(now, side, kind) {
    if (!this.pet || !this.petReady) return null;
    const faceCfg = EMO_FACES[this.pet.id];
    if (!faceCfg) return null;
    if (this.mode === "emote" && now - this.emo.t0 < EMO_REPICK_MS) return null;
    if (this.emo.seek) {
      this.emo.seek = false;
      this._clearFx();
    }
    if (this.mode === "emote" && this.emo.active) {
      this.emo.prevSnap = Object.assign({}, this.emo.snap);
      this.emo.prevAt = now;
    }
    const candidates = EMO_KINDS.filter((k) => k !== this.emo.last);
    const chosen = kind || candidates[Math.floor(Math.random() * candidates.length)];
    this.emo.kind = chosen;
    this.emo.last = chosen;
    this.emo.side = side || (Math.random() < 0.5 ? -1 : 1);
    this.emo.t0 = now;
    this.emo.u = 0;
    this.emo.beat = 0;
    this.emo.seek = false;
    this._begin("emote", now);
    const lines = faceCfg.lines[chosen];
    const speech = lines[Math.floor(Math.random() * lines.length)];
    return { kind: chosen, side: this.emo.side, speech };
  }

  seekEmote(kind, ms, side) {
    if (!this.pet || !this.petReady) return null;
    const faceCfg = EMO_FACES[this.pet.id];
    const def = EMO_DEFS[kind];
    if (!faceCfg || !def) return null;
    this.live = false;
    const s = side || 1;
    this.emo.kind = kind;
    this.emo.side = s;
    this.emo.seek = true;
    this.emo.u = clamp(ms / def.ms, 0, 1);
    this.emo.prevSnap = null;
    this.emo.endAt = 0;
    this._clearFx();
    def.beats.forEach((b) => {
      const bm = b.u * def.ms;
      if (ms >= bm && ms - bm < 1400) {
        const bp = this._emotePose(kind, b.u, s, bm);
        this._spawnFx(b, s, ms - bm, bp);
      }
    });
    const pose = this._emotePose(kind, this.emo.u, s, ms);
    this._draw(pose, ms);
    return { kind, ms, u: this.emo.u, dur: def.ms, speech: faceCfg.lines[kind][0] };
  }

  onTap(stageX, stageY) {
    if (!this.pet || !this.petReady) return null;
    const now = Date.now();
    if (this.mode === "doze" || this.mode === "doze-enter") {
      this.fromPose = this.lastPose;
      this._begin("wake", now);
      return null;
    }
    const tr = this._currentTransform();
    const sx = (stageX - tr.ox) / tr.s;
    const side = sx < this.pet.cx ? -1 : 1;
    if (this.mode === "idle" || this.mode === "emote") {
      return this.triggerEmote(now, side);
    }
    return null;
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
      return this._blend(this._idlePose(now, bl), now);
    }
    if (this.mode === "emote") {
      const def = EMO_DEFS[this.emo.kind];
      if (!def || t >= def.ms) {
        this.emo.u = 1;
        this._resetIdle(now);
        return this._blend(this._idlePose(now, 0), now);
      }
      this.emo.u = t / def.ms;
      const pose = this._blend(this._emotePose(this.emo.kind, this.emo.u, this.emo.side, t), now);
      while (this.emo.beat < def.beats.length && def.beats[this.emo.beat].u <= this.emo.u) {
        this._spawnFx(def.beats[this.emo.beat], this.emo.side, null, pose);
        this.emo.beat++;
      }
      return pose;
    }
    if (this.mode === "jump") {
      if (t >= JUMP_MS) { this._resetIdle(now); return this._idlePose(now, 0); }
      return this._blend(kf(JUMP_KFS, t / JUMP_MS), now);
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
      return this._blend(kf([
        { o: 0,    e: "out" },
        { o: 0.24, e: "io",  headRot: 13 * s, rot: 1.5 * s, headTy: 3, earL: -6 * s, earR: -6 * s },
        { o: 0.40, e: "io",  headRot: 12 * s, rot: 1.5 * s, headTy: 3, earL: 4 * s,  earR: 4 * s },
        { o: 0.55, e: "lin", headRot: 12 * s, rot: 1.5 * s, headTy: 3, wDoze: 1 },
        { o: 0.66, e: "out", headRot: 10 * s, rot: 1 * s,   headTy: 2, wDoze: 0 },
        { o: 0.84, e: "io",  headRot: 4 * s,  earL: 3 * s,  earR: 3 * s },
        { o: 1,    e: "out" }
      ], t / TILT_MS), now);
    }
    if (this.mode === "pet") {
      return this._blend(this._petPose(this.petLean), now);
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

  _paintFaceTex(id) {
    if (!this.hitCtx || !this.pet) return false;
    const faceCfg = EMO_FACES[this.pet.id];
    if (!faceCfg) return false;
    const cacheKey = `${this.pet.id}:${id}`;
    if (this.faceTexCache[cacheKey] !== undefined) return this.faceTexCache[cacheKey];

    const FR = faceCfg.rect;
    const FW = FR[2] - FR[0];
    const FH = FR[3] - FR[1];
    const cv = document.createElement("canvas");
    cv.width = FW;
    cv.height = FH;
    const c = cv.getContext("2d");
    c.translate(-FR[0], -FR[1]);

    const S = this.pet.scale;
    const CX = this.pet.cx;
    const hitCtx = this.hitCtx;
    const lw = (stagePx) => stagePx / S;
    const sampleAvg = (x, y, w, h) => {
      const d = hitCtx.getImageData(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h))).data;
      let r = 0, g = 0, b = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 200 || (d[i] + d[i + 1] + d[i + 2]) / 3 < 120) continue;
        r += d[i]; g += d[i + 1]; b += d[i + 2]; n++;
      }
      return n ? [r / n | 0, g / n | 0, b / n | 0] : [230, 225, 215];
    };
    const rgb = (col, a) => `rgba(${col[0]},${col[1]},${col[2]},${a == null ? 1 : a})`;
    const eyeClip = (ctx, e) => { ctx.beginPath(); ctx.ellipse(e.ex, e.ey, e.erx, e.ery, 0, 0, Math.PI * 2); ctx.clip(); };
    const coverPupil = (ctx, e) => {
      const top = sampleAvg(e.x - 8, e.y - e.r - 10, 16, 5);
      const bot = sampleAvg(e.x - 8, e.y + e.r + 5, 16, 5);
      const mid = sampleAvg(e.x + (e.x < CX ? -e.r - 9 : e.r + 4), e.y - 6, 5, 12);
      ctx.save(); eyeClip(ctx, e);
      const g = ctx.createLinearGradient(0, e.y - e.r - 4, 0, e.y + e.r + 4);
      g.addColorStop(0, rgb(top)); g.addColorStop(0.5, rgb(mid)); g.addColorStop(1, rgb(bot));
      ctx.filter = `blur(${lw(0.6).toFixed(2)}px)`;
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
      t.filter = "blur(5px)";
      t.lineCap = "round"; t.lineWidth = 26; t.strokeStyle = "#000"; t.fillStyle = "#000";
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
    const happyEyes = (ctx) => {
      faceCfg.eyes.forEach((e) => {
        coverPupil(ctx, e);
        stroke(ctx, INK, 2.6, (cc) => { cc.moveTo(e.x - e.r * 0.95, e.y + e.r * 0.3); cc.quadraticCurveTo(e.x, e.y - e.r * 0.95, e.x + e.r * 0.95, e.y + e.r * 0.3); });
      });
    };
    const squeezeEyes = (ctx) => {
      faceCfg.eyes.forEach((e) => {
        coverPupil(ctx, e); const d = e.x < CX ? 1 : -1, r = e.r;
        stroke(ctx, INK, 2.6, (cc) => { cc.moveTo(e.x - d * r * 0.7, e.y - r * 0.62); cc.lineTo(e.x + d * r * 0.62, e.y); cc.lineTo(e.x - d * r * 0.7, e.y + r * 0.62); });
      });
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
    const gloom = (ctx) => {
      const g = faceCfg.gloom;
      for (let i = 0; i < 4; i++) {
        const x = g.x + ((i - 1.5) * g.w) / 3, h = g.h * (i % 2 ? 0.8 : 1);
        const gr = ctx.createLinearGradient(0, g.y, 0, g.y + h);
        gr.addColorStop(0, "rgba(96,124,210,.78)"); gr.addColorStop(1, "rgba(96,124,210,0)");
        stroke(ctx, gr, 1.5, (cc) => { cc.moveTo(x, g.y); cc.lineTo(x, g.y + h); });
      }
    };
    const paintThink = (ctx, side) => {
      brows(ctx, "think", side);
      faceCfg.eyes.forEach((e) => { movePupil(ctx, e, faceCfg.lookUp[0] * side, faceCfg.lookUp[1]); });
      if (faceCfg.eraseMouth) {
        eraseMouth(ctx); const m = faceCfg.mouth, w = m.w * 0.3;
        stroke(ctx, INK, 2.1, (cc) => {
          for (let i = 0; i <= 24; i++) {
            const t = i / 24, x = m.x - w + 2 * w * t, y = m.y + Math.sin(t * Math.PI * 4) * 4.5;
            if (i) cc.lineTo(x, y); else cc.moveTo(x, y);
          }
        });
      }
    };

    if (id === "laughEyes") {
      if (faceCfg.closedTex) { this.faceTexCache[cacheKey] = false; return false; }
      happyEyes(c);
    } else if (id === "laugh") {
      eraseMouth(c); dMouth(c, faceCfg.mouth);
    } else if (id === "sad") {
      brows(c, "sad"); gloom(c);
      if (faceCfg.eraseMouth) {
        eraseMouth(c); const m = faceCfg.mouth, w = m.w * 0.36;
        stroke(c, INK, 2.2, (cc) => { cc.moveTo(m.x - w, m.y + 6); cc.quadraticCurveTo(m.x, m.y - 12, m.x + w, m.y + 6); });
      }
    } else if (id === "thinkL") {
      paintThink(c, -1);
    } else if (id === "thinkR") {
      paintThink(c, 1);
    } else if (id === "cute") {
      if (faceCfg.closedTex) { this.faceTexCache[cacheKey] = false; return false; }
      squeezeEyes(c); eraseMouth(c); const m = faceCfg.mouth, r = m.w * 0.13;
      stroke(c, INK, 2.2, (cc) => { cc.moveTo(m.x - 2 * r, m.y - 2); cc.quadraticCurveTo(m.x - r, m.y + r * 1.6, m.x, m.y - 2); cc.quadraticCurveTo(m.x + r, m.y + r * 1.6, m.x + 2 * r, m.y - 2); });
    }

    const gl = this.gl;
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
    this.faceTexCache[cacheKey] = t;
    return t;
  }

  _faceAlphas(kind, s, ms) {
    const out = {};
    const def = EMO_DEFS[kind];
    if (!def) return out;
    const dur = def.ms;
    const faces = typeof def.faces === "function" ? def.faces(s) : def.faces;
    faces.forEach((f) => {
      const a = f[1] * dur, b = f[2] * dur, fi = f[3] || 120, fo = f[4] || 120;
      out[f[0]] = ms < a ? 0 : ms < a + fi ? easeOutCubic((ms - a) / fi) : ms < b ? 1 : ms < b + fo ? 1 - (ms - b) / fo : 0;
    });
    return out;
  }

  _drawFace(p, tr, cr, sr, now) {
    if (!this.faceGrid || !this.hitCtx || !this.pet) return;
    let al = {};
    if (this.emo.kind && (this.mode === "emote" || this.emo.seek)) {
      const def = EMO_DEFS[this.emo.kind];
      al = this._faceAlphas(this.emo.kind, this.emo.side, this.emo.u * def.ms);
      if (this.emo.prevSnap && !this.emo.seek) {
        const pk = 1 - (now - this.emo.prevAt) / BLEND_MS;
        if (pk > 0) {
          for (const id in this.emo.prevSnap) al[id] = Math.max(al[id] || 0, this.emo.prevSnap[id] * pk);
        } else {
          this.emo.prevSnap = null;
        }
      }
      this.emo.active = true;
      this.emo.snap = Object.assign({}, al);
    } else if (this.emo.active || this.emo.endAt) {
      if (this.emo.active) { this.emo.active = false; this.emo.endAt = now; }
      const k = 1 - (now - this.emo.endAt) / 160;
      if (k <= 0) { this.emo.endAt = 0; this.emo.prevSnap = null; return; }
      for (const id in this.emo.snap) al[id] = this.emo.snap[id] * k;
    }

    const gl = this.gl;
    const pet = this.pet;
    const fg = this.faceGrid;
    let any = false;
    for (const id in al) {
      if (al[id] <= 0.003) continue;
      const tex = this._paintFaceTex(id);
      if (!tex) continue;
      if (!any) {
        any = true;
        for (let i = 0; i < fg.nv; i++) {
          const d = this._deform(fg.rest[i * 2], fg.rest[i * 2 + 1], p, 0, 0);
          const dx = d[0] - pet.cx;
          const dy = d[1] - pet.feetY;
          const rx = pet.cx + dx * cr - dy * sr;
          const ry = pet.feetY + dx * sr + dy * cr;
          fg.pos[i * 2] = tr.ox + rx * tr.s;
          fg.pos[i * 2 + 1] = tr.oy + ry * tr.s + p.hopY;
        }
        gl.useProgram(this.progF);
        gl.bindBuffer(gl.ARRAY_BUFFER, fg.uvBuf);
        gl.enableVertexAttribArray(this.aUvF);
        gl.vertexAttribPointer(this.aUvF, 2, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, fg.posBuf);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, fg.pos);
        gl.enableVertexAttribArray(this.aPosF);
        gl.vertexAttribPointer(this.aPosF, 2, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, fg.idxBuf);
        gl.uniform1i(this.uTF, 3);
      }
      gl.activeTexture(gl.TEXTURE3);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1f(this.uAF, clamp(al[id], 0, 1));
      gl.drawElements(gl.TRIANGLES, fg.idxCount, gl.UNSIGNED_SHORT, 0);
    }
    if (any) {
      gl.activeTexture(gl.TEXTURE0);
    }
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

    this._drawFace(p, tr, cr, sr, now);

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
    if (this.pet && this.petReady && this.live) {
      const now = Date.now();
      const pose = this._computePose(now);
      this._draw(pose, now);
    }
    this.rafId = this.adapter.raf(this._loop);
  }

  destroy() {
    this.destroyed = true;
    this._clearFx();
    if (this.rafId) {
      this.adapter.cancelRaf(this.rafId);
    }
  }
}
