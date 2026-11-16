import { ZZFX, zzfx } from 'zzfx'

const SOUND_KEY = 'meadow-sound'

const PEN = [,,740,.01,.04,.14,1,1.35,,,,,0.08,.08]
const WIN = [,,620,.01,.06,.28,1,1.15,,180,.04,.02,.08]
/** Soft "baa": a short fall into a lower second note. */
const BAA = [
  [.42,,360,.01,.05,.16,1,1.4,-.15,,-110,.08,,.04,.35],
  [.38,,310,.02,.06,.2,1,1.5,-.1,,-80,.1,,.05,.28],
  [.46,,420,.01,.04,.14,1,1.3,-.2,,-140,.07,,.03,.4],
]
const BAA_SCARE = [.58,,480,.005,.03,.14,1,1.3,-.35,,-160,.05,,.06,.45]

let enabled = readEnabled()
let lastBaa = 0

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
    /* Private mode can refuse storage; the toggle still works this visit. */
  }
  if (on) unlockSound()
}

/** Browsers only start audio after a tap. Call this from the first pointer. */
export function unlockSound() {
  const ctx = ZZFX.audioContext
  if (ctx.state === 'suspended') void ctx.resume()
}

function play(notes: readonly (number | undefined)[]) {
  if (!enabled) return
  unlockSound()
  zzfx(...(notes as [number, ...number[]]))
}

const SCREAM = [680, 540, 410, 290]
let screamTimers: number[] = []

/** Four falling "ah" notes. Later notes stay silent if the player mutes mid-fall. */
export function playScream() {
  stopScream()
  SCREAM.forEach((freq, i) => {
    const id = window.setTimeout(() => {
      play([.62, , freq, .005, .05, .22, 0, 1.5, -.55, , , , , .05, .25])
    }, i * 180)
    screamTimers.push(id)
  })
}

export function stopScream() {
  for (const id of screamTimers) clearTimeout(id)
  screamTimers = []
}

export function playTick() {
  play([.22, , 980, .001, .015, .03, 1, 1.1])
}

export function playPenned(last: boolean) {
  play(last ? WIN : PEN)
}

/** One sheep voice. Scare bleats can cut in sooner than idle ones. */
export function playBaa(kind: 'idle' | 'scare' = 'idle', force = false) {
  const now = performance.now()
  const gap = kind === 'scare' ? 520 : 1600
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
    /* Some phones do not expose vibration. */
  }
}

export function popStar() {
  const host = document.getElementById('pops')
  if (!host) return
  const star = document.createElement('div')
  star.className = 'pop-star'
  star.textContent = '⭐ +1'
  host.appendChild(star)
  star.addEventListener('animationend', () => star.remove())
}
