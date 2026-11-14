import * as THREE from 'three'
import { ISLAND_HALF, SHEEP_COUNT } from './constants'
import { createIsland } from './island'
import { createSheep, type SheepState } from './sheep'
import { createTrees } from './trees'

type SavedPose = { x: number; z: number; ry: number }

/** Fixed isometric camera — matches Kimi screenshot 1 framing. */
const CAM_POS = new THREE.Vector3(11.5, 13.5, 11.5)
const LOOK = new THREE.Vector3(0, 0.15, 0)
const FRUSTUM = 9.2

export class MeadowApp {
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.OrthographicCamera
  private sheep: SheepState[] = []
  private initialPoses: SavedPose[] = []
  private raycaster = new THREE.Raycaster()
  private pointer = new THREE.Vector2()
  private dragSheep: SheepState | null = null
  private dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  private dragOffset = new THREE.Vector3()
  private live = true
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
    this.renderer.outputColorSpace = THREE.SRGBColorSpace

    this.scene = new THREE.Scene()

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

    const hemi = new THREE.HemisphereLight(0xeef6ff, 0x88b86a, 0.55)
    this.scene.add(hemi)

    const sun = new THREE.DirectionalLight(0xffffff, 1.15)
    sun.position.set(-10, 18, 8)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.bias = -0.0002
    sun.shadow.camera.near = 2
    sun.shadow.camera.far = 40
    const s = 14
    sun.shadow.camera.left = -s
    sun.shadow.camera.right = s
    sun.shadow.camera.top = s
    sun.shadow.camera.bottom = -s
    this.scene.add(sun)

    const fill = new THREE.DirectionalLight(0xdfe8ff, 0.25)
    fill.position.set(6, 4, -8)
    this.scene.add(fill)

    this.scene.add(createIsland())
    this.scene.add(createTrees())

    this.spawnSheep()
    this.bindPointer()
    this.resize()
    window.addEventListener('resize', () => this.resize())
  }

  private spawnSheep() {
    const poses: [number, number][] = [
      [-2.2, -1.8],
      [-0.8, 0.5],
      [0.6, -0.4],
      [1.8, 1.2],
      [-1.0, 2.0],
      [0.2, -1.5],
      [2.5, -0.8],
      [-2.8, 0.3],
      [1.0, 2.3],
      [-0.3, -2.5],
      [2.0, 0.6],
    ]
    for (let i = 0; i < SHEEP_COUNT; i++) {
      const state = createSheep()
      const [x, z] = poses[i] ?? [
        (Math.random() - 0.5) * ISLAND_HALF * 1.2,
        (Math.random() - 0.5) * ISLAND_HALF * 1.2,
      ]
      const ry = Math.random() * Math.PI * 2
      state.group.position.set(x, 0, z)
      state.group.rotation.y = ry
      this.sheep.push(state)
      this.initialPoses.push({ x, z, ry })
      this.scene.add(state.group)
    }
  }

  private bindPointer() {
    const el = this.canvas
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      this.setPointer(e)
      const hit = this.pickSheep()
      if (!hit) return
      this.dragSheep = hit
      const pt = new THREE.Vector3()
      this.raycaster.ray.intersectPlane(this.dragPlane, pt)
      this.dragOffset.copy(hit.group.position).sub(pt)
      el.setPointerCapture(e.pointerId)
      e.preventDefault()
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
      this.dragSheep = null
    }
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
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
    const aspect = w / h
    this.camera.left = (-FRUSTUM * aspect) / 2
    this.camera.right = (FRUSTUM * aspect) / 2
    this.camera.top = FRUSTUM / 2
    this.camera.bottom = -FRUSTUM / 2
    this.camera.updateProjectionMatrix()
    this.camera.position.copy(CAM_POS)
    this.camera.lookAt(LOOK)
  }

  tick() {
    const dt = Math.min(this.clock.getDelta(), 0.05)
    if (this.live) this.wander(dt)
    this.renderer.render(this.scene, this.camera)
  }

  private wander(dt: number) {
    const bound = ISLAND_HALF - 1.1
    for (const s of this.sheep) {
      s.wanderTimer -= dt
      if (s.wanderTimer <= 0) {
        s.wanderTimer = 1.5 + Math.random() * 2.8
        const a = Math.random() * Math.PI * 2
        const speed = 0.12 + Math.random() * 0.22
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
    }
  }
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}