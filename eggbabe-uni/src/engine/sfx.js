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
    if (
      typeof window !== "undefined" &&
      window.EggbabeNative &&
      typeof window.EggbabeNative.isNative === "function" &&
      window.EggbabeNative.isNative() &&
      typeof window.EggbabeNative.haptic === "function"
    ) {
      window.EggbabeNative.haptic(type);
      return;
    }
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      const ms = type === "heavy" ? 28 : type === "medium" ? 18 : 10;
      navigator.vibrate(ms);
    }
    // #endif
  } catch (e) {
    // ignore unsupported device
  }
}

/** 区分玉兔（小门牙快啃+鼻音）与锦鲤（圆嘴慢嚼+气泡）的咀嚼声 */
export function playMunch(snackId = "carrot", petId = "koi") {
  const isYutu = petId === "yutu";
  const isSoft = snackId === "berry_mochi" || snackId === "osmanthus_cake" || snackId === "osmanthus_pancake";
  const isCandy = snackId === "star_candy";
  const wave = isSoft ? "sine" : isCandy ? "sine" : "triangle";
  const baseF = isCandy ? 980 : isSoft ? 260 : 340;
  if (isYutu) {
    [0, 0.09, 0.18, 0.27].forEach((d, i) => {
      playTone(baseF + (i % 2) * 45, isSoft ? 175 : baseF * 1.45, 0.065, wave, 0.13, d);
    });
    playTone(480, 690, 0.12, "triangle", 0.11, 0.40);
  } else {
    [0, 0.15, 0.30].forEach((d, i) => {
      playTone(baseF + i * 25, isSoft ? 160 : baseF * 1.55, 0.085, wave, 0.14, d);
    });
    playTone(360, 680, 0.11, "sine", 0.12, 0.45);
  }
}

/** 随手速与搓澡进度升调的双宠泡泡/柔泡音 */
export function playBubble(progress = 0, petId = "koi", effort = 0.4) {
  const isYutu = petId === "yutu";
  const eff = Math.max(0.08, Math.min(1, Number(effort) || 0.4));
  const base = (isYutu ? 380 : 480) + Math.min(100, progress) * 3.6 + eff * 120 + Math.random() * 55;
  playTone(base, base * (isYutu ? 1.42 : 1.72), isYutu ? 0.075 : 0.085, isYutu ? "triangle" : "sine", 0.09 + eff * 0.04, 0);
}

/** 双宠区分版冲水收尾（玉兔温水抖毛 vs 锦鲤清亮跃浪） */
export function playSplash(petId = "koi") {
  const ctx = getCtx();
  if (!ctx) return;
  const isYutu = petId === "yutu";
  try {
    const dur = isYutu ? 0.48 : 0.55;
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
    filter.frequency.setValueAtTime(isYutu ? 750 : 980, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(isYutu ? 1650 : 2450, ctx.currentTime + dur * 0.5);
    filter.frequency.exponentialRampToValueAtTime(isYutu ? 680 : 820, ctx.currentTime + dur);
    filter.Q.value = isYutu ? 1.3 : 1.7;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.13, ctx.currentTime + 0.07);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start();
    if (isYutu) {
      playTone(520, 740, 0.14, "triangle", 0.11, 0.36);
    } else {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => playTone(f, f * 1.18, 0.09, "sine", 0.10, 0.18 + i * 0.07));
    }
  } catch (e) {
    // ignore
  }
}

/** 双宠区分版脚步与跳跃 */
export function playStep(petId = "koi", isLeft = true) {
  if (petId === "yutu") {
    playTone(isLeft ? 215 : 242, isLeft ? 132 : 148, 0.04, "triangle", 0.09, 0);
  } else {
    playTone(isLeft ? 195 : 215, isLeft ? 305 : 330, 0.048, "sine", 0.09, 0);
  }
}

export function playJump(petId = "koi") {
  if (petId === "yutu") {
    playTone(295, 590, 0.14, "triangle", 0.12, 0);
    playTone(175, 115, 0.08, "triangle", 0.10, 0.72);
  } else {
    playTone(255, 685, 0.15, "sine", 0.12, 0);
    playTone(250, 165, 0.13, "sine", 0.11, 0.72);
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
