import * as THREE from 'three'
import { create as createStick } from 'nipplejs'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { insideGrass, moveHerder } from './bounds'
import { LEVEL_COUNT, ROUND_SECONDS, SHEEP_COUNT } from './constants'
import { buzz, playBaa, playPenned, playScream, playTick, popStar, stopScream, unlockSound } from './feedback'
import { clearImpacts, spawnImpact, stepImpacts } from './impact'
import { createIsland } from './island'
import { groundHeight, herderHome, LEVEL_META, pushOutOfWater, sheepLayout, type LevelId } from './levels'
import { createCornerPens, kickPen, resetPens, stepPens, type PenRig } from './pen'
import { createHerder, resetHerder, stepHerder as playHerder, type HerderState } from './herder'
import { createSheep, resetSheep, SHEEP_FEAR, stepSheep, type SheepState } from './sheep'
import { readHostContext, settleMeadowRound, type HostContext } from './storeBridge'
import { createTrees } from './trees'

const CAM_POS = new THREE.Vector3(3.2, 16.5, 16.5)
const LOOK = new THREE.Vector3(0, 0.15, 0)
const HERDER_SPEED = 3.85
const FALL_SECONDS = 0.85
const FALL_DROP = -2.2
const FALL_SLIDE = 1.35
const TOUCH = 1.25
const BUMP_COOLDOWN = 0.42
const HERDER_SCALE = 2.15

export class MeadowApp {
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.OrthographicCamera
  private controls: OrbitControls
  private sheep: SheepState[] = []
  private herder: HerderState
  private herdRange: THREE.Group
  private pens: PenRig
  private island: THREE.Group | null = null
  private trees: THREE.Group | null = null
  private level: LevelId = 1
  private clock = new THREE.Clock()
  private canvas: HTMLCanvasElement
  private readonly homePolar: number
  private readonly homeAzimuth: number
  private remaining = ROUND_SECONDS
  private baaWait = 2.4
  private started = false
  private paused = false
  private over = false
  private shownSecond = ROUND_SECONDS
  private hostCtx: HostContext
  private fall: {
    t: number
    dirX: number
    dirZ: number
    x0: number
    z0: number
    y0: number
  } | null = null
  private stickX = 0
  private stickY = 0
  private keys = new Set<string>()
  private stick: ReturnType<typeof createStick> | null = null

  private timeEl: HTMLElement | null
  private countEl: HTMLElement | null
  private levelEl: HTMLElement | null
  private petBadgeEl: HTMLElement | null
  private timePill: HTMLElement | null
  private countPill: HTMLElement | null
  private noticeEl: HTMLElement | null
  private resultModalEl: HTMLElement | null
  private resultTagEl: HTMLElement | null
  private scoreEl: HTMLElement | null
  private starsEl: HTMLElement | null
  private rewardPillEl: HTMLElement | null
  private replyEl: HTMLElement | null
  private nextEl: HTMLButtonElement | null
  private againEl: HTMLButtonElement | null
  private backEl: HTMLButtonElement | null
  private pauseModalEl: HTMLElement | null
  private standaloneStarEl: HTMLElement | null
  private levelButtons: NodeListOf<HTMLButtonElement>

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.hostCtx = readHostContext()

    this.timeEl = document.getElementById('time')
    this.countEl = document.getElementById('count')
    this.levelEl = document.getElementById('level')
    this.petBadgeEl = document.getElementById('pet-badge')
    this.timePill = document.getElementById('time-pill')
    this.countPill = document.getElementById('count-pill')
    this.noticeEl = document.getElementById('ready-notice')
    this.resultModalEl = document.getElementById('result-modal')
    this.resultTagEl = document.getElementById('result-tag')
    this.scoreEl = document.getElementById('score')
    this.starsEl = document.getElementById('stars')
    this.rewardPillEl = document.getElementById('reward-pill')
    this.replyEl = document.getElementById('pet-reply')
    this.nextEl = document.getElementById('next') as HTMLButtonElement | null
    this.againEl = document.getElementById('again') as HTMLButtonElement | null
    this.backEl = document.getElementById('back') as HTMLButtonElement | null
    this.pauseModalEl = document.getElementById('pause-modal')
    this.standaloneStarEl = document.getElementById('standalone-star-pill')
    this.levelButtons = document.querySelectorAll<HTMLButtonElement>('[data-level-pick]')

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
    })
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.NoToneMapping

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0xeef2e8)

    this.camera = new THREE.OrthographicCamera(-10.8, 10.8, 22, -22, 0.1, 80)
    this.camera.position.copy(CAM_POS)
    this.camera.lookAt(LOOK)

    const offset = new THREE.Vector3().subVectors(CAM_POS, LOOK)
    const spherical = new THREE.Spherical().setFromVector3(offset)
    this.homePolar = spherical.phi
    this.homeAzimuth = spherical.theta

    this.controls = new OrbitControls(this.camera, canvas)
    this.controls.target.copy(LOOK)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.enablePan = false
    this.controls.enableRotate = false
    this.controls.zoomSpeed = 0.55
    this.controls.minZoom = 0.78
    this.controls.maxZoom = 1.65
    this.controls.minAzimuthAngle = this.homeAzimuth - 0.18
    this.controls.maxAzimuthAngle = this.homeAzimuth + 0.18
    this.controls.minPolarAngle = this.homePolar - 0.08
    this.controls.maxPolarAngle = this.homePolar + 0.32
    this.controls.update()

    const hemi = new THREE.HemisphereLight(0xfffdf8, 0xc3d997, 0.96)
    this.scene.add(hemi)

    const sun = new THREE.DirectionalLight(0xfff8ec, 1.22)
    sun.position.set(-9, 16, 5)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.bias = -0.0004
    sun.shadow.radius = 3
    const span = 16
    sun.shadow.camera.near = 2
    sun.shadow.camera.far = 40
    sun.shadow.camera.left = -span
    sun.shadow.camera.right = span
    sun.shadow.camera.top = span
    sun.shadow.camera.bottom = -span
    this.scene.add(sun)

    this.mountTerrain()
    this.pens = createCornerPens()
    this.scene.add(this.pens.root)
    this.spawnSheep()
    this.herder = createHerder(this.hostCtx.petId)
    this.placeHerderHome()
    this.herder.group.scale.setScalar(HERDER_SCALE)
    this.scene.add(this.herder.group)

    this.herdRange = createHerdRange(SHEEP_FEAR)
    const [hx, hz] = herderHome(this.level)
    this.herdRange.position.set(hx, groundHeight(this.level, hx, hz), hz)
    this.scene.add(this.herdRange)

    this.paintHostMeta()
    this.bindStick()
    this.bindKeyboard()
    requestAnimationFrame(() => this.stick?.reposition())
    this.resize()
    this.updateLevelPills()
    this.updateNotice()
    this.updateHud()
    window.addEventListener('resize', () => this.resize())
  }

  private paintHostMeta() {
    if (this.petBadgeEl) {
      this.petBadgeEl.textContent = `${this.hostCtx.petName}上场`
    }
    if (this.standaloneStarEl) {
      this.standaloneStarEl.textContent = `✦ ${this.hostCtx.starBalance}`
    }
  }

  private placeHerderHome() {
    const [x, z] = herderHome(this.level)
    this.herder.group.position.set(x, groundHeight(this.level, x, z), z)
  }

  private mountTerrain() {
    if (this.island) {
      this.scene.remove(this.island)
      disposeGeometries(this.island)
    }
    if (this.trees) {
      this.scene.remove(this.trees)
      disposeGeometries(this.trees)
    }
    this.island = createIsland(this.level)
    this.trees = createTrees(this.level)
    this.scene.add(this.island)
    this.scene.add(this.trees)
  }

  private spawnSheep() {
    const layout = sheepLayout(this.level)
    for (let i = 0; i < SHEEP_COUNT; i++) {
      const [x, z] = layout[i]
      const state = createSheep()
      state.homeX = x
      state.homeZ = z
      state.group.position.set(x, groundHeight(this.level, x, z), z)
      if (state.velocity.lengthSq() > 0.0001) {
        state.group.rotation.y = Math.atan2(-state.velocity.y, state.velocity.x)
      } else {
        state.group.rotation.y = Math.random() * Math.PI * 2
      }
      state.group.scale.setScalar(1.15)
      this.sheep.push(state)
      this.scene.add(state.group)
    }
  }

  private bindStick() {
    const zone = document.getElementById('stick')
    if (!zone) return
    const manager = createStick({
      zone,
      mode: 'static',
      position: { left: '50%', top: '50%' },
      size: 124,
      threshold: 0.1,
      restOpacity: 0.92,
      color: {
        front: '#002900',
        back: 'rgba(255, 255, 255, 0.72)',
      },
    })
    this.stick = manager
    zone.addEventListener('pointerdown', (e) => {
      e.stopPropagation()
      unlockSound()
    })
    manager.on('move', (evt) => {
      if (this.over || this.paused) return
      this.stickX = evt.data.vector.x
      this.stickY = evt.data.vector.y
      if (!this.started && Math.hypot(this.stickX, this.stickY) >= 0.15) {
        this.beginRound()
      }
    })
    manager.on('end', () => {
      this.stickX = 0
      this.stickY = 0
    })
  }

  private bindKeyboard() {
    const moveKeys = new Set([
      'ArrowUp',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
      'KeyW',
      'KeyA',
      'KeyS',
      'KeyD',
    ])
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && !this.over) {
        this.setPaused(!this.paused)
        return
      }
      if (!moveKeys.has(e.code)) return
      e.preventDefault()
      unlockSound()
      this.keys.add(e.code)
      if (!this.started && !this.over && !this.paused) {
        this.beginRound()
      }
    })
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code)
    })
    window.addEventListener('blur', () => {
      this.keys.clear()
      this.releaseStick()
    })
  }

  private readInputVector(): { x: number; y: number } {
    let x = this.stickX
    let y = this.stickY
    if (this.keys.size > 0) {
      let kx = 0
      let ky = 0
      if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) kx -= 1
      if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) kx += 1
      if (this.keys.has('ArrowUp') || this.keys.has('KeyW')) ky += 1
      if (this.keys.has('ArrowDown') || this.keys.has('KeyS')) ky -= 1
      const len = Math.hypot(kx, ky)
      if (len > 0) {
        x = kx / len
        y = ky / len
      }
    }
    return { x, y }
  }

  private releaseStick() {
    this.stickX = 0
    this.stickY = 0
  }

  private beginRound() {
    if (this.started) return
    this.started = true
    this.updateNotice()
  }

  private updateNotice() {
    if (!this.noticeEl) return
    const meta = LEVEL_META[this.level]
    this.noticeEl.textContent = meta.hint
    this.noticeEl.classList.toggle('is-hidden', this.started || this.over || this.paused)
  }

  private updateLevelPills() {
    this.levelButtons.forEach((btn) => {
      const id = Number(btn.dataset.levelPick)
      btn.classList.toggle('is-active', id === this.level)
    })
  }

  setPaused(next: boolean) {
    if (this.over) return
    this.paused = next
    if (next) {
      this.releaseStick()
      this.keys.clear()
    }
    if (this.pauseModalEl) {
      this.pauseModalEl.hidden = !next
      this.pauseModalEl.setAttribute('aria-hidden', String(!next))
    }
    this.updateNotice()
  }

  isPaused() {
    return this.paused
  }

  getLevel(): LevelId {
    return this.level
  }

  private stepHerder(dt: number) {
    const pos = this.herder.group.position
    const input = this.readInputVector()
    const mag = Math.hypot(input.x, input.y)
    let power = 0
    if (mag >= 0.15) {
      const e = this.camera.matrixWorld.elements
      const rightX = e[0]
      const rightZ = e[2]
      const fwdX = -e[8]
      const fwdZ = -e[10]
      const rlen = Math.hypot(rightX, rightZ) || 1
      const flen = Math.hypot(fwdX, fwdZ) || 1
      power = Math.min(1, (mag - 0.15) / 0.85)
      let dx = (rightX / rlen) * (input.x / mag) + (fwdX / flen) * (input.y / mag)
      let dz = (rightZ / rlen) * (input.x / mag) + (fwdZ / flen) * (input.y / mag)
      const dlen = Math.hypot(dx, dz) || 1
      dx /= dlen
      dz /= dlen
      const step = HERDER_SPEED * power * dt
      const next = moveHerder(pos.x + dx * step, pos.z + dz * step, this.level)
      pos.x = next.x
      pos.z = next.z
      this.herder.group.rotation.y = dampAngle(
        this.herder.group.rotation.y,
        Math.atan2(-dz, dx),
        dt,
      )
      if (!insideGrass(next.x, next.z)) {
        pos.y = groundHeight(this.level, pos.x, pos.z)
        this.beginFall(dx, dz)
        return
      }
    }
    pos.y = groundHeight(this.level, pos.x, pos.z)
    playHerder(this.herder, dt, power)
  }

  private beginFall(dirX: number, dirZ: number) {
    const pos = this.herder.group.position
    this.over = true
    this.releaseStick()
    this.keys.clear()
    this.fall = {
      t: 0,
      dirX,
      dirZ,
      x0: pos.x,
      z0: pos.z,
      y0: pos.y,
    }
    this.herder.group.rotation.order = 'YXZ'
    spawnImpact(this.scene, pos.x, pos.z, dirX, dirZ, 0.85)
    playScream()
  }

  private stepFall(dt: number) {
    const fall = this.fall
    if (!fall) return
    fall.t += dt
    const u = Math.min(1, fall.t / FALL_SECONDS)
    const ease = u * u * (3 - 2 * u)
    const pos = this.herder.group.position
    pos.x = fall.x0 + fall.dirX * FALL_SLIDE * ease
    pos.z = fall.z0 + fall.dirZ * FALL_SLIDE * ease
    pos.y = fall.y0 + (FALL_DROP - fall.y0) * ease
    this.herder.group.rotation.order = 'YXZ'
    this.herder.group.rotation.x = (Math.PI / 2) * ease
    const lift = Math.sin(u * Math.PI) * 1.2
    this.herder.leftArm.rotation.z = lift
    this.herder.rightArm.rotation.z = -lift
    if (u >= 1) {
      this.fall = null
      this.finish('fall')
    }
  }

  private pulse(el: HTMLElement | null) {
    if (!el) return
    el.classList.remove('pop')
    void el.offsetWidth
    el.classList.add('pop')
  }

  resize() {
    const w = this.canvas.clientWidth
    const h = this.canvas.clientHeight
    if (w === 0 || h === 0) return
    this.renderer.setSize(w, h, false)
    const aspect = w / h
    const minHalfW = 10.9
    const minHalfH = 13.6
    const halfH = Math.max(minHalfH, minHalfW / Math.max(0.38, aspect))
    const halfW = halfH * aspect
    const zoom = this.camera.zoom
    this.camera.left = -halfW
    this.camera.right = halfW
    this.camera.top = halfH
    this.camera.bottom = -halfH
    this.camera.zoom = zoom
    this.camera.updateProjectionMatrix()
    requestAnimationFrame(() => this.stick?.reposition())
  }

  restart() {
    stopScream()
    this.fall = null
    this.remaining = ROUND_SECONDS
    this.shownSecond = ROUND_SECONDS
    this.started = false
    this.paused = false
    this.over = false
    this.releaseStick()
    this.keys.clear()
    this.placeHerderHome()
    this.herder.group.rotation.y = 0
    resetHerder(this.herder)
    this.timePill?.classList.remove('urgent', 'pop')
    this.countPill?.classList.remove('pop')
    for (const s of this.sheep) resetSheep(s, this.level)
    this.baaWait = 2.4
    clearImpacts()
    resetPens(this.pens, this.level)
    if (this.resultModalEl) {
      this.resultModalEl.hidden = true
      this.resultModalEl.setAttribute('aria-hidden', 'true')
    }
    if (this.pauseModalEl) {
      this.pauseModalEl.hidden = true
      this.pauseModalEl.setAttribute('aria-hidden', 'true')
    }
    this.updateLevelPills()
    this.updateNotice()
    this.updateHud()
  }

  private bumpHerder(s: SheepState, hx: number, hz: number) {
    if (s.mode === 'penned' || s.bumpCooldown > 0) return
    const dx = s.group.position.x - hx
    const dz = s.group.position.z - hz
    const dist = Math.hypot(dx, dz)
    if (dist >= TOUCH || dist < 0.001) return
    spawnImpact(this.scene, (s.group.position.x + hx) / 2, (s.group.position.z + hz) / 2, dx, dz, 0.9)
    const push = TOUCH - dist + 0.05
    const shoved = pushOutOfWater(
      this.level,
      clamp(s.group.position.x + (dx / dist) * push, -6.9, 6.9),
      clamp(s.group.position.z + (dz / dist) * push, -6.9, 6.9),
      0.26,
    )
    s.group.position.x = clamp(shoved.x, -6.9, 6.9)
    s.group.position.z = clamp(shoved.z, -6.9, 6.9)
    s.group.position.y = groundHeight(this.level, s.group.position.x, s.group.position.z)
    s.bumpCooldown = BUMP_COOLDOWN
  }

  private pennedCount() {
    return this.sheep.filter((s) => s.mode === 'penned').length
  }

  private finish(reason: 'round' | 'fall' = 'round') {
    this.over = true
    this.paused = false
    this.releaseStick()
    this.keys.clear()
    const n = this.pennedCount()
    const meta = LEVEL_META[this.level]
    const settled = settleMeadowRound({
      level: this.level,
      penned: n,
      total: SHEEP_COUNT,
      reason,
    })
    this.hostCtx.starBalance = settled.starBalance
    this.paintHostMeta()

    const tierStars = n >= SHEEP_COUNT ? 3 : n >= 7 ? 2 : n >= 3 ? 1 : 0
    if (this.resultTagEl) {
      this.resultTagEl.textContent =
        reason === 'fall'
          ? `第 ${this.level} 关 · 滑出草边`
          : `第 ${this.level} 关 · ${meta.name}`
    }
    if (this.scoreEl) {
      this.scoreEl.textContent = `${n} / ${SHEEP_COUNT} 只进圈`
    }
    if (this.starsEl) {
      this.starsEl.textContent = `${'✦'.repeat(tierStars)}${'✧'.repeat(3 - tierStars)}`
    }
    if (this.rewardPillEl) {
      if (settled.starsAwarded > 0) {
        this.rewardPillEl.textContent = `获得 +${settled.starsAwarded} ✦（今日 ${settled.dailyEarned}/${settled.dailyCap}✦）`
      } else {
        this.rewardPillEl.textContent = `今日游艺已满额 · 改赠 +${settled.expAwarded || 5} EXP`
      }
    }
    if (this.replyEl) {
      this.replyEl.textContent = `${this.hostCtx.petName}：「${settled.petReply}」`
    }

    const hasNext = this.level < LEVEL_COUNT
    if (this.nextEl) this.nextEl.hidden = !hasNext
    if (this.againEl) {
      this.againEl.className = hasNext ? 'eb-btn eb-btn--secondary-soft' : 'eb-btn eb-btn--primary'
      this.againEl.textContent = hasNext ? '重玩本关' : '再来一局'
    }
    if (this.backEl) this.backEl.hidden = this.level === 1

    if (this.resultModalEl) {
      this.resultModalEl.hidden = false
      this.resultModalEl.setAttribute('aria-hidden', 'false')
    }
    this.updateNotice()
    this.updateHud()
  }

  private updateHud() {
    const sec = Math.max(0, Math.ceil(this.remaining - 1e-4))
    const m = Math.floor(sec / 60)
    const s = sec % 60
    const meta = LEVEL_META[this.level]
    if (this.timeEl) this.timeEl.textContent = `${m}:${s.toString().padStart(2, '0')}`
    if (this.countEl) this.countEl.textContent = `${this.pennedCount()}/${SHEEP_COUNT}`
    if (this.levelEl) this.levelEl.textContent = `第${this.level}关 · ${meta.name}`
    const urgent = this.started && !this.over && !this.paused && sec <= 5 && sec >= 1
    this.timePill?.classList.toggle('urgent', urgent)
    if (sec !== this.shownSecond) {
      if (urgent) {
        this.pulse(this.timePill)
        playTick()
      }
      this.shownSecond = sec
    }
  }

  /** Rebuild the ground and start this level from the opening positions. */
  gotoLevel(level: LevelId) {
    this.level = level
    const layout = sheepLayout(level)
    this.sheep.forEach((sheep, i) => {
      sheep.homeX = layout[i][0]
      sheep.homeZ = layout[i][1]
    })
    this.mountTerrain()
    this.restart()
  }

  nextLevel() {
    const next = Math.min(LEVEL_COUNT, this.level + 1) as LevelId
    this.gotoLevel(next)
  }

  tick() {
    const dt = Math.min(this.clock.getDelta(), 0.05)
    const t = this.clock.elapsedTime

    if (!this.paused) {
      if (!this.over) {
        if (this.started) {
          this.remaining = Math.max(0, this.remaining - dt)
        }
        this.stepHerder(dt)
      }
      if (this.fall) this.stepFall(dt)
      if (!this.over) {
        const hx = this.herder.group.position.x
        const hz = this.herder.group.position.z
        this.herdRange.position.set(hx, groundHeight(this.level, hx, hz), hz)
        const flock = this.sheep
          .filter((s) => s.mode !== 'penned')
          .map((s) => ({ x: s.group.position.x, z: s.group.position.z }))
        this.baaWait -= dt
        const wantIdle = flock.length > 0 && this.baaWait <= 0
        let startled = false
        for (const s of this.sheep) {
          const calm = s.mode !== 'flee' && s.mode !== 'penned'
          const event = stepSheep(s, dt, t, hx, hz, flock, this.level)
          if (calm && s.mode === 'flee') startled = true
          if (event?.kind === 'fence') {
            spawnImpact(this.scene, event.x, event.z, event.nx, event.nz, 0.7)
          } else if (event?.kind === 'penned') {
            spawnImpact(this.scene, event.x, event.z, event.nx, event.nz, 0.8)
            kickPen(this.pens, event.penIndex)
            const last = this.pennedCount() === SHEEP_COUNT
            popStar()
            this.pulse(this.countPill)
            playPenned(last)
            buzz(last ? [16, 30, 28] : 18)
          }
          this.bumpHerder(s, hx, hz)
        }
        if (startled) {
          playBaa('scare')
          this.baaWait = Math.max(this.baaWait, 1.6)
        } else if (wantIdle) {
          playBaa('idle')
          this.baaWait = 3.4 + Math.random() * 3.6
        }
        if (this.started && (this.remaining <= 0 || this.pennedCount() === SHEEP_COUNT)) {
          this.finish()
        } else {
          this.updateHud()
        }
      }
      stepPens(this.pens, dt, this.level)
      stepImpacts(dt)
    }

    this.herdRange.visible = !this.over
    this.controls.update()
    this.renderer.render(this.scene, this.camera)
  }
}

function disposeGeometries(root: THREE.Object3D) {
  root.traverse((child) => {
    const mesh = child as THREE.Mesh
    mesh.geometry?.dispose()
  })
}

/** Calm EggBabe sage ring showing sheep herding radius. */
function createHerdRange(radius: number) {
  const group = new THREE.Group()
  const fill = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 72),
    new THREE.MeshBasicMaterial({
      color: 0xd8e5b4,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
    }),
  )
  fill.rotation.x = -Math.PI / 2
  fill.position.y = 0.03
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(Math.max(0.05, radius - 0.08), radius, 72),
    new THREE.MeshBasicMaterial({
      color: 0x9db65b,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  )
  ring.rotation.x = -Math.PI / 2
  ring.position.y = 0.05
  group.add(fill, ring)
  return group
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

function dampAngle(current: number, target: number, dt: number) {
  let d = target - current
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return current + d * Math.min(1, dt * 8)
}