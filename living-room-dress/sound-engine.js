/* ==========================================================================
   EggBabe 融合声学与双宠萌系配音引擎 (sound-engine.js)
   - 底层合成算子致敬并吸收 maximilianfeix/plinkfx (MIT License / CC0 Recipes):
     支持 Simper 零延迟状态变量滤波 (SVF)、PolyBLEP 抗混叠、modal 物理模态共鸣、
     三频段 formant 咽喉元音共振峰、负指数自然冲击衰减、4-Take 种子防重复预渲染缓存、
     同帧叠音冷却 (cooldown) 与复音上限保护、iOS audioSession 静音键兼容解锁。
   - 上层专为「玉兔 (Yutu) vs 锦鲤 (Koi)」、8 款小零食、手速联动搓澡与黑猫警长发条钟定制；
     遵循「零循环 BGM · 100% 触感微拟音与无词软萌小音节」原则，外部音频文件体积 0 KB。
   ========================================================================== */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.EggBabeSound = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : this), function () {
  "use strict";

  const TAU = Math.PI * 2;
  const VARIANTS = 4;
  const METAL_RATIOS = [1, 1.483, 1.8, 2.546, 2.63, 3.897];
  const WOOD_MODES = [1, 2.32, 4.25, 6.63];
  const BRASS_MODES = [1, 2.756, 5.404, 8.933];
  const GLASS_MODES = [1, 2.76, 5.12];

  // 玉兔：轻巧干爽羊毛毡鼻音 + 气声共振峰；锦鲤：圆润水感咽喉 + 气泡共振峰
  const YUTU_FMT = [350, 1920, 2760];
  const KOI_FMT = [470, 930, 2280];

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  /** Deterministic mulberry32 PRNG */
  function createRng(seed) {
    let s = seed | 0;
    return function () {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function polyBlep(t, dt) {
    if (dt <= 0) return 0;
    if (t < dt) {
      const u = t / dt;
      return u + u - u * u - 1;
    }
    if (t > 1 - dt) {
      const u = (t - 1) / dt;
      return u * u + u + u + 1;
    }
    return 0;
  }

  /** Zero-delay-feedback State Variable Filter (mode: 0=lp, 1=bp, 2=hp) */
  function createSvf(sr, q, mode) {
    let s1 = 0;
    let s2 = 0;
    const k = 1 / Math.max(0.25, q || 0.707);
    return function (x, fc) {
      const g = Math.tan((Math.PI * clamp(fc, 16, sr * 0.44)) / sr);
      const a1 = 1 / (1 + g * (g + k));
      const a2 = g * a1;
      const v3 = x - s2;
      const v1 = a1 * s1 + a2 * v3;
      const v2 = s2 + a2 * s1 + g * a2 * v3;
      s1 = 2 * v1 - s1;
      s2 = 2 * v2 - s2;
      return mode === 0 ? v2 : mode === 1 ? k * v1 : x - k * v1 - v2;
    };
  }

  /**
   * Pure deterministic offline multi-layer synthesizer.
   * Safe to run in both browser and Node.js unit tests.
   */
  function renderSamples(recipe, opts) {
    const o = opts || {};
    const sr = o.sampleRate || 44100;
    const seed = o.seed || 0;
    const r = createRng(seed * 7919 + 23);
    const vary = recipe.vary !== undefined ? recipe.vary : 0.35;
    const pitch = seed ? Math.pow(2, ((r() * 2 - 1) * vary) / 12) : 1;
    const vf = recipe.varyF !== undefined ? recipe.varyF : 0.8;
    const vg = recipe.varyG !== undefined ? recipe.varyG : 0.5;

    const layers = recipe.layers || [];
    let totalDur = 0.02;
    const prepped = layers.map((L) => {
      const stretch = seed && L.d ? 1 + (r() * 2 - 1) * 0.06 : 1;
      const fv = seed ? pitch * Math.pow(2, ((r() * 2 - 1) * vf) / 12) : 1;
      const gv = seed ? Math.pow(10, ((r() * 2 - 1) * vg) / 20) : 1;
      const a = Math.max(L.a !== undefined ? L.a : 0.002, 0.0015);
      const h = L.h || 0;
      const d = (L.d !== undefined ? L.d : 0.15) * stretch;
      totalDur = Math.max(totalDur, (L.at || 0) + a + h + d);
      return { L, a, h, d, fv, gv };
    });

    if (recipe.verb) totalDur += 0.18;
    const out = new Float32Array(Math.ceil(totalDur * sr) + 16);

    prepped.forEach((item, idx) => {
      const { L, a, h, d, fv, gv } = item;
      const lr = createRng(seed * 1009 + idx * 37 + 11);
      const wave = L.wave || "sine";
      const f0 = (L.freq || 440) * pitch;
      const len = a + h + d;
      const sweep = L.sweep || len;
      const curve = L.curve || 1;
      const shape = L.shape !== undefined ? L.shape : 2;
      const duty = L.duty || 0.5;
      const arpRate = L.arpRate || 0.065;
      const gain = (L.gain !== undefined ? L.gain : 0.5) * gv;
      const drive = L.drive || 0;
      const start = Math.round((L.at || 0) * sr);
      const n = Math.min(Math.round(len * sr), out.length - start);
      if (n <= 0) return;

      const q = L.q || 0.707;
      const filters = [];
      ["lp", "bp", "hp"].forEach((k, m) => {
        if (L[k]) {
          filters.push([createSvf(sr, q, m), L[k] * fv, (L[k + "To"] || L[k]) * fv]);
        }
      });
      const fmt = (L.formant || []).map((F) => [createSvf(sr, L.fmtQ || 5.5, 1), F * fv]);
      const modes = (L.modes || WOOD_MODES).slice(0, 6);
      const ph = [0, 0, 0, 0, 0, 0, 0, 0].map(() => lr());

      let phase = 0;
      let mod = 0;
      let held = 0;
      let b0 = 0;
      let b1 = 0;
      let b2 = 0;
      let br = 0;

      for (let i = 0; i < n; i++) {
        const t = i / sr;
        let f = f0;
        if (L.to) {
          let p = Math.min(t / sweep, 1);
          if (curve !== 1) p = 1 - Math.pow(1 - p, curve);
          f *= Math.pow(L.to / (L.freq || 440), p);
        }
        if (L.arp && L.arp.length) {
          const stepIdx = Math.floor(t / arpRate);
          const semi = L.arp[L.loop ? stepIdx % L.arp.length : Math.min(stepIdx, L.arp.length - 1)];
          f *= Math.pow(2, semi / 12);
        }
        if (L.vib) {
          f *= Math.pow(2, (L.vib[1] * Math.sin(TAU * L.vib[0] * t)) / 12);
        }

        const dt = f / sr;
        let p = phase;
        if (L.fm) {
          p += (L.fm[1] * Math.exp(-t / (L.fm[2] || 0.15)) * Math.sin(TAU * mod)) / TAU;
          mod = (mod + dt * L.fm[0]) % 1;
          p -= Math.floor(p);
        }

        const w = lr() * 2 - 1;
        let s = 0;
        if (wave === "triangle") {
          s = 1 - 4 * Math.abs(((p + 0.25) % 1) - 0.5);
        } else if (wave === "saw") {
          s = 2 * p - 1 - polyBlep(p, dt);
        } else if (wave === "square") {
          s = (p < duty ? 1 : -1) + polyBlep(p, dt) - polyBlep((p + 1 - duty) % 1, dt);
        } else if (wave === "noise") {
          s = w;
        } else if (wave === "pink") {
          b0 = 0.99765 * b0 + w * 0.099046;
          b1 = 0.963 * b1 + w * 0.2965164;
          b2 = 0.57 * b2 + w * 1.0526913;
          s = (b0 + b1 + b2 + w * 0.1848) * 0.26;
        } else if (wave === "brown") {
          br = (br + 0.02 * w) / 1.02;
          s = br * 3.2;
        } else if (wave === "crunch") {
          if (phase + dt >= 1 || i === 0) held = w;
          s = held;
        } else if (wave === "modal") {
          for (let j = 0; j < modes.length; j++) {
            ph[j] = (ph[j] + dt * modes[j]) % 1;
            s += (Math.sin(TAU * ph[j]) * Math.exp((-t * modes[j] * 3.8) / d)) / (j + 1);
          }
        } else if (wave === "metal") {
          for (let j = 0; j < 6; j++) {
            ph[j] = (ph[j] + dt * METAL_RATIOS[j]) % 1;
            s += (ph[j] < 0.5 ? 1 : -1)
              + polyBlep(ph[j], dt * METAL_RATIOS[j])
              - polyBlep((ph[j] + 0.5) % 1, dt * METAL_RATIOS[j]);
          }
          s /= 6;
        } else {
          s = Math.sin(TAU * p);
        }
        phase = (phase + dt) % 1;

        const u = i / n;
        const kt = L.kt ? Math.pow(f / Math.max(20, f0), L.kt) : 1;
        for (let fi = 0; fi < filters.length; fi++) {
          const flt = filters[fi];
          s = flt[0](s, flt[1] * Math.pow(flt[2] / flt[1], u) * kt);
        }
        if (fmt.length) {
          let v = 0;
          for (let fi = 0; fi < fmt.length; fi++) {
            v += fmt[fi][0](s, fmt[fi][1] * kt);
          }
          s = v * 0.45;
        }

        let env = 1;
        if (t < a) {
          env = t / a;
        } else if (t < a + h) {
          env = 1;
        } else {
          const td = clamp((t - a - h) / Math.max(0.001, d), 0, 1);
          env = shape < 0
            ? (Math.exp(shape * td) - Math.exp(shape)) / (1 - Math.exp(shape))
            : Math.pow(1 - td, shape);
        }
        s *= env;
        if (drive) {
          s = Math.tanh(s * (1 + drive)) / Math.tanh(1 + drive);
        }
        out[start + i] += s * gain;
      }
    });

    // Warm small wooden room early-reflection comb
    if (recipe.verb) {
      const wetMix = recipe.verb[1] || 0.12;
      const wet = new Float32Array(out.length);
      [613, 887, 1153].forEach((tap) => {
        const delaySamples = Math.max(16, Math.round((tap * sr) / 44100));
        const buf = new Float32Array(delaySamples);
        let idx = 0;
        let damp = 0;
        for (let i = 0; i < out.length; i++) {
          const y = buf[idx];
          damp += 0.55 * (y - damp);
          buf[idx] = out[i] + damp * 0.50;
          wet[i] += y * 0.33;
          if (++idx >= delaySamples) idx = 0;
        }
      });
      for (let i = 0; i < out.length; i++) {
        out[i] = out[i] * (1 - wetMix * 0.35) + wet[i] * wetMix;
      }
    }

    // DC blocker + smooth click-free edges + -1.4 dBFS true-peak guard
    const hpDc = createSvf(sr, 0.707, 2);
    let peak = 0;
    for (let i = 0; i < out.length; i++) {
      out[i] = hpDc(out[i], 28);
      const av = Math.abs(out[i]);
      if (av > peak) peak = av;
    }
    const norm = peak > 0.84 ? 0.84 / peak : 1;
    const headFade = Math.min(Math.round(0.0015 * sr), out.length);
    const tailFade = Math.min(Math.round(0.005 * sr), out.length);
    for (let i = 0; i < out.length; i++) {
      let edge = 1;
      if (i < headFade) edge = i / Math.max(1, headFade);
      else if (i >= out.length - tailFade) edge = (out.length - 1 - i) / Math.max(1, tailFade);
      out[i] *= norm * edge;
    }
    return out;
  }

  /* ==========================================================================
     1. 蛋宝宝全场景声学配方字典 (RECIPES)
     ========================================================================== */
  const RECIPES = Object.freeze({
    // --- UI & 房间微拟音 ---
    ui_tap: {
      vary: 0.4, varyF: 1.0,
      layers: [
        { wave: "noise", bp: 3100, q: 2.6, a: 0.0015, d: 0.006, shape: -6, gain: 0.22 },
        { wave: "sine", freq: 560, to: 720, a: 0.002, d: 0.048, shape: -4, gain: 0.32 }
      ]
    },
    snack_pickup: {
      vary: 0.5,
      layers: [
        { wave: "sine", freq: 380, to: 620, a: 0.003, d: 0.065, shape: -4, gain: 0.34 },
        { wave: "pink", bp: 1800, q: 1.5, a: 0.002, d: 0.03, shape: -5, gain: 0.18 }
      ]
    },
    snack_toss: {
      vary: 0.4,
      layers: [
        { wave: "pink", bp: 650, bpTo: 1950, q: 1.4, a: 0.012, d: 0.19, shape: 2, gain: 0.32 },
        { wave: "sine", freq: 340, to: 620, a: 0.008, d: 0.15, shape: 2, gain: 0.22 }
      ]
    },
    lamp_on: {
      vary: 0.25,
      layers: [
        { wave: "modal", freq: 420, modes: WOOD_MODES, a: 0.0015, d: 0.032, shape: -5, gain: 0.38 },
        { wave: "triangle", freq: 520, to: 820, at: 0.02, a: 0.003, d: 0.075, shape: -4, gain: 0.32 }
      ]
    },
    lamp_off: {
      vary: 0.25,
      layers: [
        { wave: "modal", freq: 360, modes: WOOD_MODES, a: 0.0015, d: 0.035, shape: -5, gain: 0.38 },
        { wave: "triangle", freq: 480, to: 280, at: 0.018, a: 0.003, d: 0.075, shape: -4, gain: 0.30 }
      ]
    },
    mirror_sparkle: {
      vary: 0.2, verb: [0.22, 0.15],
      layers: [
        { wave: "modal", freq: 1318.5, modes: GLASS_MODES, a: 0.002, d: 0.16, shape: -4, gain: 0.34 },
        { wave: "modal", freq: 1760.0, modes: GLASS_MODES, at: 0.065, a: 0.002, d: 0.20, shape: -4, gain: 0.32 }
      ]
    },
    cloth_rustle: {
      vary: 0.7, varyF: 2.0,
      layers: [
        { wave: "pink", bp: 920, bpTo: 1850, q: 1.2, a: 0.01, d: 0.12, shape: 2, gain: 0.42 },
        { wave: "pink", bp: 1750, bpTo: 1050, q: 1.4, at: 0.07, a: 0.008, d: 0.10, shape: 2, gain: 0.32 }
      ]
    },
    cloth_bare: {
      vary: 0.6,
      layers: [
        { wave: "pink", bp: 1500, bpTo: 780, q: 1.2, a: 0.008, d: 0.11, shape: 2, gain: 0.36 },
        { wave: "triangle", freq: 440, to: 330, a: 0.005, d: 0.08, shape: -4, gain: 0.24 }
      ]
    },
    chest_open: {
      vary: 0.35, verb: [0.2, 0.10],
      layers: [
        { wave: "modal", freq: 245, modes: WOOD_MODES, a: 0.002, d: 0.065, shape: -5, gain: 0.45 },
        { wave: "triangle", freq: 523.25, to: 783.99, at: 0.04, a: 0.004, d: 0.11, shape: -4, gain: 0.32 }
      ]
    },
    chest_close: {
      vary: 0.35,
      layers: [
        { wave: "pink", bp: 900, q: 1.4, a: 0.004, d: 0.045, shape: -4, gain: 0.28 },
        { wave: "modal", freq: 195, modes: WOOD_MODES, at: 0.03, a: 0.002, d: 0.07, shape: -5, gain: 0.46 }
      ]
    },
    book_clasp: {
      vary: 0.35,
      layers: [
        { wave: "noise", bp: 2400, q: 2.5, a: 0.0015, d: 0.015, shape: -6, gain: 0.36 },
        { wave: "modal", freq: 310, modes: WOOD_MODES, a: 0.002, d: 0.05, shape: -5, gain: 0.38 },
        { wave: "pink", bp: 1350, bpTo: 2100, q: 1.2, at: 0.05, a: 0.01, d: 0.12, shape: 2, gain: 0.30 }
      ]
    },
    page_flip: {
      vary: 0.8, varyF: 2.0,
      layers: [
        { wave: "pink", bp: 1600, bpTo: 2900, q: 1.3, a: 0.008, d: 0.11, shape: 2, gain: 0.38 },
        { wave: "noise", hp: 3200, at: 0.05, a: 0.003, d: 0.04, shape: -5, gain: 0.16 }
      ]
    },
    pencil_write: {
      vary: 0.9, varyF: 2.0,
      layers: [0, 0.09, 0.19].map((at, i) => (
        { wave: "crunch", freq: 2900 + i * 240, bp: 2400, q: 1.8, at, a: 0.004, d: 0.055, shape: 2, gain: 0.28 }
      ))
    },
    camera_shutter: {
      vary: 0.25,
      layers: [
        { wave: "noise", bp: 2800, q: 2.2, a: 0.0015, d: 0.018, shape: -6, gain: 0.42 },
        { wave: "modal", freq: 1450, modes: BRASS_MODES, a: 0.0015, d: 0.025, shape: -6, gain: 0.32 },
        { wave: "noise", bp: 1950, q: 2.0, at: 0.055, a: 0.0015, d: 0.024, shape: -6, gain: 0.38 }
      ]
    },
    wood_slot: {
      vary: 0.6, varyF: 1.5,
      layers: [
        { wave: "modal", freq: 265, modes: WOOD_MODES, a: 0.0015, d: 0.065, shape: -5, drive: 0.6, gain: 0.52 },
        { wave: "noise", bp: 1850, q: 2.2, a: 0.0015, d: 0.012, shape: -6, gain: 0.26 }
      ]
    },
    door_slide: {
      vary: 0.35, verb: [0.22, 0.12],
      layers: [
        { wave: "pink", bp: 540, bpTo: 1180, q: 1.3, a: 0.02, d: 0.18, shape: 2, gain: 0.36 },
        { wave: "modal", freq: 220, modes: WOOD_MODES, at: 0.12, a: 0.002, d: 0.075, shape: -5, gain: 0.38 }
      ]
    },
    drawer_slide: {
      vary: 0.4,
      layers: [
        { wave: "pink", bp: 680, bpTo: 1240, q: 1.4, a: 0.01, d: 0.10, shape: 2, gain: 0.30 },
        { wave: "triangle", freq: 230, to: 330, a: 0.005, d: 0.09, shape: -4, gain: 0.28 }
      ]
    },
    card_flip: {
      vary: 0.8, varyF: 2.0,
      layers: [
        { wave: "pink", bp: 2100, bpTo: 3400, q: 1.6, a: 0.003, d: 0.055, shape: -4, gain: 0.38 },
        { wave: "modal", freq: 340, modes: WOOD_MODES, at: 0.032, a: 0.0015, d: 0.035, shape: -6, gain: 0.30 }
      ]
    },
    card_match: {
      vary: 0.2, verb: [0.2, 0.12],
      layers: [
        { wave: "sine", freq: 659.25, to: 659.25, a: 0.003, d: 0.12, shape: -4, gain: 0.36 },
        { wave: "sine", freq: 987.77, to: 987.77, at: 0.07, a: 0.003, d: 0.18, shape: -4, gain: 0.38 }
      ]
    },
    oven_hit: {
      vary: 0.3,
      layers: [
        { wave: "pink", bp: 1200, bpTo: 2200, q: 1.5, a: 0.005, d: 0.09, shape: -4, gain: 0.34 },
        { wave: "triangle", freq: 587.33, to: 880, a: 0.003, d: 0.12, shape: -4, gain: 0.36 }
      ]
    },
    oven_ding: {
      vary: 0.1, verb: [0.28, 0.18],
      layers: [
        { wave: "modal", freq: 1567.98, modes: BRASS_MODES, a: 0.0015, d: 0.38, shape: -4, gain: 0.45 },
        { wave: "sine", freq: 1567.98, a: 0.002, d: 0.42, shape: -3, gain: 0.32 }
      ]
    },
    breeze_chime: {
      vary: 0.9, verb: [0.25, 0.16],
      layers: [
        { wave: "modal", freq: 1174.66, modes: GLASS_MODES, a: 0.002, d: 0.22, shape: -4, gain: 0.36 },
        { wave: "pink", bp: 1800, q: 1.6, a: 0.005, d: 0.07, shape: 2, gain: 0.18 }
      ]
    },
    star_chime: {
      vary: 0.2, verb: [0.22, 0.14],
      layers: [
        { wave: "sine", freq: 659.25, to: 880, a: 0.003, d: 0.11, shape: -4, gain: 0.36 },
        { wave: "sine", freq: 880, to: 1174.66, at: 0.08, a: 0.003, d: 0.18, shape: -4, gain: 0.38 }
      ]
    },
    level_up: {
      vary: 0.1, verb: [0.26, 0.16],
      layers: [523.25, 659.25, 783.99, 1046.5].map((f, i) => (
        { wave: "triangle", freq: f, to: f * 1.02, at: i * 0.075, a: 0.004, d: i === 3 ? 0.28 : 0.15, shape: -3, gain: 0.38 }
      ))
    },

    // --- 床头《奶肚黑猫警长发条钟》全套机械毛毡声 ---
    clock_open: {
      vary: 0.2, verb: [0.2, 0.1],
      layers: [
        { wave: "pink", bp: 520, bpTo: 1350, q: 1.4, a: 0.01, d: 0.15, shape: 2, gain: 0.36 },
        { wave: "modal", freq: 1180, modes: BRASS_MODES, at: 0.11, a: 0.0015, d: 0.025, shape: -6, gain: 0.44 },
        { wave: "modal", freq: 920, modes: BRASS_MODES, at: 0.25, a: 0.0015, d: 0.028, shape: -6, gain: 0.40 }
      ]
    },
    clock_tick_even: {
      vary: 0.15,
      layers: [
        { wave: "modal", freq: 1220, modes: BRASS_MODES, lp: 4200, a: 0.0015, d: 0.022, shape: -6, gain: 0.34 },
        { wave: "modal", freq: 185, modes: WOOD_MODES, lp: 600, a: 0.002, d: 0.030, shape: -6, gain: 0.22 }
      ]
    },
    clock_tick_odd: {
      vary: 0.15,
      layers: [
        { wave: "modal", freq: 940, modes: BRASS_MODES, lp: 3800, a: 0.0015, d: 0.024, shape: -6, gain: 0.32 },
        { wave: "modal", freq: 165, modes: WOOD_MODES, lp: 550, a: 0.002, d: 0.032, shape: -6, gain: 0.22 }
      ]
    },
    clock_purr_breath: {
      vary: 0.25,
      layers: [
        { wave: "brown", lp: 185, a: 0.025, d: 0.22, shape: 2, gain: 0.22 }
      ]
    },
    clock_flip_back: {
      vary: 0.25,
      layers: [
        { wave: "pink", bp: 1200, bpTo: 580, q: 1.5, a: 0.008, d: 0.13, shape: 2, gain: 0.42 },
        { wave: "modal", freq: 215, modes: WOOD_MODES, at: 0.075, a: 0.002, d: 0.085, shape: -5, drive: 0.8, gain: 0.54 }
      ]
    },
    clock_flip_front: {
      vary: 0.25,
      layers: [
        { wave: "pink", bp: 580, bpTo: 1380, q: 1.5, a: 0.008, d: 0.13, shape: 2, gain: 0.40 },
        { wave: "modal", freq: 1380, modes: GLASS_MODES, at: 0.075, a: 0.002, d: 0.07, shape: -5, gain: 0.38 }
      ]
    },
    clock_ratchet_tooth: {
      vary: 0.35, varyF: 1.2,
      layers: [
        { wave: "noise", bp: 2850, q: 2.8, a: 0.0015, d: 0.018, shape: -6, drive: 1.0, gain: 0.46 },
        { wave: "modal", freq: 2480, modes: BRASS_MODES, a: 0.0015, d: 0.028, shape: -5, gain: 0.40 },
        { wave: "modal", freq: 290, modes: WOOD_MODES, a: 0.0015, d: 0.022, shape: -6, gain: 0.28 }
      ]
    },
    clock_wind_release: {
      vary: 0.2,
      layers: [
        { wave: "modal", freq: 1850, modes: BRASS_MODES, a: 0.0015, d: 0.035, shape: -5, gain: 0.36 },
        { wave: "modal", freq: 1320, modes: BRASS_MODES, at: 0.035, a: 0.0015, d: 0.055, shape: -5, gain: 0.42 }
      ]
    },
    clock_shift: {
      vary: 0.2,
      layers: [
        { wave: "modal", freq: 255, modes: WOOD_MODES, a: 0.0015, d: 0.048, shape: -5, drive: 0.7, gain: 0.46 },
        { wave: "noise", bp: 2100, q: 2.4, a: 0.0015, d: 0.012, shape: -6, gain: 0.24 }
      ]
    },
    clock_lever_on: {
      vary: 0.2,
      layers: [
        { wave: "noise", bp: 850, q: 1.6, a: 0.008, d: 0.045, shape: 2, gain: 0.30 },
        { wave: "metal", freq: 420, bp: 1550, q: 2.0, at: 0.045, a: 0.0015, d: 0.075, shape: -5, gain: 0.36 },
        { wave: "triangle", freq: 520, to: 760, at: 0.05, a: 0.002, d: 0.07, shape: -4, gain: 0.26 }
      ]
    },
    clock_lever_off: {
      vary: 0.2,
      layers: [
        { wave: "noise", bp: 800, q: 1.6, a: 0.008, d: 0.045, shape: 2, gain: 0.28 },
        { wave: "metal", freq: 340, bp: 1200, q: 2.0, at: 0.045, a: 0.0015, d: 0.075, shape: -5, gain: 0.34 },
        { wave: "sine", freq: 240, to: 135, at: 0.05, a: 0.002, d: 0.07, shape: -4, gain: 0.32 }
      ]
    },

    // --- 玉兔 vs 锦鲤：脚步、跳跃与弹跳 ---
    step_yutu: {
      vary: 0.9, varyF: 2.0,
      layers: [
        { wave: "modal", freq: 195, modes: WOOD_MODES, lp: 1050, a: 0.002, d: 0.042, shape: -6, gain: 0.50 },
        { wave: "pink", bp: 1550, q: 1.4, a: 0.002, d: 0.032, shape: -5, gain: 0.32 }
      ]
    },
    step_koi: {
      vary: 0.9, varyF: 1.5,
      layers: [
        { wave: "sine", freq: 195, to: 315, a: 0.003, d: 0.05, shape: -4, gain: 0.44 },
        { wave: "sine", freq: 640, to: 1040, at: 0.008, a: 0.002, d: 0.032, shape: -5, gain: 0.20 }
      ]
    },
    // 对齐 JUMP_KFS (1050ms，o:0.80 约 0.76s 触地缓冲)
    jump_yutu: {
      vary: 0.4, verb: [0.2, 0.1],
      layers: [
        { wave: "triangle", freq: 295, to: 590, a: 0.005, d: 0.14, shape: -3, lp: 2400, gain: 0.44 },
        { wave: "pink", bp: 850, bpTo: 2100, q: 1.3, a: 0.01, d: 0.16, shape: 2, gain: 0.36 },
        { wave: "modal", freq: 155, modes: WOOD_MODES, at: 0.74, lp: 800, a: 0.003, d: 0.085, shape: -5, gain: 0.48 },
        { wave: "pink", bp: 900, q: 1.1, at: 0.74, a: 0.003, d: 0.075, shape: -4, gain: 0.34 }
      ]
    },
    jump_koi: {
      vary: 0.4, verb: [0.2, 0.12],
      layers: [
        { wave: "sine", freq: 255, to: 685, fm: [2, 0.7, 0.09], a: 0.004, d: 0.15, shape: -3, gain: 0.46 },
        { wave: "sine", freq: 880, to: 1480, at: 0.055, a: 0.002, d: 0.055, shape: -4, gain: 0.24 },
        { wave: "sine", freq: 250, to: 165, vib: [20, 1.8], at: 0.74, a: 0.003, d: 0.15, shape: -3, gain: 0.48 },
        { wave: "sine", freq: 620, to: 980, at: 0.77, a: 0.002, d: 0.05, shape: -4, gain: 0.22 }
      ]
    },
    hop_yutu: {
      vary: 0.5,
      layers: [
        { wave: "triangle", freq: 360, to: 560, a: 0.004, d: 0.085, shape: -3, lp: 2200, gain: 0.42 },
        { wave: "pink", bp: 1400, q: 1.5, a: 0.003, d: 0.055, shape: -4, gain: 0.24 }
      ]
    },
    hop_koi: {
      vary: 0.5,
      layers: [
        { wave: "sine", freq: 310, to: 590, a: 0.003, d: 0.09, shape: -3, gain: 0.44 },
        { wave: "sine", freq: 720, to: 1180, at: 0.035, a: 0.002, d: 0.045, shape: -4, gain: 0.24 }
      ]
    },
    bounce_yutu: {
      vary: 0.4,
      layers: [
        { wave: "triangle", freq: 220, to: 375, vib: [12, 0.7], formant: YUTU_FMT, kt: 0.6, a: 0.006, d: 0.18, shape: -3, gain: 0.64 },
        { wave: "pink", lp: 780, a: 0.004, d: 0.11, shape: -4, gain: 0.34 }
      ]
    },
    bounce_koi: {
      vary: 0.4,
      layers: [
        { wave: "sine", freq: 240, to: 430, vib: [22, 2.2], a: 0.004, d: 0.22, shape: -3, gain: 0.50 },
        { wave: "sine", freq: 680, to: 1160, at: 0.06, a: 0.002, d: 0.06, shape: -4, gain: 0.25 }
      ]
    },

    // --- 玉兔 vs 锦鲤：四大情绪无词共振峰小配音 & 抚摸/拍醒 ---
    emote_laugh_yutu: {
      vary: 0.45, verb: [0.2, 0.1],
      layers: [0, 0.105, 0.21].flatMap((at, i) => [
        { wave: "triangle", freq: 500 + i * 55, to: 650 + i * 75, formant: YUTU_FMT, kt: 0.7, at, a: 0.006, h: 0.02, d: 0.075, shape: -3, gain: 0.66 },
        { wave: "pink", bp: 2200, q: 1.8, at, a: 0.004, d: 0.045, shape: -4, gain: 0.18 }
      ])
    },
    emote_laugh_koi: {
      vary: 0.45, verb: [0.22, 0.14],
      layers: [0, 0.085, 0.17, 0.255].map((at, i) => (
        { wave: "sine", freq: 330 + i * 52, to: 540 + i * 85, fm: [2, 0.55, 0.06], at, a: 0.004, d: 0.075, shape: -3, gain: 0.46 }
      ))
    },
    emote_sad_yutu: {
      vary: 0.35, verb: [0.22, 0.12],
      layers: [
        { wave: "triangle", freq: 510, to: 335, vib: [5.5, 0.35], formant: YUTU_FMT, kt: 0.8, a: 0.018, h: 0.06, d: 0.28, shape: 2, gain: 0.70 },
        { wave: "pink", bp: 1300, q: 1.5, a: 0.02, d: 0.18, shape: 2, gain: 0.16 }
      ]
    },
    emote_sad_koi: {
      vary: 0.35, verb: [0.24, 0.14],
      layers: [
        { wave: "sine", freq: 390, to: 235, vib: [5, 0.4], formant: KOI_FMT, kt: 0.8, a: 0.015, h: 0.05, d: 0.3, shape: 2, gain: 0.66 },
        { wave: "sine", freq: 440, to: 295, at: 0.24, a: 0.004, d: 0.08, shape: -3, gain: 0.24 }
      ]
    },
    emote_think_yutu: {
      vary: 0.35, verb: [0.22, 0.12],
      layers: [
        { wave: "triangle", freq: 430, to: 645, curve: 0.65, formant: YUTU_FMT, kt: 0.8, a: 0.01, h: 0.04, d: 0.15, shape: -3, gain: 0.68 },
        { wave: "modal", freq: 1568, modes: GLASS_MODES, at: 0.29, a: 0.002, d: 0.22, shape: -4, gain: 0.35 }
      ]
    },
    emote_think_koi: {
      vary: 0.35, verb: [0.24, 0.15],
      layers: [
        { wave: "sine", freq: 320, to: 590, curve: 0.65, a: 0.008, h: 0.03, d: 0.15, shape: -3, gain: 0.46 },
        { wave: "sine", freq: 1175, fm: [3.0, 1.1, 0.12], at: 0.27, a: 0.002, d: 0.26, shape: -4, gain: 0.34 }
      ]
    },
    emote_cute_yutu: {
      vary: 0.4, verb: [0.22, 0.12],
      layers: [
        { wave: "triangle", freq: 470, to: 585, formant: YUTU_FMT, kt: 0.7, a: 0.008, h: 0.03, d: 0.09, shape: -3, gain: 0.66 },
        { wave: "triangle", freq: 560, to: 760, formant: YUTU_FMT, kt: 0.7, at: 0.13, a: 0.008, h: 0.04, d: 0.14, shape: -3, gain: 0.70 },
        { wave: "sine", freq: 1120, to: 1520, at: 0.14, a: 0.004, d: 0.12, shape: -4, gain: 0.16 }
      ]
    },
    emote_cute_koi: {
      vary: 0.4, verb: [0.24, 0.15],
      layers: [
        { wave: "sine", freq: 350, to: 530, a: 0.006, h: 0.03, d: 0.1, shape: -3, gain: 0.46 },
        { wave: "sine", freq: 460, to: 700, fm: [2, 0.5, 0.08], at: 0.12, a: 0.005, h: 0.03, d: 0.14, shape: -3, gain: 0.46 },
        { wave: "sine", freq: 780, to: 1320, at: 0.22, a: 0.002, d: 0.065, shape: -4, gain: 0.28 }
      ]
    },
    sleep_pat_yutu: {
      vary: 0.4,
      layers: [
        { wave: "pink", lp: 650, a: 0.006, d: 0.11, shape: -4, gain: 0.36 },
        { wave: "triangle", freq: 390, to: 470, formant: YUTU_FMT, kt: 0.7, at: 0.04, a: 0.015, d: 0.20, shape: 2, gain: 0.56 }
      ]
    },
    sleep_pat_koi: {
      vary: 0.4,
      layers: [
        { wave: "pink", lp: 620, a: 0.006, d: 0.11, shape: -4, gain: 0.34 },
        { wave: "sine", freq: 290, to: 410, formant: KOI_FMT, kt: 0.7, at: 0.04, a: 0.015, d: 0.22, shape: 2, gain: 0.54 }
      ]
    },
    pet_stroke_yutu: {
      vary: 0.8, varyF: 2.0,
      layers: [
        { wave: "pink", bp: 920, bpTo: 1380, q: 1.3, a: 0.012, d: 0.10, shape: 2, gain: 0.26 }
      ]
    },
    pet_stroke_koi: {
      vary: 0.8,
      layers: [
        { wave: "sine", freq: 420, to: 620, a: 0.006, d: 0.07, shape: 2, gain: 0.20 }
      ]
    },

    // --- 5 类零食材质颗粒 (覆盖全部 8 款零食) ---
    bite_carrot: {
      vary: 0.9, varyF: 2.5,
      layers: [
        { wave: "noise", hp: 2100, a: 0.0015, d: 0.024, shape: -6, drive: 1.4, gain: 0.54 },
        { wave: "crunch", freq: 3200, bp: 2300, q: 1.8, a: 0.0015, d: 0.038, shape: -5, drive: 1.2, gain: 0.48 },
        { wave: "triangle", freq: 330, to: 185, a: 0.002, d: 0.042, shape: -5, gain: 0.34 }
      ]
    },
    bite_fish: {
      vary: 0.9, varyF: 2.5,
      layers: [
        { wave: "crunch", freq: 2050, bp: 1850, q: 1.5, a: 0.0015, d: 0.048, shape: -5, drive: 1.6, gain: 0.50 },
        { wave: "pink", bp: 2800, q: 1.6, at: 0.012, a: 0.0015, d: 0.034, shape: -5, gain: 0.38 }
      ]
    },
    bite_taiyaki: {
      vary: 0.85, varyF: 2.0,
      layers: [
        { wave: "crunch", freq: 1950, bp: 1750, q: 1.4, a: 0.0015, d: 0.045, shape: -5, drive: 1.4, gain: 0.46 },
        { wave: "sine", freq: 270, to: 175, lp: 640, at: 0.015, a: 0.004, d: 0.055, shape: -4, gain: 0.36 }
      ]
    },
    bite_mochi: {
      vary: 0.8,
      layers: [
        { wave: "sine", freq: 295, to: 160, lp: 680, a: 0.005, d: 0.075, shape: -3, gain: 0.50 },
        { wave: "pink", lp: 540, a: 0.005, d: 0.06, shape: -4, gain: 0.35 },
        { wave: "sine", freq: 410, to: 650, at: 0.045, a: 0.002, d: 0.028, shape: -5, gain: 0.20 }
      ]
    },
    bite_cake: {
      vary: 0.8,
      layers: [
        { wave: "pink", bp: 950, q: 1.2, a: 0.004, d: 0.065, shape: -4, gain: 0.50 },
        { wave: "triangle", freq: 265, to: 205, lp: 820, a: 0.004, d: 0.06, shape: -4, gain: 0.35 }
      ]
    },
    bite_berry: {
      vary: 0.85,
      layers: [
        { wave: "pink", bp: 1650, q: 1.8, a: 0.002, d: 0.036, shape: -5, gain: 0.38 },
        { wave: "sine", freq: 380, to: 590, a: 0.003, d: 0.052, shape: -4, gain: 0.36 }
      ]
    },
    bite_candy: {
      vary: 0.7,
      layers: [
        { wave: "modal", freq: 2180, modes: BRASS_MODES, a: 0.0015, d: 0.065, shape: -5, gain: 0.45 },
        { wave: "noise", bp: 3500, q: 2.8, a: 0.0015, d: 0.02, shape: -6, gain: 0.34 },
        { wave: "sine", freq: 1568, to: 2093, at: 0.02, a: 0.002, d: 0.085, shape: -4, gain: 0.20 }
      ]
    },
    hungry_yutu: {
      vary: 0.4,
      layers: [
        { wave: "triangle", freq: 185, to: 125, vib: [14, 1.5], lp: 520, a: 0.015, d: 0.22, shape: 2, gain: 0.50 },
        { wave: "triangle", freq: 165, to: 215, vib: [12, 1.2], lp: 560, at: 0.2, a: 0.015, d: 0.18, shape: 2, gain: 0.40 }
      ]
    },
    hungry_koi: {
      vary: 0.4,
      layers: [
        { wave: "sine", freq: 145, to: 230, vib: [16, 2.0], a: 0.012, d: 0.2, shape: 2, gain: 0.48 },
        { wave: "sine", freq: 280, to: 520, at: 0.19, a: 0.004, d: 0.08, shape: -4, gain: 0.30 },
        { wave: "sine", freq: 390, to: 680, at: 0.27, a: 0.003, d: 0.06, shape: -4, gain: 0.22 }
      ]
    },

    // --- 洗澡泡沫与冲水收尾 ---
    foam_yutu: {
      vary: 1.2,
      layers: [
        { wave: "pink", bp: 920, bpTo: 1450, q: 1.8, a: 0.003, d: 0.055, shape: -4, gain: 0.42 },
        { wave: "sine", freq: 390, to: 590, a: 0.003, d: 0.048, shape: -4, gain: 0.28 }
      ]
    },
    bubble_koi: {
      vary: 1.4,
      layers: [
        { wave: "sine", freq: 540, to: 1080, a: 0.002, d: 0.058, shape: -4, gain: 0.44 },
        { wave: "sine", freq: 920, to: 1640, at: 0.018, a: 0.002, d: 0.036, shape: -5, gain: 0.22 }
      ]
    },
    rinse_yutu: {
      vary: 0.3, verb: [0.25, 0.14],
      layers: [
        { wave: "pink", bp: 1100, bpTo: 2200, q: 1.2, a: 0.03, d: 0.26, shape: 2, gain: 0.42 },
        ...[0.24, 0.30, 0.36, 0.42, 0.48].map((at, i) => (
          { wave: "pink", bp: 720 + (i % 2) * 420, q: 1.5, at, a: 0.003, d: 0.048, shape: -4, gain: 0.45 }
        )),
        { wave: "triangle", freq: 520, to: 740, formant: YUTU_FMT, kt: 0.7, at: 0.54, a: 0.008, d: 0.16, shape: -3, gain: 0.64 }
      ]
    },
    rinse_koi: {
      vary: 0.3, verb: [0.28, 0.18],
      layers: [
        { wave: "noise", bp: 1200, bpTo: 2900, q: 1.4, a: 0.015, d: 0.28, shape: -3, gain: 0.36 },
        ...[0.18, 0.25, 0.32, 0.40].map((at, i) => (
          { wave: "sine", freq: 523.25 * Math.pow(2, [0, 4, 7, 12][i] / 12), to: 680 * Math.pow(2, [0, 4, 7, 12][i] / 12), at, a: 0.002, d: 0.09, shape: -4, gain: 0.38 }
        ))
      ]
    }
  });

  const SNACK_SOUND_PROFILES = Object.freeze({
    carrot: Object.freeze({ category: "crunchy_fresh", recipeKey: "bite_carrot" }),
    dried_fish: Object.freeze({ category: "crispy_dry", recipeKey: "bite_fish" }),
    crispy_taiyaki: Object.freeze({ category: "crispy_stuffed", recipeKey: "bite_taiyaki" }),
    berry_mochi: Object.freeze({ category: "soft_mochi", recipeKey: "bite_mochi" }),
    osmanthus_cake: Object.freeze({ category: "fluffy_pastry", recipeKey: "bite_cake" }),
    osmanthus_pancake: Object.freeze({ category: "fluffy_pastry", recipeKey: "bite_cake" }),
    cream_berry: Object.freeze({ category: "juicy_berry", recipeKey: "bite_berry" }),
    star_candy: Object.freeze({ category: "candy_crystal", recipeKey: "bite_candy" })
  });

  function resolveSnackProfile(snackId) {
    return SNACK_SOUND_PROFILES[snackId] || SNACK_SOUND_PROFILES.carrot;
  }

  /**
   * 归一化手指揉搓强度 effort ∈ [0.08, 1.0]
   */
  function computeScrubEffort(stepDist, dtMs) {
    const dt = Math.max(8, Number(dtMs) || 16);
    const speed = Math.max(0, Number(stepDist) || 0) / dt;
    return clamp(speed / 1.75, 0.08, 1);
  }

  /**
   * 双宠差异化搓澡进度增长曲线：
   * - 玉兔 (yutu)：长绒毛先吸水浸润 (0-30%: ×0.78)，起泡后绵密发泡加速 (30-100%: ×1.28)
   * - 锦鲤 (koi)：滑溜鱼身起步轻快起泡 (0-40%: ×1.18)，后段水润抛光 (40-100%: ×0.96)
   */
  function computeBathStepDelta(petId, bathProgress, stepDist, dtMs) {
    const dist = Math.max(0, Number(stepDist) || 0);
    if (dist <= 0) return 0;
    const effort = computeScrubEffort(dist, dtMs);
    const base = dist * (0.24 + effort * 0.07);
    const prog = clamp(Number(bathProgress) || 0, 0, 100);
    if (petId === "yutu") {
      return base * (prog < 30 ? 0.78 : 1.28);
    }
    return base * (prog < 40 ? 1.18 : 0.96);
  }

  function triggerHaptic(style) {
    try {
      if (
        typeof window !== "undefined" &&
        window.EggbabeNative &&
        typeof window.EggbabeNative.isNative === "function" &&
        window.EggbabeNative.isNative() &&
        typeof window.EggbabeNative.haptic === "function"
      ) {
        window.EggbabeNative.haptic(style || "light");
      }
    } catch (_) {}
  }

  /* ==========================================================================
     2. Web Audio 控制器工厂 (createController)
     ========================================================================== */
  function createController(options) {
    const opts = options || {};
    const getSfxOn = typeof opts.getSfxOn === "function" ? opts.getSfxOn : () => true;
    const getPetId = typeof opts.getPetId === "function" ? opts.getPetId : () => "koi";
    const onEvent = typeof opts.onEvent === "function" ? opts.onEvent : null;

    let ctx = null;
    let master = null;
    let scrubStream = null;
    let scrubIdleTimer = 0;
    let lastBubblePlayAt = 0;
    let lastStrokePlayAt = 0;
    const bufferBank = new Map();

    function isAllowed() {
      if (!getSfxOn()) return false;
      if (typeof document !== "undefined" && document.visibilityState && document.visibilityState !== "visible") {
        return false;
      }
      return true;
    }

    function ensureAudioContext() {
      if (ctx) {
        if (ctx.state === "suspended") ctx.resume().catch(() => {});
        return ctx;
      }
      const AC = typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext);
      if (!AC) return null;
      try {
        ctx = new AC({ latencyHint: "interactive" });
        master = ctx.createGain();
        master.gain.value = 0.76;
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -5;
        comp.knee.value = 4;
        comp.ratio.value = 12;
        comp.attack.value = 0.002;
        comp.release.value = 0.1;
        master.connect(comp);
        comp.connect(ctx.destination);
        return ctx;
      } catch (_) {
        ctx = null;
        return null;
      }
    }

    function installUnlockListeners() {
      if (typeof window === "undefined" || typeof window.addEventListener !== "function") return;
      const events = ["pointerdown", "keydown", "touchend"];
      const unlock = () => {
        if (getSfxOn()) {
          const c = ensureAudioContext();
          if (c && c.state !== "running") c.resume().catch(() => {});
          if (typeof navigator !== "undefined" && navigator.audioSession) {
            try { navigator.audioSession.type = "playback"; } catch (_) {}
          }
          scheduleCorePreload();
        }
        events.forEach((ev) => window.removeEventListener(ev, unlock, true));
      };
      events.forEach((ev) => window.addEventListener(ev, unlock, true));
    }

    function getOrBuildTakeBuffer(c, recipeKey, takeIdx) {
      let state = bufferBank.get(recipeKey);
      if (!state) {
        state = {
          buffers: [],
          lastTake: Math.floor(Math.random() * VARIANTS),
          lastStart: -9,
          voices: []
        };
        bufferBank.set(recipeKey, state);
      }
      if (!state.buffers[takeIdx]) {
        const recipe = RECIPES[recipeKey] || RECIPES.ui_tap;
        const pcm = renderSamples(recipe, { sampleRate: c.sampleRate, seed: takeIdx });
        const buf = c.createBuffer(1, pcm.length, c.sampleRate);
        buf.getChannelData(0).set(pcm);
        state.buffers[takeIdx] = buf;
      }
      return { state, buffer: state.buffers[takeIdx] };
    }

    let preloaded = false;
    function scheduleCorePreload() {
      if (preloaded || !ctx) return;
      preloaded = true;
      const coreKeys = [
        "ui_tap", "step_yutu", "step_koi", "hop_yutu", "hop_koi",
        "clock_tick_even", "clock_tick_odd", "clock_ratchet_tooth"
      ];
      const jobs = [];
      coreKeys.forEach((k) => {
        for (let v = 0; v < 2; v++) jobs.push([k, v]);
      });
      const idle = (typeof window !== "undefined" && window.requestIdleCallback)
        || ((fn) => setTimeout(fn, 24));
      const pump = () => {
        if (!ctx || jobs.length === 0) return;
        const t0 = typeof performance !== "undefined" ? performance.now() : 0;
        while (jobs.length && ((typeof performance !== "undefined" ? performance.now() : 0) - t0 < 5)) {
          const [rk, tk] = jobs.shift();
          getOrBuildTakeBuffer(ctx, rk, tk);
        }
        if (jobs.length) idle(pump);
      };
      idle(pump);
    }

    function playKey(recipeKey, playOpts) {
      const po = playOpts || {};
      if (!isAllowed()) return false;
      if (onEvent) {
        onEvent(Object.assign({ recipeKey }, po));
      }
      const c = ensureAudioContext();
      if (!c || !master) return true;

      let state = bufferBank.get(recipeKey);
      const nextTake = state ? (state.lastTake + 1 + Math.floor(Math.random() * (VARIANTS - 1))) % VARIANTS : 0;
      const built = getOrBuildTakeBuffer(c, recipeKey, nextTake);
      state = built.state;
      state.lastTake = nextTake;

      const delay = Math.max(0, po.delay || 0);
      const startAt = c.currentTime + delay;
      const cooldown = po.cooldown !== undefined ? po.cooldown : 0.026;
      if (cooldown > 0 && delay === 0 && Math.abs(startAt - state.lastStart) < cooldown) {
        return false;
      }
      if (delay === 0) state.lastStart = startAt;

      const maxVoices = po.voices || 4;
      while (state.voices.length >= maxVoices) {
        const oldest = state.voices.shift();
        if (oldest) oldest.stop(c.currentTime + 0.015);
      }

      const src = c.createBufferSource();
      const g = c.createGain();
      src.buffer = built.buffer;
      src.playbackRate.value = clamp(po.rate || 1, 0.35, 3.0);
      g.gain.setValueAtTime(clamp(po.volume !== undefined ? po.volume : 0.65, 0, 1.2), startAt);

      src.connect(g);
      g.connect(master);

      const voiceHandle = {
        stop(when) {
          try {
            g.gain.setTargetAtTime(0.0001, c.currentTime, 0.005);
            src.stop(when || c.currentTime + 0.02);
          } catch (_) {}
        }
      };
      state.voices.push(voiceHandle);
      src.onended = () => {
        const idx = state.voices.indexOf(voiceHandle);
        if (idx >= 0) state.voices.splice(idx, 1);
      };
      src.start(startAt);
      return true;
    }

    function ensureScrubStream() {
      const c = ensureAudioContext();
      if (!c || !master) return null;
      if (scrubStream) return scrubStream;
      const sr = c.sampleRate;
      const buf = c.createBuffer(1, sr * 2, sr);
      const ch = buf.getChannelData(0);
      let b0 = 0;
      let b1 = 0;
      let b2 = 0;
      for (let i = 0; i < ch.length; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99765 * b0 + w * 0.099046;
        b1 = 0.963 * b1 + w * 0.2965164;
        b2 = 0.57 * b2 + w * 1.0526913;
        ch[i] = (b0 + b1 + b2 + w * 0.1848) * 0.25;
      }
      const src = c.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const filter = c.createBiquadFilter();
      filter.type = "bandpass";
      filter.Q.value = 1.5;
      filter.frequency.value = 900;
      const g = c.createGain();
      g.gain.value = 0;
      src.connect(filter);
      filter.connect(g);
      g.connect(master);
      src.start();
      scrubStream = { filter, gain: g };
      return scrubStream;
    }

    function stopScrubStream() {
      if (scrubIdleTimer) {
        clearTimeout(scrubIdleTimer);
        scrubIdleTimer = 0;
      }
      if (scrubStream && ctx) {
        try {
          scrubStream.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.035);
        } catch (_) {}
      }
    }

    function resolvePid(petId) {
      const p = petId || getPetId();
      return p === "yutu" ? "yutu" : "koi";
    }

    installUnlockListeners();

    return {
      // --- 基础 UI 与反馈 ---
      tap: () => playKey("ui_tap", { volume: 0.52 }),
      star: () => playKey("star_chime", { volume: 0.60 }),
      levelUp: () => playKey("level_up", { volume: 0.64 }),
      drawer: () => playKey("drawer_slide", { volume: 0.52 }),
      lampClick: (on) => playKey(on ? "lamp_on" : "lamp_off", { volume: 0.56 }),

      // --- 床头《奶肚黑猫警长发条钟》 ---
      clockOpen: () => {
        triggerHaptic("light");
        return playKey("clock_open", { volume: 0.62 });
      },
      clockTick: (even, withPurr) => {
        const ok = playKey(even ? "clock_tick_even" : "clock_tick_odd", { volume: 0.46, cooldown: 0.15 });
        if (withPurr && even) {
          playKey("clock_purr_breath", { volume: 0.34, cooldown: 0.5 });
        }
        return ok;
      },
      clockFlip: (toBack) => {
        triggerHaptic("light");
        return playKey(toBack ? "clock_flip_back" : "clock_flip_front", { volume: 0.62 });
      },
      clockWindTick: (tension, speed) => {
        const t = clamp(Number(tension) || 0, 0, 1);
        const s = clamp(Number(speed) || 0.3, 0, 2.5);
        const rate = 0.92 + t * 0.22 + s * 0.08;
        triggerHaptic("light");
        return playKey("clock_ratchet_tooth", { rate, volume: 0.58, cooldown: 0.02 });
      },
      clockWindStepBurst: (tension) => {
        triggerHaptic("light");
        const baseT = clamp(Number(tension) || 0, 0, 1);
        [0, 0.052, 0.105, 0.16].forEach((d, i) => {
          playKey("clock_ratchet_tooth", {
            delay: d,
            rate: 0.94 + baseT * 0.18 + i * 0.045,
            volume: 0.56,
            cooldown: 0
          });
        });
        return true;
      },
      clockWindRelease: () => playKey("clock_wind_release", { volume: 0.48 }),
      clockShift: (shiftId) => {
        const rate = shiftId === "day" ? 1.08 : shiftId === "sunset" ? 1.0 : 0.92;
        return playKey("clock_shift", { rate, volume: 0.56 });
      },
      clockLever: (on) => playKey(on ? "clock_lever_on" : "clock_lever_off", { volume: 0.58 }),
      ratchet: () => playKey("clock_ratchet_tooth", { volume: 0.55 }),

      // --- 玉兔 vs 锦鲤：走路、跳跃与弹跳 ---
      step: (isLeftOrPet, maybeIsLeft) => {
        let pid = getPetId();
        let isLeft = true;
        if (typeof isLeftOrPet === "string") {
          pid = resolvePid(isLeftOrPet);
          isLeft = maybeIsLeft !== false;
        } else {
          pid = resolvePid(pid);
          isLeft = Boolean(isLeftOrPet);
        }
        const key = pid === "yutu" ? "step_yutu" : "step_koi";
        return playKey(key, {
          petId: pid,
          rate: isLeft ? 0.96 : 1.05,
          volume: pid === "yutu" ? 0.48 : 0.46,
          cooldown: 0.045
        });
      },
      jump: (petId) => {
        const pid = resolvePid(petId);
        triggerHaptic("light");
        return playKey(pid === "yutu" ? "jump_yutu" : "jump_koi", { petId: pid, volume: 0.64 });
      },
      hop: (petId) => {
        const pid = resolvePid(petId);
        return playKey(pid === "yutu" ? "hop_yutu" : "hop_koi", { petId: pid, volume: 0.56 });
      },
      minihop: (petId) => {
        const pid = resolvePid(petId);
        return playKey(pid === "yutu" ? "hop_yutu" : "hop_koi", { petId: pid, volume: 0.56 });
      },
      bounce: (petId, intensity) => {
        const pid = resolvePid(petId);
        const k = clamp(Number(intensity) || 1, 0.5, 1.3);
        return playKey(pid === "yutu" ? "bounce_yutu" : "bounce_koi", {
          petId: pid,
          rate: 0.95 + k * 0.06,
          volume: 0.58 * k
        });
      },

      // --- 喂食与 8 款零食差异化双宠咀嚼 ---
      snackPickup: () => playKey("snack_pickup", { volume: 0.48 }),
      snackToss: () => playKey("snack_toss", { volume: 0.50 }),
      munch: (snackId, petId) => {
        const pid = resolvePid(petId);
        const profile = resolveSnackProfile(snackId);
        triggerHaptic("light");
        if (pid === "yutu") {
          [0, 0.092, 0.184, 0.276].forEach((d, i) => {
            playKey(profile.recipeKey, {
              petId: pid,
              snackId: snackId || "carrot",
              category: profile.category,
              delay: d,
              rate: 1.04 + (i % 2) * 0.07,
              volume: 0.62,
              cooldown: 0
            });
          });
          return playKey("emote_cute_yutu", {
            petId: pid,
            delay: 0.41,
            rate: 1.08,
            volume: 0.42,
            cooldown: 0
          });
        }
        [0, 0.15, 0.30].forEach((d, i) => {
          playKey(profile.recipeKey, {
            petId: pid,
            snackId: snackId || "dried_fish",
            category: profile.category,
            delay: d,
            rate: 0.88 + i * 0.05,
            volume: 0.64,
            cooldown: 0
          });
        });
        return playKey("hop_koi", {
          petId: pid,
          delay: 0.46,
          rate: 1.18,
          volume: 0.50,
          cooldown: 0
        });
      },
      hungryRumble: (petId) => {
        const pid = resolvePid(petId);
        return playKey(pid === "yutu" ? "hungry_yutu" : "hungry_koi", { petId: pid, volume: 0.56 });
      },

      // --- 洗澡手速实时映射与双宠区分 ---
      bathScrub: (petId, effort, progress) => {
        const pid = resolvePid(petId);
        const eff = clamp(Number(effort) || 0.35, 0.08, 1);
        const prog = clamp(Number(progress) || 0, 0, 100);
        if (!isAllowed()) return false;

        if (onEvent) {
          onEvent({ recipeKey: pid === "yutu" ? "foam_yutu" : "bubble_koi", petId: pid, effort: eff, progress: prog });
        }

        const st = ensureScrubStream();
        if (st && ctx) {
          const isYutu = pid === "yutu";
          st.filter.Q.value = isYutu ? 1.25 : 3.1;
          st.filter.frequency.setTargetAtTime(
            isYutu ? 650 + eff * 1150 : 1250 + eff * 1900,
            ctx.currentTime,
            0.02
          );
          st.gain.gain.setTargetAtTime(eff * (isYutu ? 0.22 : 0.13), ctx.currentTime, 0.02);
          if (scrubIdleTimer) clearTimeout(scrubIdleTimer);
          scrubIdleTimer = setTimeout(stopScrubStream, 110);
        }

        const nowMs = Date.now();
        const minGap = 150 - eff * 98;
        if (nowMs - lastBubblePlayAt >= minGap) {
          lastBubblePlayAt = nowMs;
          const rate = 0.88 + (prog / 100) * 0.34 + eff * 0.16;
          playKey(pid === "yutu" ? "foam_yutu" : "bubble_koi", {
            petId: pid,
            rate,
            volume: 0.36 + eff * 0.26,
            cooldown: 0.03
          });
        }
        return true;
      },
      bathScrubStop: stopScrubStream,
      bubble: (progress, petId) => {
        const pid = resolvePid(petId);
        const prog = clamp(Number(progress) || 0, 0, 100);
        return playKey(pid === "yutu" ? "foam_yutu" : "bubble_koi", {
          petId: pid,
          rate: 0.92 + (prog / 100) * 0.32,
          volume: 0.48
        });
      },
      splash: (petId) => {
        stopScrubStream();
        const pid = resolvePid(petId);
        triggerHaptic("medium");
        return playKey(pid === "yutu" ? "rinse_yutu" : "rinse_koi", { petId: pid, volume: 0.68 });
      },
      bathRinse: (petId) => {
        stopScrubStream();
        const pid = resolvePid(petId);
        triggerHaptic("medium");
        return playKey(pid === "yutu" ? "rinse_yutu" : "rinse_koi", { petId: pid, volume: 0.68 });
      },

      // --- 角色情绪、摸头、拍醒与登场 ---
      emoteVoice: (petId, emoKind) => {
        const pid = resolvePid(petId);
        const kind = ["laugh", "sad", "think", "cute"].indexOf(emoKind) >= 0 ? emoKind : "cute";
        return playKey(`emote_${kind}_${pid}`, { petId: pid, emoKind: kind, volume: 0.64 });
      },
      petStroke: (petId) => {
        const nowMs = Date.now();
        if (nowMs - lastStrokePlayAt < 210) return false;
        lastStrokePlayAt = nowMs;
        const pid = resolvePid(petId);
        return playKey(pid === "yutu" ? "pet_stroke_yutu" : "pet_stroke_koi", { petId: pid, volume: 0.38 });
      },
      sleepPat: (petId) => {
        const pid = resolvePid(petId);
        triggerHaptic("light");
        return playKey(pid === "yutu" ? "sleep_pat_yutu" : "sleep_pat_koi", { petId: pid, volume: 0.60 });
      },
      petGreet: (petId) => {
        const pid = resolvePid(petId);
        return playKey(pid === "yutu" ? "emote_cute_yutu" : "emote_cute_koi", {
          petId: pid,
          rate: 1.06,
          volume: 0.52
        });
      },

      // --- 起居室、衣橱、百宝箱、手帐、多宝格与小游艺微拟音 ---
      mirrorSparkle: () => playKey("mirror_sparkle", { volume: 0.56 }),
      clothRustle: (isBare) => playKey(isBare ? "cloth_bare" : "cloth_rustle", { volume: 0.54 }),
      chestToggle: (open) => playKey(open ? "chest_open" : "chest_close", { volume: 0.58 }),
      bookClasp: () => playKey("book_clasp", { volume: 0.58 }),
      pageFlip: () => playKey("page_flip", { volume: 0.52 }),
      pencilWrite: () => playKey("pencil_write", { volume: 0.54 }),
      cameraShutter: () => {
        triggerHaptic("light");
        return playKey("camera_shutter", { volume: 0.58 });
      },
      woodSlot: () => playKey("wood_slot", { volume: 0.58 }),
      doorSlide: () => playKey("door_slide", { volume: 0.56 }),
      cardFlip: () => playKey("card_flip", { volume: 0.54 }),
      cardMatch: () => playKey("card_match", { volume: 0.58 }),
      ovenHit: () => playKey("oven_hit", { volume: 0.58 }),
      ovenDing: () => playKey("oven_ding", { volume: 0.64 }),
      breezeChime: () => playKey("breeze_chime", { volume: 0.54 })
    };
  }

  return {
    VARIANTS,
    RECIPES,
    SNACK_SOUND_PROFILES,
    resolveSnackProfile,
    computeScrubEffort,
    computeBathStepDelta,
    renderSamples,
    createController
  };
});
