import * as THREE from 'three'
import { create as createStick } from 'nipplejs'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { placeHerder } from './bounds'
import { ROUND_SECONDS, SHEEP_COUNT } from './constants'
import { buzz, playBaa, playPenned, popStar, unlockSound } from './feedback'
import { clearImpacts, spawnImpact, stepImpacts } from './impact'
import { createIsland } from './island'
import { groundHeight, herderHome, pushOutOfWater, sheepLayout, type LevelId } from './levels'
import { createCornerPens, kickPen, resetPens, stepPens, type PenRig } from './pen'
import { createHerder, resetHerder, stepHerder as playHerder, type HerderState } from './herder'
import { createSheep, resetSheep, SHEEP_FEAR, stepSheep, type SheepState } from './sheep'
import { createTrees } from './trees'

/** Default isometric frame, close to the reference still. */
/**
 * Three-quarter view from the south. The old diagonal camera turned the meadow
 * into a diamond, and on a portrait screen the left and right pens fell off the edge.
 * This angle keeps every pen floor inside the frame, with the near side still in view.
 */
const CAM_POS = new THREE.Vector3(3.2, 16.5, 16.5)
const LOOK = new THREE.Vector3(0, 0.15, 0)
const FRUSTUM = 46
const HERDER_SPEED = 3.7
const TOUCH = 1.25
const BUMP_COOLDOWN = 0.45
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
  private over = false
  private stickX = 0
  private stickY = 0
  private stick: ReturnType<typeof createStick> | null = null
  private timeEl: HTMLElement | null
  private countEl: HTMLElement | null
  private resultEl: HTMLElement | null
  private scoreEl: HTMLElement | null
  private starsEl: HTMLElement | null
  private levelEl: HTMLElement | null
  private nextEl: HTMLButtonElement | null
  private backEl: HTMLButtonElement | null

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.timeEl = document.getElementById('time')
    this.countEl = document.getElementById('count')
    this.resultEl = document.getElementById('result')
    this.scoreEl = document.getElementById('score')
    this.starsEl = document.getElementById('stars')
    this.levelEl = document.getElementById('level')
    this.nextEl = document.getElementById('next') as HTMLButtonElement | null
    this.backEl = document.getElementById('back') as HTMLButtonElement | null

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

    this.mountTerrain()
    this.pens = createCornerPens()
    this.scene.add(this.pens.root)
    this.spawnSheep()
    this.herder = createHerder()
    this.placeHerderHome()
    this.herder.group.scale.setScalar(HERDER_SCALE)
    this.scene.add(this.herder.group)
    this.herdRange = createHerdRange(SHEEP_FEAR)
    const [hx, hz] = herderHome(this.level)
    this.herdRange.position.set(hx, groundHeight(this.level, hx, hz), hz)
    this.scene.add(this.herdRange)

    this.bindStick()
    requestAnimationFrame(() => this.stick?.reposition())
    this.resize()
    this.updateHud()
    window.addEventListener('resize', () => this.resize())
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

  private stepHerder(dt: number) {
    const pos = this.herder.group.position
    const mag = Math.hypot(this.stickX, this.stickY)
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
      let dx = (rightX / rlen) * (this.stickX / mag) + (fwdX / flen) * (this.stickY / mag)
      let dz = (rightZ / rlen) * (this.stickX / mag) + (fwdZ / flen) * (this.stickY / mag)
      const dlen = Math.hypot(dx, dz) || 1
      dx /= dlen
      dz /= dlen
      const step = HERDER_SPEED * power * dt
      const next = placeHerder(pos.x + dx * step, pos.z + dz * step, this.level)
      pos.x = next.x
      pos.z = next.z
      this.herder.group.rotation.y = dampAngle(
        this.herder.group.rotation.y,
        Math.atan2(-dz, dx),
        dt,
      )
    }
    pos.y = groundHeight(this.level, pos.x, pos.z)
    playHerder(this.herder, dt, power)
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
    this.placeHerderHome()
    this.herder.group.rotation.y = 0
    resetHerder(this.herder)
    for (const s of this.sheep) resetSheep(s, this.level)
    this.baaWait = 2.4
    clearImpacts()
    resetPens(this.pens, this.level)
    if (this.resultEl) this.resultEl.hidden = true
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

  private finish() {
    this.over = true
    this.releaseStick()
    const n = this.pennedCount()
    if (this.scoreEl) this.scoreEl.textContent = `${n} / ${SHEEP_COUNT}`
    if (this.starsEl) this.starsEl.textContent = n === 0 ? '0 颗星' : `${'★'.repeat(n)}  ${n}`
    if (this.nextEl) this.nextEl.hidden = this.level !== 1
    if (this.backEl) this.backEl.hidden = this.level !== 2
    if (this.resultEl) this.resultEl.hidden = false
    this.updateHud()
  }

  private updateHud() {
    const sec = Math.max(0, Math.ceil(this.remaining - 1e-4))
    const m = Math.floor(sec / 60)
    const s = sec % 60
    if (this.timeEl) this.timeEl.textContent = `${m}:${s.toString().padStart(2, '0')}`
    if (this.countEl) this.countEl.textContent = `${this.pennedCount()} / ${SHEEP_COUNT}`
    if (this.levelEl) this.levelEl.textContent = `第 ${this.level} 关`
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

  tick() {
    const dt = Math.min(this.clock.getDelta(), 0.05)
    const t = this.clock.elapsedTime
    if (!this.over) {
      this.remaining = Math.max(0, this.remaining - dt)
      this.stepHerder(dt)
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
      if (this.remaining <= 0 || this.pennedCount() === SHEEP_COUNT) this.finish()
      else this.updateHud()
    }
    this.herdRange.visible = !this.over
    stepPens(this.pens, dt, this.level)
    stepImpacts(dt)
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

/** Light green ring for the distance at which sheep start running. */
function createHerdRange(radius: number) {
  const group = new THREE.Group()
  const fill = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 72),
    new THREE.MeshBasicMaterial({
      color: 0xd7f3b4,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
    }),
  )
  fill.rotation.x = -Math.PI / 2
  fill.position.y = 0.03
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(Math.max(0.05, radius - 0.08), radius, 72),
    new THREE.MeshBasicMaterial({
      color: 0xb6e07a,
      transparent: true,
      opacity: 0.95,
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