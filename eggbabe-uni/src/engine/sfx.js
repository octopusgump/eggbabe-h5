/**
 * 程序化治愈小音效 + 跨端触感震动封装
 * - H5 端：基于 Web Audio API 实时合成（零外部音频文件体积）
 * - 小程序端：自动安全降级，配合 uni.vibrateShort 提供细腻触感反馈
 */

const MUTE_KEY = "eggbabe_sfx_muted_v1";

let audioCtx = null;
let muted = false;

try {
  if (typeof uni !== "undefined" && typeof uni.getStorageSync === "function") {
    muted = Boolean(uni.getStorageSync(MUTE_KEY));
  } else if (typeof localStorage !== "undefined") {
    muted = localStorage.getItem(MUTE_KEY) === "1";
  }
} catch (e) {
  muted = false;
}

export function isMuted() {
  return muted;
}

export function setMuted(val) {
  muted = Boolean(val);
  try {
    if (typeof uni !== "undefined" && typeof uni.setStorageSync === "function") {
      uni.setStorageSync(MUTE_KEY, muted);
    } else if (typeof localStorage !== "undefined") {
      localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
    }
  } catch (e) {
    // ignore
  }
  return muted;
}

function getCtx() {
  if (muted) return null;
  // #ifdef H5
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    if (!audioCtx) audioCtx = new Ctx();
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  } catch (e) {
    return null;
  }
  // #endif
  // #ifndef H5
  return null;
  // #endif
}

function playTone(freqStart, freqEnd, duration, type = "sine", gainPeak = 0.14, delay = 0) {
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freqStart, now);
  if (freqEnd !== freqStart) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), now + duration);
  }
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(gainPeak, now + Math.min(0.018, duration * 0.25));
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

/** 轻柔触感反馈（小程序 + H5 双端兼容） */
export function haptic(type = "light") {
  try {
    // #ifndef H5
    if (typeof uni !== "undefined" && typeof uni.vibrateShort === "function") {
      uni.vibrateShort({ type });
    }
    // #endif
    // #ifdef H5
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      const ms = type === "heavy" ? 28 : type === "medium" ? 18 : 10;
      navigator.vibrate(ms);
    }
    // #endif
  } catch (e) {
    // ignore unsupported device
  }
}

/** Q 弹两连咀嚼吧唧声 */
export function playMunch() {
  playTone(320, 540, 0.09, "triangle", 0.15, 0);
  playTone(540, 260, 0.08, "sine", 0.12, 0.08);
  playTone(340, 580, 0.09, "triangle", 0.15, 0.24);
  playTone(580, 290, 0.09, "sine", 0.12, 0.32);
}

/** 清脆泡泡啵啵音（可随搓澡进度略微升调） */
export function playBubble(progress = 0) {
  const base = 460 + Math.min(100, progress) * 3.8 + Math.random() * 70;
  playTone(base, base * 1.65, 0.09, "sine", 0.11, 0);
}

/** 轻柔冲水哗啦声 */
export function playSplash() {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const dur = 0.55;
    const sampleRate = ctx.sampleRate;
    const buf = ctx.createBuffer(1, Math.floor(sampleRate * dur), sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.5;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(900, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(2200, ctx.currentTime + dur * 0.5);
    filter.frequency.exponentialRampToValueAtTime(750, ctx.currentTime + dur);
    filter.Q.value = 1.6;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.14, ctx.currentTime + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start();
  } catch (e) {
    // ignore
  }
}

/** 开心叮咚双音 */
export function playHappy() {
  playTone(587.33, 587.33, 0.14, "sine", 0.12, 0);
  playTone(880.0, 880.0, 0.22, "sine", 0.13, 0.09);
}

/** 升级温暖三和弦 */
export function playLevelUp() {
  playTone(523.25, 523.25, 0.16, "triangle", 0.13, 0);
  playTone(659.25, 659.25, 0.16, "triangle", 0.13, 0.10);
  playTone(783.99, 783.99, 0.18, "triangle", 0.14, 0.20);
  playTone(1046.5, 1046.5, 0.34, "sine", 0.15, 0.30);
}

/** 轻柔按键啵音 */
export function playPop() {
  playTone(420, 620, 0.06, "sine", 0.08, 0);
}
