import * as THREE from 'three'
import { create as createStick } from 'nipplejs'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { placeRabbit } from './bounds'
import { ROUND_SECONDS, SHEEP_COUNT } from './constants'
import { buzz, playPenned, popStar, unlockSound } from './feedback'
import { clearImpacts, spawnImpact, stepImpacts } from './impact'
import { createIsland } from './island'
import { createCornerPens, kickPen, resetPens, stepPens, type PenRig } from './pen'
import { createRabbit, swayEars, type RabbitState } from './rabbit'
import { createSheep, resetSheep, stepSheep, type SheepState } from './sheep'
import { createTrees } from './trees'

/** Default isometric frame, close to the reference still. */
const CAM_POS = new THREE.Vector3(11.2, 13.4, 11.2)
const LOOK = new THREE.Vector3(0, 0.15, 0)
/** Vertical span. Portrait stage is narrow, so this is sized to fit the whole island. */
const FRUSTUM = 28
const RABBIT_SPEED = 3
const RABBIT_HOME = new THREE.Vector3(0, 0, -4.4)
const TOUCH = 1.25
const BUMP_COOLDOWN = 0.45
const RABBIT_SCALE = 2.05

const LAYOUT: [number, number][] = [
  [-3.4, 2.2],
  [-1.6, 1.1],
  [0.2, 1.8],
  [1.8, 0.4],
  [-0.5, -0.4],
  [0.9, -1.5],
  [3.0, -2.0],
  [-2.8, -1.3],
  [-1.1, -2.5],
  [2.4, 2.3],
  [3.6, 0.2],
]

export class MeadowApp {
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.OrthographicCamera
  private controls: OrbitControls
  private sheep: SheepState[] = []
  private rabbit: RabbitState
  private pens: PenRig
  private clock = new THREE.Clock()
  private canvas: HTMLCanvasElement
  private readonly homePolar: number
  private readonly homeAzimuth: number
  private remaining = ROUND_SECONDS
  private over = false
  private stickX = 0
  private stickY = 0
  private stick: ReturnType<typeof createStick> | null = null
  private timeEl: HTMLElement | null
  private countEl: HTMLElement | null
  private resultEl: HTMLElement | null
  private scoreEl: HTMLElement | null
  private starsEl: HTMLElement | null

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.timeEl = document.getElementById('time')
    this.countEl = document.getElementById('count')
    this.resultEl = document.getElementById('result')
    this.scoreEl = document.getElementById('score')
    this.starsEl = document.getElementById('stars')

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
    this.scene.background = new THREE.Color(0xe7ebe6)

    const aspect = 390 / 844
    this.camera = new THREE.OrthographicCamera(
      (-FRUSTUM * aspect) / 2,
      (FRUSTUM * aspect) / 2,
      FRUSTUM / 2,
      -FRUSTUM / 2,
      0.1,
      80,
    )
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
    this.controls.minZoom = 0.72
    this.controls.maxZoom = 1.85
    this.controls.minAzimuthAngle = this.homeAzimuth - 0.18
    this.controls.maxAzimuthAngle = this.homeAzimuth + 0.18
    this.controls.minPolarAngle = this.homePolar - 0.08
    this.controls.maxPolarAngle = this.homePolar + 0.32
    this.controls.update()

    const hemi = new THREE.HemisphereLight(0xffffff, 0xc8ee90, 0.95)
    this.scene.add(hemi)

    const sun = new THREE.DirectionalLight(0xfffaf0, 1.25)
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

    this.scene.add(createIsland())
    this.pens = createCornerPens()
    this.scene.add(this.pens.root)
    this.scene.add(createTrees())
    this.spawnSheep()
    this.rabbit = createRabbit()
    this.rabbit.group.position.copy(RABBIT_HOME)
    this.rabbit.group.scale.setScalar(RABBIT_SCALE)
    this.scene.add(this.rabbit.group)

    this.bindStick()
    requestAnimationFrame(() => this.stick?.reposition())
    this.resize()
    this.updateHud()
    window.addEventListener('resize', () => this.resize())
  }

  private spawnSheep() {
    for (let i = 0; i < SHEEP_COUNT; i++) {
      const [x, z] = LAYOUT[i]
      const state = createSheep()
      state.homeX = x
      state.homeZ = z
      state.group.position.set(x, 0, z)
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
      size: 132,
      threshold: 0.12,
      restOpacity: 0.9,
      color: {
        front: 'rgba(255,255,255,0.96)',
        back: 'rgba(255,255,255,0.34)',
      },
    })
    this.stick = manager
    zone.addEventListener('pointerdown', () => unlockSound())
    manager.on('move', (evt) => {
      if (this.over) return
      this.stickX = evt.data.vector.x
      this.stickY = evt.data.vector.y
    })
    manager.on('end', () => {
      this.stickX = 0
      this.stickY = 0
    })
  }

  private releaseStick() {
    this.stickX = 0
    this.stickY = 0
  }

  private stepRabbit(dt: number) {
    const pos = this.rabbit.group.position
    const mag = Math.hypot(this.stickX, this.stickY)
    if (mag < 0.15) {
      pos.y = 0
      return
    }
    const e = this.camera.matrixWorld.elements
    const rightX = e[0]
    const rightZ = e[2]
    const fwdX = -e[8]
    const fwdZ = -e[10]
    const rlen = Math.hypot(rightX, rightZ) || 1
    const flen = Math.hypot(fwdX, fwdZ) || 1
    const power = Math.min(1, (mag - 0.15) / 0.85)
    let dx = (rightX / rlen) * (this.stickX / mag) + (fwdX / flen) * (this.stickY / mag)
    let dz = (rightZ / rlen) * (this.stickX / mag) + (fwdZ / flen) * (this.stickY / mag)
    const dlen = Math.hypot(dx, dz) || 1
    dx /= dlen
    dz /= dlen
    const step = RABBIT_SPEED * power * dt
    const next = placeRabbit(pos.x + dx * step, pos.z + dz * step)
    pos.x = next.x
    pos.z = next.z
    this.rabbit.group.rotation.y = dampAngle(
      this.rabbit.group.rotation.y,
      Math.atan2(-dz, dx),
      dt,
    )
    pos.y = Math.abs(Math.sin(this.clock.elapsedTime * 10)) * 0.04
  }

  resize() {
    const w = this.canvas.clientWidth
    const h = this.canvas.clientHeight
    if (w === 0 || h === 0) return
    this.renderer.setSize(w, h, false)
    const aspect = w / h
    const zoom = this.camera.zoom
    this.camera.left = (-FRUSTUM * aspect) / 2
    this.camera.right = (FRUSTUM * aspect) / 2
    this.camera.top = FRUSTUM / 2
    this.camera.bottom = -FRUSTUM / 2
    this.camera.zoom = zoom
    this.camera.updateProjectionMatrix()
    requestAnimationFrame(() => this.stick?.reposition())
  }

  restart() {
    this.remaining = ROUND_SECONDS
    this.over = false
    this.releaseStick()
    this.rabbit.group.position.copy(RABBIT_HOME)
    this.rabbit.group.rotation.y = 0
    for (const s of this.sheep) resetSheep(s)
    clearImpacts()
    resetPens(this.pens)
    if (this.resultEl) this.resultEl.hidden = true
    this.updateHud()
  }

  private bumpRabbit(s: SheepState, rx: number, rz: number) {
    if (s.mode === 'penned' || s.bumpCooldown > 0) return
    const dx = s.group.position.x - rx
    const dz = s.group.position.z - rz
    const dist = Math.hypot(dx, dz)
    if (dist >= TOUCH || dist < 0.001) return
    spawnImpact(this.scene, (s.group.position.x + rx) / 2, (s.group.position.z + rz) / 2, dx, dz, 0.9)
    const push = TOUCH - dist + 0.05
    s.group.position.x = clamp(s.group.position.x + (dx / dist) * push, -6.9, 6.9)
    s.group.position.z = clamp(s.group.position.z + (dz / dist) * push, -6.9, 6.9)
    s.bumpCooldown = BUMP_COOLDOWN
  }

  private pennedCount() {
    return this.sheep.filter((s) => s.mode === 'penned').length
  }

  private finish() {
    this.over = true
    this.releaseStick()
    const n = this.pennedCount()
    if (this.scoreEl) this.scoreEl.textContent = `${n} / ${SHEEP_COUNT}`
    if (this.starsEl) this.starsEl.textContent = n === 0 ? '0 颗星' : `${'★'.repeat(n)}  ${n}`
    if (this.resultEl) this.resultEl.hidden = false
    this.updateHud()
  }

  private updateHud() {
    const sec = Math.max(0, Math.ceil(this.remaining - 1e-4))
    const m = Math.floor(sec / 60)
    const s = sec % 60
    if (this.timeEl) this.timeEl.textContent = `${m}:${s.toString().padStart(2, '0')}`
    if (this.countEl) this.countEl.textContent = `${this.pennedCount()} / ${SHEEP_COUNT}`
  }

  tick() {
    const dt = Math.min(this.clock.getDelta(), 0.05)
    const t = this.clock.elapsedTime
    if (!this.over) {
      this.remaining = Math.max(0, this.remaining - dt)
      swayEars(this.rabbit, t)
      this.stepRabbit(dt)
      const rx = this.rabbit.group.position.x
      const rz = this.rabbit.group.position.z
      for (const s of this.sheep) {
        const event = stepSheep(s, dt, t, rx, rz)
        if (event?.kind === 'fence') {
          spawnImpact(this.scene, event.x, event.z, event.nx, event.nz, 0.7)
        } else if (event?.kind === 'penned') {
          spawnImpact(this.scene, event.x, event.z, event.nx, event.nz, 0.8)
          kickPen(this.pens, event.penIndex)
          const last = this.pennedCount() === SHEEP_COUNT
          popStar()
          playPenned(last)
          buzz(last ? [16, 30, 28] : 18)
        }
        this.bumpRabbit(s, rx, rz)
      }
      if (this.remaining <= 0 || this.pennedCount() === SHEEP_COUNT) this.finish()
      else this.updateHud()
    }
    stepPens(this.pens, dt)
    stepImpacts(dt)
    this.controls.update()
    this.renderer.render(this.scene, this.camera)
  }
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