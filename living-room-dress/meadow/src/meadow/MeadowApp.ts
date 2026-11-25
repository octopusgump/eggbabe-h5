import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { moveHerder } from './bounds'
import { LEVEL_COUNT, ROUND_SECONDS, SHEEP_COUNT } from './constants'
import {
  buzz,
  playBaa,
  playBump,
  playDash,
  playPenned,
  playSheepSlide,
  playSkateStep,
  playStartWhistle,
  playTick,
  playWallBoing,
  popStar,
  stepBgm,
  stopScream,
  unlockSound,
  updateSkidSound,
} from './feedback'
import { clearImpacts, spawnImpact, stepImpacts } from './impact'
import { createIsland } from './island'
import { groundHeight, herderHome, LEVEL_META, pushOutOfWater, sheepLayout, type LevelId } from './levels'
import { felt } from './materials'
import { createCornerPens, kickPen, resetPens, stepPens, type PenRig } from './pen'
import {
  bounceInArena,
  createSkaterState,
  DEFAULT_SKATER_PARAMS,
  resolveElasticBump,
  stepSkaterVelocity,
  triggerSkaterDash,
  type SkaterState,
} from './physics'
import {
  createHerder,
  orientHerderToCamera,
  resetHerder,
  stepHerder as playHerder,
  type HerderState,
} from './herder'
import { createSheep, resetSheep, SHEEP_FEAR, stepSheep, type SheepState } from './sheep'
import { readHostContext, settleMeadowRound, type HostContext } from './storeBridge'
import {
  clearTrails,
  spawnIceSpray,
  spawnPenBurst,
  spawnSkidMark,
  spawnTwinSkidMarks,
  stepTrails,
} from './trails'
import { createTrees, stepTrees } from './trees'

const CAM_POS = new THREE.Vector3(3.6, 15.2, 16.4)
const LOOK = new THREE.Vector3(0, -0.1, 0.25)
const ARENA_HERDER_LIMIT = 7.12
const TOUCH = 1.28
const SHEEP_PAIR_DIST = 0.86
const BUMP_COOLDOWN = 0.24
const COMBO_WINDOW = 2.3
const STICK_MAX_OFFSET = 36

export class MeadowApp {
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.OrthographicCamera
  private controls: OrbitControls
  private sheep: SheepState[] = []
  private herder: HerderState
  private skater: SkaterState = createSkaterState()
  private herdRange: {
    group: THREE.Group
    fillMat: THREE.MeshBasicMaterial
    ringMat: THREE.MeshBasicMaterial
  }
  private clouds: THREE.Group
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

  // Scoring, combo & juice
  private penOccupancy = [0, 0, 0, 0]
  private bonusPoints = 0
  private comboCount = 0
  private comboTimer = 0
  private cameraShake = 0
  private skidMarkTimer = 0
  private skidSprayTimer = 0
  private sheepTrailTimer = 0

  // Unified pointer + keyboard visual joystick state
  private pointerStickX = 0
  private pointerStickY = 0
  private pointerActiveId: number | null = null
  private visualStickX = 0
  private visualStickY = 0
  private keys = new Set<string>()
  private lastInputWorldX = 0
  private lastInputWorldZ = 1

  // DOM refs
  private timeEl: HTMLElement | null
  private countEl: HTMLElement | null
  private levelEl: HTMLElement | null
  private petBadgeEl: HTMLElement | null
  private timePill: HTMLElement | null
  private countPill: HTMLElement | null
  private noticeEl: HTMLElement | null
  private stickEl: HTMLElement | null
  private stickKnobEl: HTMLElement | null
  private stickDirs: NodeListOf<HTMLElement>
  private dashBtnEl: HTMLButtonElement | null
  private dashRingEl: SVGCircleElement | null
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
    this.stickEl = document.getElementById('stick')
    this.stickKnobEl = document.getElementById('stick-knob')
    this.stickDirs = document.querySelectorAll<HTMLElement>('.stick-dir')
    this.dashBtnEl = document.getElementById('btn-dash') as HTMLButtonElement | null
    this.dashRingEl = document.getElementById('dash-ring-progress') as SVGCircleElement | null
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
    this.renderer.toneMappingExposure = 0.96
    this.renderer.setClearColor(0x000000, 0)

    this.scene = new THREE.Scene()
    const pmrem = new THREE.PMREMGenerator(this.renderer)
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    this.scene.environment = envTex
    this.scene.environmentIntensity = 0.3
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

    const hemi = new THREE.HemisphereLight(0xfffaf0, 0x9ec0c7, 0.68)
    this.scene.add(hemi)

    const sun = new THREE.DirectionalLight(0xffedc6, 1.26)
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

    const rim = new THREE.DirectionalLight(0xe5f5fa, 0.32)
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
    this.bindUnifiedStick()
    this.bindDashButton()
    this.bindKeyboard()
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
      // Sheep #0 is the Golden Crown Lead Sheep (+3 bonus, Penguin Pushers golden penguin nod!)
      const isGolden = i === 0
      const state = createSheep(isGolden)
      state.homeX = x
      state.homeZ = z
      state.group.position.set(x, groundHeight(this.level, x, z), z)
      if (state.velocity.lengthSq() > 0.0001) {
        state.group.rotation.y = Math.atan2(-state.velocity.y, state.velocity.x)
      } else {
        state.group.rotation.y = Math.random() * Math.PI * 2
      }
      state.group.scale.setScalar(isGolden ? 1.24 : 1.16)
      this.sheep.push(state)
      this.scene.add(state.group)
    }
  }

  /** Unified pointer + keyboard visual joystick so desktop Arrow/WASD physically moves the knob */
  private bindUnifiedStick() {
    const zone = this.stickEl
    if (!zone) return

    const updateFromClient = (clientX: number, clientY: number) => {
      const rect = zone.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const dx = clientX - cx
      const dy = -(clientY - cy) // +Y is up
      const dist = Math.hypot(dx, dy)
      const maxR = Math.max(24, rect.width * 0.34)
      const mag = Math.min(1, dist / maxR)
      if (dist > 2) {
        this.pointerStickX = (dx / dist) * mag
        this.pointerStickY = (dy / dist) * mag
      } else {
        this.pointerStickX = 0
        this.pointerStickY = 0
      }
      if (!this.started && !this.over && !this.paused && mag >= 0.14) {
        this.beginRound()
      }
    }

    zone.addEventListener('pointerdown', (e) => {
      if (this.over || this.paused) return
      e.stopPropagation()
      unlockSound()
      this.pointerActiveId = e.pointerId
      zone.setPointerCapture?.(e.pointerId)
      updateFromClient(e.clientX, e.clientY)
    })

    zone.addEventListener('pointermove', (e) => {
      if (this.pointerActiveId !== e.pointerId) return
      if (this.over || this.paused) return
      e.stopPropagation()
      updateFromClient(e.clientX, e.clientY)
    })

    const endPointer = (e: PointerEvent) => {
      if (this.pointerActiveId !== e.pointerId) return
      this.pointerActiveId = null
      this.pointerStickX = 0
      this.pointerStickY = 0
    }
    zone.addEventListener('pointerup', endPointer)
    zone.addEventListener('pointercancel', endPointer)
  }

  private bindDashButton() {
    if (!this.dashBtnEl) return
    this.dashBtnEl.addEventListener('pointerdown', (e) => {
      e.stopPropagation()
      unlockSound()
      this.performDash()
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
      if (e.code === 'Space' && !this.over && !this.paused) {
        e.preventDefault()
        unlockSound()
        this.performDash()
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

  private performDash() {
    if (this.over || this.paused) return
    if (!this.started) this.beginRound()
    const input = this.readInputVector()
    const world = this.screenInputToWorld(input.x, input.y)
    const dirX = Math.hypot(world.x, world.z) > 0.15 ? world.x : this.lastInputWorldX
    const dirZ = Math.hypot(world.x, world.z) > 0.15 ? world.z : this.lastInputWorldZ
    const ok = triggerSkaterDash(this.skater, dirX, dirZ, DEFAULT_SKATER_PARAMS)
    if (!ok) return
    playDash()
    buzz(14)
    const pos = this.herder.group.position
    spawnIceSpray(this.scene, pos.x, pos.y, pos.z, -dirX, -dirZ, 0.9, 6, 0xfff8e2)
    this.dashBtnEl?.classList.remove('is-triggered')
    void this.dashBtnEl?.offsetWidth
    this.dashBtnEl?.classList.add('is-triggered')
  }

  private readInputVector(): { x: number; y: number; fromKeyboard: boolean } {
    let x = this.pointerStickX
    let y = this.pointerStickY
    let fromKeyboard = false
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
        fromKeyboard = true
      }
    }
    return { x, y, fromKeyboard }
  }

  private screenInputToWorld(ix: number, iy: number): { x: number; z: number } {
    const mag = Math.hypot(ix, iy)
    if (mag < 0.05) return { x: 0, z: 0 }
    const e = this.camera.matrixWorld.elements
    const rightX = e[0]
    const rightZ = e[2]
    const fwdX = -e[8]
    const fwdZ = -e[10]
    const rlen = Math.hypot(rightX, rightZ) || 1
    const flen = Math.hypot(fwdX, fwdZ) || 1
    const wx = (rightX / rlen) * ix + (fwdX / flen) * iy
    const wz = (rightZ / rlen) * ix + (fwdZ / flen) * iy
    const wlen = Math.hypot(wx, wz) || 1
    return { x: (wx / wlen) * Math.min(1, mag), z: (wz / wlen) * Math.min(1, mag) }
  }

  /** Animates the visible joystick knob & directional pips in sync with BOTH touch and keyboard Arrow/WASD */
  private updateVisualStick(dt: number, inputX: number, inputY: number, skidding: boolean) {
    const ease = Math.min(1, dt * 18)
    this.visualStickX += (inputX - this.visualStickX) * ease
    this.visualStickY += (inputY - this.visualStickY) * ease

    if (this.stickKnobEl) {
      const tx = this.visualStickX * STICK_MAX_OFFSET
      const ty = -this.visualStickY * STICK_MAX_OFFSET
      this.stickKnobEl.style.transform = `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0)`
    }
    const active = Math.hypot(inputX, inputY) > 0.12
    this.stickEl?.classList.toggle('is-active', active)
    this.stickEl?.classList.toggle('is-skidding', skidding)

    this.stickDirs.forEach((el) => {
      const dir = el.dataset.dir
      let lit = false
      if (dir === 'up') lit = inputY > 0.35
      else if (dir === 'down') lit = inputY < -0.35
      else if (dir === 'left') lit = inputX < -0.35
      else if (dir === 'right') lit = inputX > 0.35
      el.classList.toggle('is-lit', lit)
    })

    // Update Dash button cooldown visual ring
    if (this.dashBtnEl) {
      const ready = this.skater.dashCooldown <= 0
      this.dashBtnEl.classList.toggle('is-cooling', !ready)
      if (this.dashRingEl) {
        const circum = 150.8
        const ratio = Math.max(0, Math.min(1, 1 - this.skater.dashCooldown / DEFAULT_SKATER_PARAMS.dashCooldown))
        this.dashRingEl.style.strokeDashoffset = (circum * (1 - ratio)).toFixed(1)
      }
    }
  }

  private releaseStick() {
    this.pointerActiveId = null
    this.pointerStickX = 0
    this.pointerStickY = 0
  }

  private beginRound() {
    if (this.started) return
    this.started = true
    playStartWhistle()
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
      updateSkidSound(0)
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

  private stepHerder(dt: number, t: number) {
    const pos = this.herder.group.position
    const input = this.readInputVector()
    const worldIn = this.screenInputToWorld(input.x, input.y)
    if (Math.hypot(worldIn.x, worldIn.z) > 0.12) {
      this.lastInputWorldX = worldIn.x
      this.lastInputWorldZ = worldIn.z
    }

    const res = stepSkaterVelocity(this.skater, worldIn.x, worldIn.z, dt, DEFAULT_SKATER_PARAMS)
    this.updateVisualStick(dt, input.x, input.y, res.skidding)

    // Integrate position with soft bouncy snow-oak perimeter walls + fence/water stops
    const rawX = pos.x + this.skater.vx * dt
    const rawZ = pos.z + this.skater.vz * dt
    const bounded = bounceInArena(rawX, rawZ, this.skater.vx, this.skater.vz, ARENA_HERDER_LIMIT, 0.48)
    this.skater.vx = bounded.vx
    this.skater.vz = bounded.vz
    if (bounded.bounced && res.speed > 2.2) {
      playWallBoing()
      spawnIceSpray(this.scene, bounded.x, pos.y, bounded.z, bounded.nx, bounded.nz, 0.5, 3)
      this.cameraShake = Math.max(this.cameraShake, 0.08)
    }

    const next = moveHerder(bounded.x, bounded.z, this.level)
    pos.x = next.x
    pos.z = next.z
    pos.y = groundHeight(this.level, pos.x, pos.z)

    // Project skater velocity onto camera screen X for natural L/R facing & skid lean direction
    const e = this.camera.matrixWorld.elements
    const rightX = e[0]
    const rightZ = e[2]
    const rlen = Math.hypot(rightX, rightZ) || 1
    const screenVelX = (this.skater.vx * rightX + this.skater.vz * rightZ) / rlen

    const speedRatio = Math.min(1, res.speed / DEFAULT_SKATER_PARAMS.maxSpeed)
    playHerder(this.herder, dt, {
      speedRatio,
      screenVelX,
      skidIntensity: res.skidIntensity,
      dashing: res.dashing,
      time: t,
    })

    // Mario-style high-friction ice braking audio + twin frost tracks + ice-crystal spray!
    updateSkidSound(res.skidIntensity)
    if (res.skidIntensity > 0.12) {
      this.skidMarkTimer -= dt
      if (this.skidMarkTimer <= 0) {
        spawnTwinSkidMarks(this.scene, pos.x, pos.y, pos.z, res.skidDirX, res.skidDirZ, res.skidIntensity)
        this.skidMarkTimer = 0.045
      }
      this.skidSprayTimer -= dt
      if (this.skidSprayTimer <= 0) {
        spawnIceSpray(
          this.scene,
          pos.x,
          pos.y,
          pos.z,
          res.skidDirX,
          res.skidDirZ,
          res.skidIntensity,
          res.skidIntensity > 0.6 ? 4 : 2,
        )
        this.skidSprayTimer = 0.06
      }
    } else if (res.speed > 1.8) {
      if (Math.hypot(input.x, input.y) > 0.25 && !res.dashing) {
        playSkateStep(speedRatio)
      }
      this.skidMarkTimer -= dt
      if (this.skidMarkTimer <= 0) {
        const ang = Math.atan2(-this.skater.vz, this.skater.vx)
        spawnSkidMark(this.scene, pos.x, pos.y, pos.z, ang, 0.26, 0.055, false)
        this.skidMarkTimer = res.dashing ? 0.04 : 0.12
      }
    }

    // Subtle frosted herding aura
    const targetRing = res.skidding ? 0.38 : res.speed > 0.6 ? 0.24 : 0.08
    const targetFill = res.skidding ? 0.09 : res.speed > 0.6 ? 0.05 : 0.015
    this.herdRange.ringMat.opacity += (targetRing - this.herdRange.ringMat.opacity) * Math.min(1, dt * 7)
    this.herdRange.fillMat.opacity += (targetFill - this.herdRange.fillMat.opacity) * Math.min(1, dt * 7)
  }

  /** Elastic Herder->Sheep shove that transfers skating momentum into Penguin belly-slides! */
  private collideHerderWithSheep(s: SheepState, hx: number, hz: number) {
    if (s.mode === 'penned' || s.bumpCooldown > 0) return
    const dashing = this.skater.dashTimer > 0
    const extraPush = dashing ? 4.4 : 2.35
    const hit = resolveElasticBump(
      hx,
      hz,
      this.skater.vx,
      this.skater.vz,
      s.group.position.x,
      s.group.position.z,
      s.velocity.x,
      s.velocity.y,
      TOUCH,
      2.6,
      1.0,
      0.92,
      extraPush,
    )
    if (!hit.collided) return

    const clamped = pushOutOfWater(
      this.level,
      clamp(hit.bPos.x, -7.0, 7.0),
      clamp(hit.bPos.z, -7.0, 7.0),
      0.26,
    )
    s.group.position.x = clamp(clamped.x, -7.0, 7.0)
    s.group.position.z = clamp(clamped.z, -7.0, 7.0)
    s.group.position.y = groundHeight(this.level, s.group.position.x, s.group.position.z)

    // Cap sheep launch speed so slides feel juicy & controllable
    const launchSpd = Math.hypot(hit.bVel.x, hit.bVel.z)
    const maxLaunch = dashing ? 8.6 : 6.4
    const scale = launchSpd > maxLaunch ? maxLaunch / launchSpd : 1
    s.velocity.set(hit.bVel.x * scale, hit.bVel.z * scale)
    s.slideCarry = dashing ? 1.15 : 0.82
    s.mode = 'flee'
    s.fleeCarry = 1.2
    s.bumpCooldown = BUMP_COOLDOWN

    // Slight recoil on herder feels weighty & crisp
    this.skater.vx = hit.aVel.x
    this.skater.vz = hit.aVel.z

    spawnImpact(this.scene, (s.group.position.x + hx) / 2, (s.group.position.z + hz) / 2, hit.nx, hit.nz, dashing ? 1.05 : 0.82)
    spawnIceSpray(this.scene, s.group.position.x, s.group.position.y, s.group.position.z, hit.nx, hit.nz, 0.75, 4)
    playBump(hit.impactSpeed / 4.2, false)
    playSheepSlide()
    if (dashing || hit.impactSpeed > 3.2) {
      this.cameraShake = Math.max(this.cameraShake, dashing ? 0.16 : 0.09)
      buzz(dashing ? 22 : 12)
    }
  }

  /** Sheep-on-Sheep elastic bowling chain reaction! */
  private resolveSheepChainCollisions() {
    for (let i = 0; i < this.sheep.length; i++) {
      const a = this.sheep[i]
      if (a.mode === 'penned') continue
      for (let j = i + 1; j < this.sheep.length; j++) {
        const b = this.sheep[j]
        if (b.mode === 'penned') continue
        const hit = resolveElasticBump(
          a.group.position.x,
          a.group.position.z,
          a.velocity.x,
          a.velocity.y,
          b.group.position.x,
          b.group.position.z,
          b.velocity.x,
          b.velocity.y,
          SHEEP_PAIR_DIST,
          1.0,
          1.0,
          0.86,
          0,
        )
        if (!hit.collided) continue

        a.group.position.x = clamp(hit.aPos.x, -7.0, 7.0)
        a.group.position.z = clamp(hit.aPos.z, -7.0, 7.0)
        b.group.position.x = clamp(hit.bPos.x, -7.0, 7.0)
        b.group.position.z = clamp(hit.bPos.z, -7.0, 7.0)
        a.velocity.set(hit.aVel.x, hit.aVel.z)
        b.velocity.set(hit.bVel.x, hit.bVel.z)

        if (hit.impactSpeed > 1.3) {
          a.slideCarry = Math.max(a.slideCarry, 0.65)
          b.slideCarry = Math.max(b.slideCarry, 0.72)
          playBump(hit.impactSpeed / 3.8, true)
          spawnImpact(
            this.scene,
            (a.group.position.x + b.group.position.x) / 2,
            (a.group.position.z + b.group.position.z) / 2,
            hit.nx,
            hit.nz,
            0.65,
          )
        }
      }
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
  }

  restart() {
    stopScream()
    updateSkidSound(0)
    this.skater = createSkaterState()
    this.remaining = ROUND_SECONDS
    this.shownSecond = ROUND_SECONDS
    this.started = false
    this.paused = false
    this.over = false
    this.penOccupancy = [0, 0, 0, 0]
    this.bonusPoints = 0
    this.comboCount = 0
    this.comboTimer = 0
    this.cameraShake = 0
    this.releaseStick()
    this.keys.clear()
    this.placeHerderHome()
    resetHerder(this.herder)
    this.timePill?.classList.remove('urgent', 'pop')
    this.countPill?.classList.remove('pop')
    for (const s of this.sheep) resetSheep(s, this.level)
    this.baaWait = 2.4
    clearImpacts()
    clearTrails()
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

  private pennedCount() {
    return this.sheep.filter((s) => s.mode === 'penned').length
  }

  private finish() {
    this.over = true
    this.paused = false
    updateSkidSound(0)
    this.releaseStick()
    this.keys.clear()
    const n = this.pennedCount()
    const totalScore = n + this.bonusPoints
    const meta = LEVEL_META[this.level]
    const settled = settleMeadowRound({
      level: this.level,
      penned: Math.min(SHEEP_COUNT, totalScore),
      total: SHEEP_COUNT,
      reason: 'round',
    })
    this.hostCtx.starBalance = settled.starBalance
    this.paintHostMeta()

    const tierStars = n >= SHEEP_COUNT ? 3 : totalScore >= 8 ? 2 : totalScore >= 3 ? 1 : 0
    if (this.resultTagEl) {
      this.resultTagEl.textContent = `第 ${this.level} 关 · ${meta.name}`
    }
    if (this.scoreEl) {
      this.scoreEl.textContent =
        this.bonusPoints > 0
          ? `${n} / ${SHEEP_COUNT} 只进圈（金绒 +${this.bonusPoints}）`
          : `${n} / ${SHEEP_COUNT} 只进圈`
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
      if (this.comboTimer > 0) {
        this.comboTimer = Math.max(0, this.comboTimer - dt)
        if (this.comboTimer === 0) this.comboCount = 0
      }

      if (!this.over) {
        if (this.started) {
          this.remaining = Math.max(0, this.remaining - dt)
          stepBgm(dt, true, this.remaining <= 5)
        }
        this.stepHerder(dt, t)
      }

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
        this.sheepTrailTimer -= dt
        const emitSheepTrail = this.sheepTrailTimer <= 0
        if (emitSheepTrail) this.sheepTrailTimer = 0.085

        for (const s of this.sheep) {
          const calm = s.mode !== 'flee' && s.mode !== 'penned'
          const event = stepSheep(s, dt, t, hx, hz, flock, this.level, (penIdx) => {
            const cur = this.penOccupancy[penIdx] || 0
            this.penOccupancy[penIdx] = cur + 1
            return cur
          })
          if (calm && s.mode === 'flee') startled = true

          if (s.sliding && emitSheepTrail) {
            const ang = Math.atan2(-s.velocity.y, s.velocity.x)
            spawnSkidMark(
              this.scene,
              s.group.position.x,
              groundHeight(this.level, s.group.position.x, s.group.position.z),
              s.group.position.z,
              ang,
              0.3,
              0.14,
              false,
            )
          }

          if (event?.kind === 'slideStart') {
            playSheepSlide()
            spawnIceSpray(
              this.scene,
              event.x,
              groundHeight(this.level, event.x, event.z),
              event.z,
              -s.velocity.x,
              -s.velocity.y,
              0.4,
              2,
            )
          } else if (event?.kind === 'fence') {
            spawnImpact(this.scene, event.x, event.z, event.nx, event.nz, 0.7)
            playWallBoing()
          } else if (event?.kind === 'penned') {
            this.comboCount++
            this.comboTimer = COMBO_WINDOW
            if (event.isGolden) this.bonusPoints += 2 // 1 + 2 = 3 pts total

            spawnImpact(this.scene, event.x, event.z, event.nx, event.nz, 0.9)
            spawnPenBurst(
              this.scene,
              event.x,
              groundHeight(this.level, event.x, event.z),
              event.z,
              event.isGolden,
            )
            kickPen(this.pens, event.penIndex)
            const last = this.pennedCount() === SHEEP_COUNT
            if (event.isGolden) {
              popStar('👑 金绒羊 +3', 'gold')
            } else if (this.comboCount >= 2) {
              popStar(`✦ ×${this.comboCount} 连击!`, 'combo')
            } else {
              popStar('✦ +1', 'normal')
            }
            this.pulse(this.countPill)
            playPenned(this.comboCount, event.isGolden, last)
            this.cameraShake = Math.max(this.cameraShake, event.isGolden ? 0.18 : 0.1)
            buzz(last ? [16, 30, 28] : event.isGolden ? [16, 20, 24] : 16)
          }

          this.collideHerderWithSheep(s, hx, hz)
        }

        this.resolveSheepChainCollisions()

        if (startled) {
          playBaa('scare')
          this.baaWait = Math.max(this.baaWait, 1.5)
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
      stepTrails(dt)
    }

    // Subtle joyous micro camera shake on impacts & combos
    if (this.cameraShake > 0.002) {
      this.cameraShake = Math.max(0, this.cameraShake - dt * 1.1)
      this.controls.target.set(
        LOOK.x + (Math.random() - 0.5) * this.cameraShake,
        LOOK.y + (Math.random() - 0.5) * this.cameraShake * 0.5,
        LOOK.z + (Math.random() - 0.5) * this.cameraShake,
      )
    } else {
      this.controls.target.copy(LOOK)
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

function createHerdRange(radius: number) {
  const group = new THREE.Group()
  const fillMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.02,
    depthWrite: false,
  })
  const fill = new THREE.Mesh(new THREE.CircleGeometry(radius, 64), fillMat)
  fill.rotation.x = -Math.PI / 2
  fill.position.y = 0.029
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xfffcf2,
    transparent: true,
    opacity: 0.1,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(Math.max(0.05, radius - 0.07), radius, 64),
    ringMat,
  )
  ring.rotation.x = -Math.PI / 2
  ring.position.y = 0.042
  group.add(fill, ring)
  return { group, fillMat, ringMat }
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}