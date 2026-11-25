import { ZZFX, zzfx } from 'zzfx'

const SOUND_KEY = 'meadow-sound'

/** Pentatonic major scale (Hz) for exhilarating Mario-style combo pen chimes */
const COMBO_NOTES = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51]

/** Soft playful "baa" variants */
const BAA = [
  [.38, , 360, .01, .05, .15, 1, 1.4, -.15, , -110, .08, , .04, .35],
  [.34, , 315, .02, .06, .18, 1, 1.5, -.1, , -80, .1, , .05, .28],
  [.42, , 420, .01, .04, .14, 1, 1.3, -.2, , -140, .07, , .03, .4],
]
const BAA_SCARE = [.52, , 510, .005, .03, .13, 1, 1.3, -.38, , -165, .05, , .06, .45]

let enabled = readEnabled()
let lastBaa = 0
let lastBump = 0
let lastSlide = 0
let lastStep = 0

// Continuous Web Audio node graph for Mario-style high-friction ice braking sound
let skidGain: GainNode | null = null
let skidBand: BiquadFilterNode | null = null
let skidHigh: BiquadFilterNode | null = null
let skidStarted = false

// Cheerful light marimba rhythm state (gentle background pulse)
const BGM_MELODY = [523.25, 659.25, 783.99, 659.25, 587.33, 659.25, 880.0, 783.99]
let bgmTimer = 0
let bgmStep = 0

function readEnabled() {
  try {
    return localStorage.getItem(SOUND_KEY) !== '0'
  } catch {
    return true
  }
}

export function soundEnabled() {
  return enabled
}

export function setSoundEnabled(on: boolean) {
  enabled = on
  try {
    localStorage.setItem(SOUND_KEY, on ? '1' : '0')
  } catch {
    /* Private mode may block storage */
  }
  if (on) {
    unlockSound()
  } else {
    updateSkidSound(0)
  }
}

export function unlockSound() {
  try {
    const ctx = ZZFX.audioContext
    if (ctx.state === 'suspended') void ctx.resume()
  } catch {
    /* ignore */
  }
}

function play(notes: readonly (number | undefined)[]) {
  if (!enabled) return
  unlockSound()
  zzfx(...(notes as [number, ...number[]]))
}

function ensureSkidNodes() {
  if (skidStarted) return
  try {
    const ctx = ZZFX.audioContext
    const len = Math.floor(ctx.sampleRate * 1.2)
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate)
    const ch = buffer.getChannelData(0)
    // Textured frost noise (slight grit so it sounds like real ice blades scraping)
    let prev = 0
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1
      prev = prev * 0.35 + white * 0.65
      ch[i] = prev
    }
    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.loop = true

    const band = ctx.createBiquadFilter()
    band.type = 'bandpass'
    band.frequency.value = 1650
    band.Q.value = 2.4

    const high = ctx.createBiquadFilter()
    high.type = 'highshelf'
    high.frequency.value = 3400
    high.gain.value = 4

    const gain = ctx.createGain()
    gain.gain.value = 0.0001

    src.connect(band)
    band.connect(high)
    high.connect(gain)
    gain.connect(ctx.destination)
    src.start()

    skidBand = band
    skidHigh = high
    skidGain = gain
    skidStarted = true
  } catch {
    /* Web Audio unavailable */
  }
}

/**
 * Continuous Mario-style ice-braking friction screech ("SHHHHHK—!").
 * Smoothly ramps volume & bandpass sweep with zero clicking.
 */
export function updateSkidSound(intensity: number) {
  if (!enabled || intensity <= 0.02) {
    if (skidGain) {
      try {
        const ctx = ZZFX.audioContext
        skidGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.035)
      } catch {
        /* ignore */
      }
    }
    return
  }
  unlockSound()
  ensureSkidNodes()
  if (!skidGain || !skidBand || !skidHigh) return
  try {
    const ctx = ZZFX.audioContext
    if (ctx.state !== 'running') return
    const clamped = Math.max(0, Math.min(1, intensity))
    const now = ctx.currentTime
    skidGain.gain.setTargetAtTime(0.06 + clamped * 0.2, now, 0.025)
    skidBand.frequency.setTargetAtTime(1380 + clamped * 1450, now, 0.035)
    skidHigh.gain.setTargetAtTime(2 + clamped * 6, now, 0.04)
  } catch {
    /* ignore */
  }
}

/** Light crisp skate swish/step while accelerating on ice */
export function playSkateStep(speedRatio: number) {
  const now = performance.now()
  if (!enabled || now - lastStep < 175) return
  lastStep = now
  const pitch = 920 + Math.min(1, speedRatio) * 320 + (Math.random() - 0.5) * 90
  play([.08, , pitch, .003, .012, .035, 4, .8, 0, , 0, , , .12])
}

/** Energetic upward whoosh on Dash / Slide boost */
export function playDash() {
  play([.36, , 340, .006, .06, .14, 1, 1.3, 18, , 220, .04, , .08])
}

/** Rubbery plush bump / chain-bowling boing */
export function playBump(strength = 1, isChain = false) {
  const now = performance.now()
  if (!enabled || now - lastBump < 75) return
  lastBump = now
  const s = Math.max(0.4, Math.min(1.5, strength))
  const freq = isChain ? 290 + s * 95 : 210 + s * 80
  play([.34 * Math.min(1.2, s), , freq, .005, .04, .11, 0, 1.2, 6, , 90, .03])
}

/** Soft cushioned bounce off snow-oak perimeter wall */
export function playWallBoing() {
  const now = performance.now()
  if (!enabled || now - lastBump < 95) return
  lastBump = now
  play([.22, , 185, .006, .035, .1, 0, 1.1, 4, , 55, .02])
}

/** Playful pinball chime when bouncing off Level 2/6 snow bumpers */
export function playBumperBoing() {
  const now = performance.now()
  if (!enabled || now - lastBump < 70) return
  lastBump = now
  play([.36, , 420, .004, .05, .14, 0, 1.25, 14, , 180, .03])
}

/** Crisp shimmer whoosh when gliding over Level 5/6 starlight boost pads */
export function playBoostWhoosh() {
  const now = performance.now()
  if (!enabled || now - lastSlide < 260) return
  lastSlide = now
  play([.26, , 520, .005, .05, .16, 1, 1.2, 22, , 280, .04])
}

/** Joyful ascending sparkle triad when crossing a 1★ / 2★ / 3★ threshold mid-round! */
export function playStarRankUp(stars: number) {
  const base = stars >= 3 ? 783.99 : stars === 2 ? 659.25 : 523.25
  ;[1, 1.25, 1.5].forEach((mul, idx) => {
    window.setTimeout(() => {
      play([.36, , base * mul, .006, .055, .19, 0, 1.2])
    }, idx * 70)
  })
}

/** Playful cartoon penguin/sheep belly-slide "ziiip!" */
export function playSheepSlide() {
  const now = performance.now()
  if (!enabled || now - lastSlide < 220) return
  lastSlide = now
  play([.18, , 520, .005, .03, .12, 0, 1.4, -14, , -130, .04])
}

/** Clean cheerful start whistle */
export function playStartWhistle() {
  play([.26, , 880, .008, .05, .12, 0, 1.1, 8, , 260, .03])
}

/** Pentatonic combo-escalating pen chime + golden sparkle chord */
export function playPenned(combo = 1, isGolden = false, isLast = false) {
  const idx = Math.min(COMBO_NOTES.length - 1, Math.max(0, combo - 1))
  const freq = COMBO_NOTES[idx]
  play([.44, , freq, .008, .05, .18, 0, 1.25, 0, , 0, , , .02])

  if (isGolden) {
    window.setTimeout(() => play([.38, , freq * 1.25, .006, .05, .16, 0, 1.2]), 65)
    window.setTimeout(() => play([.42, , freq * 1.5, .006, .07, .24, 0, 1.2]), 130)
  } else if (combo >= 2) {
    window.setTimeout(() => play([.28, , freq * 1.25, .005, .04, .13, 0, 1.15]), 55)
  }

  if (isLast) {
    const chord = [523.25, 659.25, 783.99, 1046.5]
    chord.forEach((f, i) => {
      window.setTimeout(() => play([.34, , f, .008, .06, .22, 0, 1.1]), 110 + i * 75)
    })
  }
}

/** Gentle cozy marimba pulse BGM (speeds up slightly in final 5 seconds) */
export function stepBgm(dt: number, active: boolean, urgent: boolean) {
  if (!enabled || !active) return
  bgmTimer -= dt
  if (bgmTimer > 0) return
  bgmTimer = urgent ? 0.24 : 0.34
  const freq = BGM_MELODY[bgmStep % BGM_MELODY.length] * (urgent ? 1.122 : 1)
  bgmStep++
  try {
    const ctx = ZZFX.audioContext
    if (ctx.state !== 'running') return
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(freq, now)
    g.gain.setValueAtTime(0.022, now)
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.16)
    osc.connect(g)
    g.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.17)
  } catch {
    /* ignore */
  }
}

const SCREAM = [680, 540, 410, 290]
let screamTimers: number[] = []

export function playScream() {
  stopScream()
  SCREAM.forEach((freq, i) => {
    const id = window.setTimeout(() => {
      play([.58, , freq, .005, .05, .2, 0, 1.5, -.55, , , , , .05, .25])
    }, i * 170)
    screamTimers.push(id)
  })
}

export function stopScream() {
  for (const id of screamTimers) clearTimeout(id)
  screamTimers = []
}

export function playTick() {
  play([.24, , 980, .001, .015, .03, 1, 1.1])
}

export function playBaa(kind: 'idle' | 'scare' = 'idle', force = false) {
  const now = performance.now()
  const gap = kind === 'scare' ? 480 : 1800
  if (!enabled) return false
  if (!force && now - lastBaa < gap) return false
  lastBaa = now
  const notes = kind === 'scare'
    ? BAA_SCARE
    : BAA[Math.floor(Math.random() * BAA.length)]!
  play(notes)
  return true
}

export function buzz(pattern: number | number[]) {
  const vibrate = navigator.vibrate?.bind(navigator)
  if (!vibrate) return
  try {
    vibrate(pattern)
  } catch {
    /* ignore */
  }
}

/** Floating score sticker right above the gate in screen space */
export function popAtScreen(
  x: number,
  y: number,
  label = '+1 ✦',
  variant: 'normal' | 'combo' | 'gold' | 'rank' = 'normal',
) {
  const host = document.getElementById('pops')
  if (!host) return
  const el = document.createElement('div')
  el.className = `pop-gate pop-gate--${variant}`
  el.textContent = label
  el.style.left = `${x.toFixed(0)}px`
  el.style.top = `${y.toFixed(0)}px`
  host.appendChild(el)
  el.addEventListener('animationend', () => el.remove())
}

/** Launches 1 (white) or 3 (golden) warm star orbs arcing from the gate to the top-right HUD star counter */
export function flyStarsToHud(
  fromX: number,
  fromY: number,
  count: number,
  isGolden: boolean,
  onArrive?: () => void,
) {
  const host = document.getElementById('pops')
  const targetEl = document.getElementById('score-pill') || document.getElementById('count-pill')
  if (!host || !targetEl) {
    onArrive?.()
    return
  }
  const hostRect = host.getBoundingClientRect()
  const targetRect = targetEl.getBoundingClientRect()
  const toX = targetRect.left + targetRect.width * 0.5 - hostRect.left
  const toY = targetRect.top + targetRect.height * 0.5 - hostRect.top

  for (let i = 0; i < count; i++) {
    window.setTimeout(() => {
      const orb = document.createElement('div')
      orb.className = isGolden ? 'fly-star fly-star--gold' : 'fly-star'
      orb.textContent = '✦'
      const jitterX = (i - (count - 1) / 2) * 26
      const sx = fromX + jitterX
      const sy = fromY
      orb.style.left = `${sx.toFixed(0)}px`
      orb.style.top = `${sy.toFixed(0)}px`
      host.appendChild(orb)

      const ctrlX = (sx + toX) * 0.5 + (isGolden ? -40 : 24)
      const ctrlY = Math.min(sy, toY) - 68
      const start = performance.now()
      const dur = 520

      const animate = (now: number) => {
        const u = Math.min(1, (now - start) / dur)
        const ease = 1 - (1 - u) * (1 - u)
        const inv = 1 - ease
        const cx = inv * inv * sx + 2 * inv * ease * ctrlX + ease * ease * toX
        const cy = inv * inv * sy + 2 * inv * ease * ctrlY + ease * ease * toY
        const sc = 1.25 - 0.35 * ease
        orb.style.left = `${cx.toFixed(1)}px`
        orb.style.top = `${cy.toFixed(1)}px`
        orb.style.transform = `translate(-50%, -50%) scale(${sc.toFixed(2)})`
        orb.style.opacity = u > 0.85 ? String((1 - u) / 0.15) : '1'
        if (u < 1) {
          requestAnimationFrame(animate)
        } else {
          orb.remove()
          onArrive?.()
        }
      }
      requestAnimationFrame(animate)
    }, i * 85)
  }
}

export function popStar(label = '✦ +1', variant: 'normal' | 'combo' | 'gold' = 'normal') {
  const host = document.getElementById('pops')
  if (!host) return
  const star = document.createElement('div')
  star.className = `pop-star pop-star--${variant}`
  star.textContent = label
  host.appendChild(star)
  star.addEventListener('animationend', () => star.remove())
}
