import * as THREE from 'three'
import { create as createStick } from 'nipplejs'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { insideGrass, moveHerder } from './bounds'
import { LEVEL_COUNT, ROUND_SECONDS, SHEEP_COUNT } from './constants'
import { buzz, playBaa, playPenned, playScream, playTick, popStar, stopScream, unlockSound } from './feedback'
import { clearImpacts, spawnImpact, stepImpacts } from './impact'
import { createIsland } from './island'
import { groundHeight, herderHome, LEVEL_META, pushOutOfWater, sheepLayout, type LevelId } from './levels'
import { felt } from './materials'
import { createCornerPens, kickPen, resetPens, stepPens, type PenRig } from './pen'
import {
  createHerder,
  orientHerderToCamera,
  resetHerder,
  stepHerder as playHerder,
  stepHerderFall,
  type HerderState,
} from './herder'
import { createSheep, resetSheep, SHEEP_FEAR, stepSheep, type SheepState } from './sheep'
import { readHostContext, settleMeadowRound, type HostContext } from './storeBridge'
import { createTrees, stepTrees } from './trees'

const CAM_POS = new THREE.Vector3(3.6, 15.2, 16.4)
const LOOK = new THREE.Vector3(0, -0.1, 0.25)
const HERDER_SPEED = 3.9
const FALL_SECONDS = 0.85
const FALL_DROP = -2.4
const FALL_SLIDE = 1.35
const TOUCH = 1.25
const BUMP_COOLDOWN = 0.42

type DustPuff = {
  mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>
  age: number
  life: number
  vx: number
  vy: number
  vz: number
}

export class MeadowApp {
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.OrthographicCamera
  private controls: OrbitControls
  private sheep: SheepState[] = []
  private herder: HerderState
  private herdRange: {
    group: THREE.Group
    fillMat: THREE.MeshBasicMaterial
    ringMat: THREE.MeshBasicMaterial
  }
  private clouds: THREE.Group
  private dust: DustPuff[] = []
  private dustTimer = 0
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
      alpha: true,
    })
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 0.95
    this.renderer.setClearColor(0x000000, 0)

    this.scene = new THREE.Scene()
    const pmrem = new THREE.PMREMGenerator(this.renderer)
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    this.scene.environment = envTex
    this.scene.environmentIntensity = 0.26
    pmrem.dispose()

    this.camera = new THREE.OrthographicCamera(-9.5, 9.5, 10, -10, 0.1, 90)
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
    this.controls.minZoom = 0.82
    this.controls.maxZoom = 1.55
    this.controls.minAzimuthAngle = this.homeAzimuth - 0.18
    this.controls.maxAzimuthAngle = this.homeAzimuth + 0.18
    this.controls.minPolarAngle = this.homePolar - 0.08
    this.controls.maxPolarAngle = this.homePolar + 0.32
    this.controls.update()

    // Balanced warm sunlit studio lighting with cozy contrast
    const hemi = new THREE.HemisphereLight(0xfff8ea, 0xa2b672, 0.64)
    this.scene.add(hemi)

    const sun = new THREE.DirectionalLight(0xffebc2, 1.24)
    sun.position.set(-10, 17, 6.5)
    sun.castShadow = true
    sun.shadow.mapSize.set(1024, 1024)
    sun.shadow.bias = -0.0005
    sun.shadow.normalBias = 0.02
    sun.shadow.radius = 3.2
    const span = 15
    sun.shadow.camera.near = 2
    sun.shadow.camera.far = 42
    sun.shadow.camera.left = -span
    sun.shadow.camera.right = span
    sun.shadow.camera.top = span
    sun.shadow.camera.bottom = -span
    this.scene.add(sun)

    const rim = new THREE.DirectionalLight(0xffe6c4, 0.26)
    rim.position.set(12, 9, -10)
    this.scene.add(rim)

    this.clouds = createFeltClouds()
    this.scene.add(this.clouds)

    this.mountTerrain()
    this.pens = createCornerPens()
    this.scene.add(this.pens.root)
    this.spawnSheep()

    this.herder = createHerder(
      this.hostCtx.petId,
      this.hostCtx.outfitImageUrl,
      this.hostCtx.fallbackImageUrl,
    )
    this.placeHerderHome()
    this.scene.add(this.herder.group)

    this.herdRange = createHerdRange(SHEEP_FEAR)
    const [hx, hz] = herderHome(this.level)
    this.herdRange.group.position.set(hx, groundHeight(this.level, hx, hz), hz)
    this.scene.add(this.herdRange.group)

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
      state.group.scale.setScalar(1.18)
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
      size: 112,
      threshold: 0.1,
      restOpacity: 0.94,
      color: {
        front: '#6E8544',
        back: 'rgba(252, 248, 239, 0.86)',
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

  private spawnDust(x: number, y: number, z: number, dirX: number, dirZ: number) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xfbf5e6,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    })
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), mat)
    mesh.position.set(
      x - dirX * 0.25 + (Math.random() - 0.5) * 0.18,
      y + 0.1,
      z - dirZ * 0.25 + (Math.random() - 0.5) * 0.18,
    )
    this.scene.add(mesh)
    this.dust.push({
      mesh,
      age: 0,
      life: 0.42,
      vx: -dirX * 0.35 + (Math.random() - 0.5) * 0.2,
      vy: 0.35 + Math.random() * 0.25,
      vz: -dirZ * 0.35 + (Math.random() - 0.5) * 0.2,
    })
  }

  private stepDust(dt: number) {
    for (let i = this.dust.length - 1; i >= 0; i--) {
      const d = this.dust[i]
      d.age += dt
      const u = d.age / d.life
      if (u >= 1) {
        this.scene.remove(d.mesh)
        d.mesh.geometry.dispose()
        d.mesh.material.dispose()
        this.dust.splice(i, 1)
        continue
      }
      d.mesh.position.x += d.vx * dt
      d.mesh.position.y += d.vy * dt
      d.mesh.position.z += d.vz * dt
      d.mesh.scale.setScalar(1 + u * 0.85)
      d.mesh.material.opacity = 0.62 * (1 - u)
    }
  }

  private clearDust() {
    for (const d of this.dust) {
      this.scene.remove(d.mesh)
      d.mesh.geometry.dispose()
      d.mesh.material.dispose()
    }
    this.dust = []
  }

  private stepHerder(dt: number) {
    const pos = this.herder.group.position
    const input = this.readInputVector()
    const mag = Math.hypot(input.x, input.y)
    let power = 0
    let moveDx = 0
    let moveDz = 0

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
      moveDx = dx
      moveDz = dz
      const step = HERDER_SPEED * power * dt
      const next = moveHerder(pos.x + dx * step, pos.z + dz * step, this.level)
      pos.x = next.x
      pos.z = next.z
      if (!insideGrass(next.x, next.z)) {
        pos.y = groundHeight(this.level, pos.x, pos.z)
        this.beginFall(dx, dz)
        return
      }
      this.dustTimer -= dt
      if (this.dustTimer <= 0 && power > 0.35) {
        this.spawnDust(pos.x, groundHeight(this.level, pos.x, pos.z), pos.z, moveDx, moveDz)
        this.dustTimer = 0.16
      }
    }

    pos.y = groundHeight(this.level, pos.x, pos.z)
    playHerder(this.herder, dt, power, input.x)

    // Softly reveal subtle herding halo only when moving
    const targetRing = power > 0.1 ? 0.34 : 0.1
    const targetFill = power > 0.1 ? 0.08 : 0.02
    this.herdRange.ringMat.opacity += (targetRing - this.herdRange.ringMat.opacity) * Math.min(1, dt * 6)
    this.herdRange.fillMat.opacity += (targetFill - this.herdRange.fillMat.opacity) * Math.min(1, dt * 6)
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
    stepHerderFall(this.herder, ease)
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
    // Lush, full hero framing on both widescreen desktop (~75% height) and portrait mobile
    const minHalfW = 9.4
    const minHalfH = aspect >= 1 ? 9.5 : 10.6
    const halfH = Math.max(minHalfH, minHalfW / Math.max(0.42, aspect))
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
    resetHerder(this.herder)
    this.timePill?.classList.remove('urgent', 'pop')
    this.countPill?.classList.remove('pop')
    for (const s of this.sheep) resetSheep(s, this.level)
    this.baaWait = 2.4
    clearImpacts()
    this.clearDust()
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

    stepFeltClouds(this.clouds, t)
    stepTrees(this.trees, t)

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
        this.herdRange.group.position.set(hx, groundHeight(this.level, hx, hz), hz)
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
      this.stepDust(dt)
    }

    this.herdRange.group.visible = !this.over
    this.controls.update()
    orientHerderToCamera(this.herder, this.camera)
    this.renderer.render(this.scene, this.camera)
  }
}

function disposeGeometries(root: THREE.Object3D) {
  root.traverse((child) => {
    const mesh = child as THREE.Mesh
    mesh.geometry?.dispose()
  })
}

/** Fluffy floating wool-felt clouds framing the warm sunny diorama sky */
function createFeltClouds(): THREE.Group {
  const root = new THREE.Group()
  root.name = 'felt_clouds'
  const mat = felt(0xfffdf7, 0xf3ece0, 1, 0.025)
  const specs: { x: number; y: number; z: number; scale: number; phase: number }[] = [
    { x: -11.4, y: 1.6, z: -6.2, scale: 1.25, phase: 0.2 },
    { x: 10.6, y: 2.2, z: -7.2, scale: 1.18, phase: 1.6 },
    { x: -12.2, y: -1.8, z: 4.5, scale: 1.05, phase: 3.1 },
    { x: 11.2, y: -1.6, z: 3.6, scale: 1.08, phase: 4.4 },
  ]
  const puffs: [number, number, number, number][] = [
    [0, 0.15, 0, 0.82],
    [-0.75, 0.0, 0.12, 0.62],
    [0.78, -0.02, -0.08, 0.64],
    [0.24, 0.42, 0.16, 0.56],
    [-0.3, 0.36, -0.14, 0.5],
  ]
  for (const spec of specs) {
    const cloud = new THREE.Group()
    cloud.userData.baseX = spec.x
    cloud.userData.baseY = spec.y
    cloud.userData.phase = spec.phase
    for (const [px, py, pz, r] of puffs) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), mat)
      m.position.set(px, py, pz)
      m.scale.set(1.08, 0.82, 0.96)
      cloud.add(m)
    }
    cloud.scale.setScalar(spec.scale)
    cloud.position.set(spec.x, spec.y, spec.z)
    root.add(cloud)
  }
  return root
}

function stepFeltClouds(root: THREE.Group, t: number) {
  for (const c of root.children) {
    const baseX = Number(c.userData.baseX || 0)
    const baseY = Number(c.userData.baseY || 0)
    const phase = Number(c.userData.phase || 0)
    c.position.x = baseX + Math.sin(t * 0.22 + phase) * 0.85
    c.position.y = baseY + Math.cos(t * 0.36 + phase) * 0.22
  }
}

/** Whisper-subtle warm cream herding aura (replaces harsh green tower-defense circle) */
function createHerdRange(radius: number) {
  const group = new THREE.Group()
  const fillMat = new THREE.MeshBasicMaterial({
    color: 0xfff8e6,
    transparent: true,
    opacity: 0.03,
    depthWrite: false,
  })
  const fill = new THREE.Mesh(new THREE.CircleGeometry(radius, 64), fillMat)
  fill.rotation.x = -Math.PI / 2
  fill.position.y = 0.03
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xfffcf2,
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(Math.max(0.05, radius - 0.07), radius, 64),
    ringMat,
  )
  ring.rotation.x = -Math.PI / 2
  ring.position.y = 0.045
  group.add(fill, ring)
  return { group, fillMat, ringMat }
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}