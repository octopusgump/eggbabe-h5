import './style.css'
import { VW, VH } from './meadow/constants'
import { MeadowApp } from './meadow/MeadowApp'
import { mountUI, setPaused } from './ui/overlay'

function fitStage() {
  const el = document.getElementById('fit')
  if (!el) return
  const k = Math.min(innerWidth / VW, innerHeight / VH)
  el.style.transform = `translate(-50%, -50%) scale(${k})`
}

const canvas = document.getElementById('canvas') as HTMLCanvasElement | null
if (!canvas) throw new Error('#canvas missing')

const app = new MeadowApp(canvas)

const ui = mountUI(
  () => {
    app.reset()
    setPaused(ui, false)
    const btn = document.getElementById('btn-pause')
    if (btn) btn.textContent = '⏸'
    const label = ui.liveEl.querySelector('span:last-child')
    if (label) label.textContent = '草场进行中'
  },
  () => {
    const next = !ui.liveEl.classList.contains('paused')
    app.setPaused(next)
    setPaused(ui, next)
  },
)

fitStage()
addEventListener('resize', fitStage)

function frame() {
  app.tick()
  requestAnimationFrame(frame)
}
frame()