/**
 * Lightweight zero-asset Web Audio synthesizer for cozy miniature SFX.
 */
class CozySound {
  private ctx: AudioContext | null = null
  private muted = false

  setMuted(m: boolean) {
    this.muted = m
  }

  isMuted() {
    return this.muted
  }

  private ensure(): AudioContext | null {
    if (this.muted) return null
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return null
      this.ctx = new AC()
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {})
    }
    return this.ctx
  }

  private tone(freq: number, dur: number, type: OscillatorType = 'sine', gainPeak = 0.08, delay = 0) {
    const ctx = this.ensure()
    if (!ctx) return
    const now = ctx.currentTime + delay
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, now)
    g.gain.setValueAtTime(0.0001, now)
    g.gain.exponentialRampToValueAtTime(gainPeak, now + 0.015)
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur)
    osc.connect(g)
    g.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + dur + 0.02)
  }

  /** Soft wooden water-drop tap on floor */
  tap() {
    this.tone(520, 0.08, 'sine', 0.055)
    this.tone(680, 0.06, 'sine', 0.03, 0.02)
  }

  /** Gentle blocked thud */
  blocked() {
    this.tone(210, 0.09, 'triangle', 0.05)
  }

  /** Cute double chirp when petting the bunny */
  pet() {
    this.tone(660, 0.09, 'sine', 0.07)
    this.tone(880, 0.13, 'sine', 0.07, 0.07)
  }

  /** Cozy interaction chime */
  interact() {
    this.tone(587.33, 0.14, 'triangle', 0.065)
    this.tone(783.99, 0.18, 'sine', 0.065, 0.08)
  }

  /** Wish fulfilled warm arpeggio */
  wishDone() {
    ;[523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      this.tone(f, 0.22, 'sine', 0.07, i * 0.07)
    })
  }

  /** Wind-chime chord for room upgrade */
  upgrade() {
    ;[523.25, 659.25, 783.99, 987.77, 1318.5].forEach((f, i) => {
      this.tone(f, 0.36, 'triangle', 0.075, i * 0.065)
    })
  }

  /** Soft toggle click for day/night or UI */
  toggle() {
    this.tone(440, 0.07, 'sine', 0.045)
  }
}

export const sound = new CozySound()
