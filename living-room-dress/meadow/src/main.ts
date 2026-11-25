import './style.css'
import { playBaa, setSoundEnabled, soundEnabled, unlockSound } from './meadow/feedback'
import type { LevelId } from './meadow/levels'
import { MeadowApp } from './meadow/MeadowApp'
import {
  isEmbeddedMode,
  readHostContext,
  requestReturnRoom,
  syncSfxPreference,
} from './meadow/storeBridge'

if (isEmbeddedMode()) {
  document.body.classList.add('is-embedded')
}

const hostCtx = readHostContext()
setSoundEnabled(hostCtx.sfxOn)

const canvas = document.getElementById('canvas') as HTMLCanvasElement | null
if (!canvas) throw new Error('#canvas missing')

const app = new MeadowApp(canvas)

document.getElementById('again')?.addEventListener('click', () => app.restart())
document.getElementById('next')?.addEventListener('click', () => app.nextLevel())
document.getElementById('back')?.addEventListener('click', () => app.gotoLevel(1))
document.getElementById('btn-return-room')?.addEventListener('click', () => requestReturnRoom())
document.getElementById('btn-pause-room')?.addEventListener('click', () => requestReturnRoom())
document.getElementById('btn-standalone-back')?.addEventListener('click', (e) => {
  e.preventDefault()
  requestReturnRoom()
})

const pauseBtn = document.getElementById('btn-pause')
pauseBtn?.addEventListener('click', () => {
  app.setPaused(!app.isPaused())
})
document.getElementById('btn-resume')?.addEventListener('click', () => app.setPaused(false))
document.getElementById('btn-pause-restart')?.addEventListener('click', () => app.restart())
document.getElementById('pause-backdrop')?.addEventListener('click', () => app.setPaused(false))

document.querySelectorAll<HTMLButtonElement>('[data-level-pick]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const lvl = Number(btn.dataset.levelPick)
    if (lvl >= 1 && lvl <= 6) {
      app.gotoLevel(lvl as LevelId)
    }
  })
})

const soundBtn = document.getElementById('sound')
const iconSoundOn = document.getElementById('icon-sound-on')
const iconSoundOff = document.getElementById('icon-sound-off')

function paintSound() {
  if (!soundBtn) return
  const on = soundEnabled()
  soundBtn.setAttribute('aria-pressed', String(on))
  soundBtn.setAttribute('aria-label', on ? '关闭声音' : '打开声音')
  if (iconSoundOn) iconSoundOn.style.display = on ? 'block' : 'none'
  if (iconSoundOff) iconSoundOff.style.display = on ? 'none' : 'block'
}

paintSound()
soundBtn?.addEventListener('click', () => {
  unlockSound()
  const next = !soundEnabled()
  setSoundEnabled(next)
  syncSfxPreference(next)
  paintSound()
  if (next) playBaa('idle', true)
})

function frame() {
  app.tick()
  requestAnimationFrame(frame)
}
frame()