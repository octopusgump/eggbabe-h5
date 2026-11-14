import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { ISLAND_HALF, PEN_SIZE, SHEEP_COUNT } from './constants'
import { createIsland } from './island'
import { createPen } from './pen'
import { createSheep, type SheepState } from './sheep'
import { createTrees } from './trees'

type SavedPose = { x: number; z: number }

export class MeadowApp {
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private controls: OrbitControls
  private sheep: SheepState[] = []
  private initialPoses: SavedPose[] = []
  private raycaster = new THREE.Raycaster()
  private pointer = new THREE.Vector2()
  private dragSheep: SheepState | null = null
  private dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  private dragOffset = new THREE.Vector3()
  private live = true
  private paused = false
  private clock = new THREE.Clock()
  private canvas: HTMLCanvasElement

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    })
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap

    this.scene = new THREE.Scene()
    this.scene.background = null
    this.scene.fog = new THREE.Fog(0xd4e4d0, 18, 32)

    this.camera = new THREE.PerspectiveCamera(42, 390 / 844, 0.1, 100)
    this.camera.position.set(9, 8.5, 9)
    this.camera.lookAt(0, 0, 0)

    this.controls = new OrbitControls(this.camera, canvas)
    this.controls.enablePan = false
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.06
    this.controls.minDistance = 7
    this.controls.maxDistance = 18
    this.controls.maxPolarAngle = Math.PI / 2.35
    this.controls.minPolarAngle = Math.PI / 6
    this.controls.target.set(0, 0.2, 0)

    const hemi = new THREE.HemisphereLight(0xe8f4ff, 0x6a8f4a, 0.9)
    this.scene.add(hemi)
    const sun = new THREE.DirectionalLight(0xfff5e6, 1.05)
    sun.position.set(-6, 12, 4)
    sun.castShadow = true
    sun.shadow.mapSize.set(1024, 1024)
    sun.shadow.camera.near = 1
    sun.shadow.camera.far = 28
    sun.shadow.camera.left = -12
    sun.shadow.camera.right = 12
    sun.shadow.camera.top = 12
    sun.shadow.camera.bottom = -12
    this.scene.add(sun)

    this.scene.add(createIsland())
    this.scene.add(createTrees())
    this.scene.add(createPen())

    this.spawnSheep()
    this.bindPointer()
    this.resize()
    window.addEventListener('resize', () => this.resize())
  }

  private spawnSheep() {
    const penHalf = PEN_SIZE / 2 + 0.8
    for (let i = 0; i < SHEEP_COUNT; i++) {
      const state = createSheep()
      let x = 0
      let z = 0
      for (let attempt = 0; attempt < 40; attempt++) {
        x = (Math.random() - 0.5) * ISLAND_HALF * 1.5
        z = (Math.random() - 0.5) * ISLAND_HALF * 1.5
        if (Math.abs(x) < penHalf && Math.abs(z) < penHalf) continue
        if (Math.abs(x) > ISLAND_HALF * 0.92 || Math.abs(z) > ISLAND_HALF * 0.92)
          continue
        break
      }
      state.group.position.set(x, 0, z)
      state.group.rotation.y = Math.random() * Math.PI * 2
      this.sheep.push(state)
      this.initialPoses.push({ x, z })
      this.scene.add(state.group)
    }
  }

  private bindPointer() {
    const el = this.canvas
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      this.setPointer(e)
      const hit = this.pickSheep()
      if (hit) {
        this.dragSheep = hit
        this.controls.enabled = false
        const pt = new THREE.Vector3()
        this.raycaster.ray.intersectPlane(this.dragPlane, pt)
        this.dragOffset.copy(hit.group.position).sub(pt)
        el.setPointerCapture(e.pointerId)
        e.preventDefault()
      }
    }
    const onMove = (e: PointerEvent) => {
      if (!this.dragSheep) return
      this.setPointer(e)
      const pt = new THREE.Vector3()
      if (!this.raycaster.ray.intersectPlane(this.dragPlane, pt)) return
      pt.add(this.dragOffset)
      pt.x = clamp(pt.x, -ISLAND_HALF + 1, ISLAND_HALF - 1)
      pt.z = clamp(pt.z, -ISLAND_HALF + 1, ISLAND_HALF - 1)
      this.dragSheep.group.position.x = pt.x
      this.dragSheep.group.position.z = pt.z
      this.dragSheep.velocity.set(0, 0)
    }
    const onUp = () => {
      if (this.dragSheep) {
        this.dragSheep = null
        this.controls.enabled = true
      }
    }
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
    el.addEventListener(
      'wheel',
      (e) => e.preventDefault(),
      { passive: false },
    )
  }

  private setPointer(e: PointerEvent) {
    const r = this.canvas.getBoundingClientRect()
    this.pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1
    this.pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1
    this.raycaster.setFromCamera(this.pointer, this.camera)
  }

  private pickSheep(): SheepState | null {
    const meshes: THREE.Object3D[] = []
    for (const s of this.sheep) meshes.push(...s.group.children)
    const hits = this.raycaster.intersectObjects(meshes, false)
    if (!hits.length) return null
    let o: THREE.Object3D | null = hits[0].object
    while (o && o.name !== 'sheep') o = o.parent
    if (!o) return null
    return this.sheep.find((s) => s.group === o) ?? null
  }

  resize() {
    const w = this.canvas.clientWidth
    const h = this.canvas.clientHeight
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  setPaused(p: boolean) {
    this.paused = p
    this.live = !p
  }

  reset() {
    this.sheep.forEach((s, i) => {
      const p = this.initialPoses[i]
      s.group.position.set(p.x, 0, p.z)
      s.velocity.set(0, 0)
      s.wanderTimer = Math.random() * 2
    })
    this.controls.reset()
    this.camera.position.set(9, 8.5, 9)
    this.controls.target.set(0, 0.2, 0)
    this.live = true
    this.paused = false
  }

  tick() {
    const dt = Math.min(this.clock.getDelta(), 0.05)
    if (this.live && !this.paused) this.wander(dt)
    this.controls.update()
    this.renderer.render(this.scene, this.camera)
  }

  private wander(dt: number) {
    const bound = ISLAND_HALF - 1.2
    for (const s of this.sheep) {
      s.wanderTimer -= dt
      if (s.wanderTimer <= 0) {
        s.wanderTimer = 1.2 + Math.random() * 2.5
        const a = Math.random() * Math.PI * 2
        const speed = 0.25 + Math.random() * 0.35
        s.velocity.set(Math.cos(a) * speed, Math.sin(a) * speed)
      }
      s.group.position.x += s.velocity.x * dt
      s.group.position.z += s.velocity.y * dt
      if (Math.abs(s.group.position.x) > bound) {
        s.group.position.x = clamp(s.group.position.x, -bound, bound)
        s.velocity.x *= -1
      }
      if (Math.abs(s.group.position.z) > bound) {
        s.group.position.z = clamp(s.group.position.z, -bound, bound)
        s.velocity.y *= -1
      }
      if (s.velocity.lengthSq() > 0.0001) {
        s.group.rotation.y = Math.atan2(s.velocity.x, s.velocity.y)
      }
      const t = performance.now() * 0.003 + s.group.id
      s.group.position.y = Math.sin(t) * 0.02
    }
  }
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}