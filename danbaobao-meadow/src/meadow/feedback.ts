import { ZZFX, zzfx } from 'zzfx'

const PEN = [,,740,.01,.04,.14,1,1.35,,,,,0.08,.08]
const WIN = [,,620,.01,.06,.28,1,1.15,,180,.04,.02,.08]

/** Browsers only start audio after a tap. Call this from the first pointer. */
export function unlockSound() {
  const ctx = ZZFX.audioContext
  if (ctx.state === 'suspended') void ctx.resume()
}

export function playPenned(last: boolean) {
  const notes = (last ? WIN : PEN) as [number, ...number[]]
  zzfx(...notes)
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
