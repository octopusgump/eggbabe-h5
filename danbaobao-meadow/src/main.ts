import './style.css'
import { VW, VH } from './meadow/constants'
import { playBaa, setSoundEnabled, soundEnabled, unlockSound } from './meadow/feedback'
import { MeadowApp } from './meadow/MeadowApp'

function fitStage() {
  const el = document.getElementById('fit')
  if (!el) return
  const k = Math.min(innerWidth / VW, innerHeight / VH)
  el.style.transform = `translate(-50%, -50%) scale(${k})`
}

const canvas = document.getElementById('canvas') as HTMLCanvasElement | null
if (!canvas) throw new Error('#canvas missing')

const app = new MeadowApp(canvas)
document.getElementById('again')?.addEventListener('click', () => app.restart())

const soundBtn = document.getElementById('sound')
function paintSound() {
  if (!soundBtn) return
  const on = soundEnabled()
  soundBtn.textContent = on ? '🔊' : '🔇'
  soundBtn.setAttribute('aria-pressed', String(on))
  soundBtn.setAttribute('aria-label', on ? '关闭声音' : '打开声音')
}
paintSound()
soundBtn?.addEventListener('click', () => {
  unlockSound()
  const next = !soundEnabled()
  setSoundEnabled(next)
  paintSound()
  if (next) playBaa('idle', true)
})

fitStage()
addEventListener('resize', fitStage)

function frame() {
  app.tick()
  requestAnimationFrame(frame)
}
frame()