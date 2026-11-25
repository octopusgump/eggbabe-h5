/* ==========================================================================
   EggBabe 全息拆袋实时程序化音效合成器（零外部音频文件）
   - 基于 MIT 协议 Web Audio 实时合成：铝箔揉捏、随手速变调撕裂、摇袋风铃与翻牌和弦
   - 自动同步 EggBabeStore.settings.sfxOn，并兼容 iOS / WKWebView 首次手势解锁
   ========================================================================== */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.EggBabeHoloSound = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : this), function () {
  "use strict";

  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  function pentatonicFreq(step) {
    const scale = [0, 2, 4, 7, 9];
    const octave = Math.floor(step / 5);
    const midi = 72 + octave * 12 + scale[((step % 5) + 5) % 5];
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  function createSoundController(opts) {
    const options = opts || {};
    let ctx = null;
    let api = null;
    let muted = !!options.initialMuted;

    function initAudio() {
      if (api) {
        if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
        return;
      }
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      try {
        ctx = new AudioCtx({ latencyHint: "interactive" });
        const sr = ctx.sampleRate;
        const now = () => ctx.currentTime;

        const master = ctx.createGain();
        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.value = -10;
        compressor.knee.value = 6;
        compressor.ratio.value = 8;
        compressor.attack.value = 0.002;
        compressor.release.value = 0.1;

        const reverb = ctx.createConvolver();
        const wet = ctx.createGain();
        wet.gain.value = 0.28;
        master.gain.value = muted ? 0 : 0.72;

        master.connect(compressor).connect(ctx.destination);
        reverb.connect(wet).connect(master);

        const buildBuffer = (channels, seconds, filler) => {
          const buf = ctx.createBuffer(channels, Math.floor(seconds * sr), sr);
          for (let ch = 0; ch < channels; ch++) filler(buf.getChannelData(ch));
          return buf;
        };

        const whiteNoise = buildBuffer(1, 2.0, (data) => {
          for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        });

        const foilCrackle = buildBuffer(1, 2.0, (data) => {
          for (let n = 0; n < 820; n++) {
            const offset = Math.floor(Math.random() * (data.length - 380));
            const amp = Math.pow(Math.random(), 2.9) * (Math.random() < 0.5 ? -1 : 1);
            const span = 28 + Math.floor(Math.random() * 220);
            for (let i = 0; i < span; i++) {
              data[offset + i] += amp * (Math.random() * 2 - 1) * Math.exp((-i / span) * 4.8);
            }
          }
        });

        reverb.buffer = buildBuffer(2, 0.8, (data) => {
          let lp = 0;
          for (let i = 0; i < data.length; i++) {
            const u = i / data.length;
            lp += (Math.random() * 2 - 1 - lp) * (0.48 - 0.4 * u);
            data[i] = lp * Math.pow(1 - u, 3);
          }
        });

        const route = (node, sendLevel) => {
          node.connect(master);
          if (sendLevel > 0) {
            const send = ctx.createGain();
            send.gain.value = sendLevel;
            node.connect(send).connect(reverb);
          }
        };

        const envelope = (param, start, peak, attack, duration) => {
          param.setValueAtTime(0.0001, start);
          param.exponentialRampToValueAtTime(Math.max(0.0002, peak), start + attack);
          param.exponentialRampToValueAtTime(0.0001, start + duration);
        };

        const createPanner = (val) => {
          if (typeof ctx.createStereoPanner === "function") {
            const p = ctx.createStereoPanner();
            p.pan.value = clamp(val || 0, -1, 1);
            return p;
          }
          return ctx.createGain();
        };

        const playFilteredNoise = (cfg) => {
          const at = cfg.at !== undefined ? cfg.at : now();
          const dur = cfg.dur || 0.15;
          const src = ctx.createBufferSource();
          const filter = ctx.createBiquadFilter();
          const g = ctx.createGain();
          const panner = createPanner(cfg.panStart || 0);

          src.buffer = cfg.buffer || whiteNoise;
          src.loop = true;
          filter.type = cfg.filterType || "bandpass";
          filter.Q.value = cfg.q !== undefined ? cfg.q : 0.9;
          filter.frequency.setValueAtTime(cfg.freqStart || 1200, at);
          filter.frequency.exponentialRampToValueAtTime(Math.max(40, cfg.freqEnd || 2400), at + dur);

          if (cfg.smoothBell) {
            const curve = Float32Array.from({ length: 40 }, (_, i) => (cfg.gain || 0.1) * Math.pow(Math.sin((Math.PI * i) / 39), 2));
            g.gain.setValueCurveAtTime(curve, at, dur);
          } else {
            envelope(g.gain, at, cfg.gain || 0.1, cfg.attack || 0.004, dur);
          }

          if (panner.pan) {
            panner.pan.setValueAtTime(clamp(cfg.panStart || 0, -1, 1), at);
            panner.pan.linearRampToValueAtTime(clamp(cfg.panEnd || 0, -1, 1), at + dur);
          }

          src.connect(filter).connect(g).connect(panner);
          route(panner, cfg.send || 0);
          src.start(at, Math.random() * 1.5);
          src.stop(at + dur + 0.02);
        };

        const playToneContour = (baseFreq, points, cfg) => {
          const o = cfg || {};
          const at = o.at !== undefined ? o.at : now();
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          const panner = createPanner(o.pan || 0);
          const dur = points[points.length - 1][0] + 0.05;

          osc.type = o.wave || "triangle";
          for (let i = 0; i < points.length; i++) {
            const sec = points[i][0];
            const mult = points[i][1];
            if (sec === 0) osc.frequency.setValueAtTime(baseFreq * mult, at);
            else osc.frequency.exponentialRampToValueAtTime(baseFreq * mult, at + sec);
          }
          envelope(g.gain, at, o.gain || 0.06, o.attack || 0.008, dur);

          osc.connect(g).connect(panner);
          route(panner, o.send !== undefined ? o.send : 0.25);
          osc.start(at);
          osc.stop(at + dur + 0.02);
        };

        const playBell = (freq, cfg) => {
          const o = cfg || {};
          const at = o.at !== undefined ? o.at : now();
          const dur = o.dur || 0.45;
          const g = ctx.createGain();
          const panner = createPanner(o.pan || 0);
          g.gain.value = o.gain || 0.085;
          g.connect(panner);
          route(panner, o.send !== undefined ? o.send : 0.55);

          const partials = [[1, 1, 1], [3.95, 0.16, 0.22], [9.1, 0.04, 0.08]];
          for (let i = 0; i < partials.length; i++) {
            const osc = ctx.createOscillator();
            const og = ctx.createGain();
            const life = Math.max(0.03, dur * partials[i][2]);
            osc.frequency.value = freq * partials[i][0];
            envelope(og.gain, at, partials[i][1], 0.002, life);
            osc.connect(og).connect(g);
            osc.start(at);
            osc.stop(at + life + 0.02);
          }
        };

        const ripSource = ctx.createBufferSource();
        const ripBand = ctx.createBiquadFilter();
        const ripLowpass = ctx.createBiquadFilter();
        const ripGain = ctx.createGain();

        ripSource.buffer = foilCrackle;
        ripSource.loop = true;
        ripBand.type = "bandpass";
        ripBand.Q.value = 0.65;
        ripLowpass.type = "lowpass";
        ripLowpass.frequency.value = 6000;
        ripGain.gain.value = 0;

        ripSource.connect(ripBand).connect(ripLowpass).connect(ripGain);
        route(ripGain, 0.12);
        ripSource.start();

        let currentRip = 0;

        api = {
          setMuted(flag) {
            master.gain.setTargetAtTime(flag ? 0 : 0.72, now(), 0.015);
          },
          setRip(intensity) {
            const v = clamp(intensity, 0, 1);
            if (Math.abs(v - currentRip) < 0.01 && (v > 0 || currentRip === 0)) return;
            const t = now();
            const rising = v > currentRip;
            currentRip = v;
            ripGain.gain.setTargetAtTime(Math.pow(v, 0.8) * 0.15, t, rising ? 0.008 : 0.048);
            ripBand.frequency.setTargetAtTime(1750 + 2100 * v, t, 0.02);
            ripSource.playbackRate.setTargetAtTime(0.72 + 0.82 * v, t, 0.02);
          },
          grab() {
            playFilteredNoise({ buffer: foilCrackle, freqStart: 3000, freqEnd: 2050, q: 0.7, gain: 0.25, attack: 0.003, dur: 0.085 });
          },
          shake(maxRank) {
            const rank = maxRank || 2;
            const t = now();
            playFilteredNoise({ at: t, buffer: foilCrackle, freqStart: 2300, freqEnd: 3500, q: 0.8, gain: 0.2, attack: 0.005, dur: 0.11, panStart: -0.3, panEnd: 0.3 });
            playFilteredNoise({ at: t + 0.08, buffer: foilCrackle, freqStart: 3100, freqEnd: 1950, q: 0.8, gain: 0.16, attack: 0.005, dur: 0.1, panStart: 0.3, panEnd: -0.2 });
            if (rank >= 4) {
              playBell(pentatonicFreq(rank === 5 ? 11 : 8), { at: t + 0.06, gain: 0.042, dur: 0.44, send: 0.75 });
            }
          },
          relief() {
            const t = now();
            playToneContour(840, [[0, 1.08], [0.22, 0.66]], { at: t, gain: 0.045, send: 0.38 });
          },
          boing() {
            playToneContour(340, [[0, 0.85], [0.06, 1.48], [0.14, 0.9], [0.24, 1.12]], { gain: 0.09, send: 0.18 });
          },
          burst(hasSecret) {
            const t = now();
            playFilteredNoise({ at: t, freqStart: 4600, freqEnd: 1700, q: 0.9, gain: 0.14, attack: 0.002, dur: 0.1 });
            playToneContour(310, [[0, 0.8], [0.05, 3.1]], { at: t, gain: 0.22, send: 0.16 });
            playFilteredNoise({ at: t + 0.01, freqStart: 520, freqEnd: 3200, q: 0.8, gain: 0.08, attack: 0.18, dur: 0.62, send: 0.55 });
            const count = hasSecret ? 7 : 4;
            for (let i = 0; i < count; i++) {
              playBell(pentatonicFreq((hasSecret ? 8 : 6) + i), {
                at: t + 0.07 + i * 0.055,
                gain: 0.032,
                dur: 0.42,
                send: 0.8,
                pan: (i / Math.max(1, count - 1) - 0.5) * 1.1
              });
            }
          },
          swirl(duration) {
            playFilteredNoise({ freqStart: 700, freqEnd: 1800, q: 0.9, gain: 0.09, attack: duration * 0.36, dur: duration, send: 0.38, panStart: -0.55, panEnd: 0.55 });
          },
          cardLand(slotIndex) {
            const pan = (slotIndex - 1) * 0.25;
            playFilteredNoise({ freqStart: 2400, freqEnd: 1200, q: 0.6, gain: 0.06, attack: 0.002, dur: 0.05, panStart: pan, panEnd: pan });
          },
          cardTease(rarity, slotIndex) {
            const pan = (slotIndex - 1) * 0.25;
            const stepMap = { holo: 7, ultra: 9, secret: 11 };
            playBell(pentatonicFreq(stepMap[rarity] || 5), { gain: 0.022, dur: 0.28, send: 0.72, pan });
          },
          cardFlip(rarity, slotIndex) {
            const t = now();
            const pan = (slotIndex - 1) * 0.25;
            playFilteredNoise({ at: t, freqStart: 900, freqEnd: 2800, q: 0.75, gain: 0.1, attack: 0.008, dur: 0.14, panStart: pan, panEnd: pan });
            if (rarity === "common") {
              playToneContour(520, [[0, 0.92], [0.05, 1.08]], { at: t + 0.03, gain: 0.032, pan, wave: "sine" });
            } else if (rarity === "holo") {
              [5, 7, 9].forEach((st, idx) => {
                playBell(pentatonicFreq(st), { at: t + 0.03 + idx * 0.055, gain: 0.052, dur: 0.48, send: 0.72, pan });
              });
            } else if (rarity === "ultra") {
              playToneContour(220, [[0, 1], [0.2, 2]], { at: t, gain: 0.075, send: 0.45, pan, wave: "triangle" });
              [5, 7, 9, 12].forEach((st, idx) => {
                playBell(pentatonicFreq(st), { at: t + 0.02 + idx * 0.055, gain: 0.065, dur: 0.66, send: 0.82, pan });
              });
            } else {
              playToneContour(196, [[0, 1], [0.28, 2.3]], { at: t, gain: 0.09, send: 0.55, pan });
              [5, 7, 9, 11, 12, 14].forEach((st, idx) => {
                playBell(pentatonicFreq(st), { at: t + 0.02 + idx * 0.05, gain: 0.07, dur: 0.82, send: 0.9, pan: clamp(pan + (idx - 2.5) * 0.12, -1, 1) });
              });
            }
          },
          cardHover(slotIndex) {
            const pan = (slotIndex - 1) * 0.25;
            playFilteredNoise({ filterType: "lowpass", freqStart: 760, freqEnd: 480, q: 0.32, gain: 0.036, smoothBell: true, dur: 0.18, panStart: pan, panEnd: pan });
          },
          packArrive() {
            const t = now();
            playFilteredNoise({ at: t, freqStart: 900, freqEnd: 2450, gain: 0.055, attack: 0.26, dur: 0.68, send: 0.38, panStart: 0.6, panEnd: 0 });
            playFilteredNoise({ at: t + 0.64, buffer: foilCrackle, freqStart: 2900, freqEnd: 2100, q: 0.7, gain: 0.13, attack: 0.003, dur: 0.085 });
            playToneContour(pentatonicFreq(3), [[0, 0.92], [0.05, 1.03]], { at: t + 0.7, gain: 0.045 });
            playToneContour(pentatonicFreq(5), [[0, 0.92], [0.06, 1.03]], { at: t + 0.79, gain: 0.045 });
          },
          click() {
            playToneContour(880, [[0, 0.9], [0.045, 1.14]], { gain: 0.038, send: 0 });
          }
        };
      } catch (_) {
        api = null;
      }
    }

    if (typeof window !== "undefined") {
      ["pointerdown", "pointerup", "touchend", "click", "keydown"].forEach((evt) => {
        window.addEventListener(evt, initAudio, { capture: true, passive: true });
      });
    }
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", () => {
        if (document.hidden && api) api.setRip(0);
      });
    }

    return {
      get isMuted() {
        return muted;
      },
      setMuted(flag) {
        muted = !!flag;
        if (api) api.setMuted(muted);
        return muted;
      },
      toggleMute() {
        initAudio();
        muted = !muted;
        if (api) api.setMuted(muted);
        if (!muted && api) api.click();
        return muted;
      },
      call(method) {
        try {
          if (!api || typeof api[method] !== "function") return;
          const args = Array.prototype.slice.call(arguments, 1);
          api[method].apply(api, args);
        } catch (_) {}
      }
    };
  }

  return { createSoundController };
});
