import './style.css'
import { VW, VH } from './meadow/constants'
import { MeadowApp } from './meadow/MeadowApp'
import { mountUI } from './ui/overlay'

function fitStage() {
  const el = document.getElementById('fit')
  if (!el) return
  const k = Math.min(innerWidth / VW, innerHeight / VH)
  el.style.transform = `translate(-50%, -50%) scale(${k})`
}

const canvas = document.getElementById('canvas') as HTMLCanvasElement | null
if (!canvas) throw new Error('#canvas missing')

const app = new MeadowApp(canvas)
mountUI()

fitStage()
addEventListener('resize', fitStage)

function frame() {
  app.tick()
  requestAnimationFrame(frame)
}
frame()