import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { SHEEP_COUNT } from './constants'
import { createIsland } from './island'
import { createSheep, type SheepState } from './sheep'
import { createTrees } from './trees'

/** Default isometric frame, close to the reference still. */
const CAM_POS = new THREE.Vector3(11.2, 13.4, 11.2)
const LOOK = new THREE.Vector3(0, 0.15, 0)
/** Vertical span. Portrait stage is narrow, so this is sized to fit the whole island. */
const FRUSTUM = 28

type Spawn = { x: number; z: number; ry: number; graze: boolean }

const LAYOUT: Spawn[] = [
  { x: -3.4, z: 2.2, ry: 0.5, graze: true },
  { x: -1.6, z: 1.1, ry: -0.6, graze: true },
  { x: 0.2, z: 1.8, ry: 2.1, graze: false },
  { x: 1.8, z: 0.4, ry: 1.2, graze: true },
  { x: -0.5, z: -0.4, ry: -1.4, graze: true },
  { x: 0.9, z: -1.5, ry: 0.3, graze: true },
  { x: 3.0, z: -2.0, ry: -0.4, graze: true },
  { x: -2.8, z: -1.3, ry: 1.8, graze: false },
  { x: -1.1, z: -2.5, ry: 2.5, graze: true },
  { x: 2.4, z: 2.3, ry: -2.2, graze: true },
  { x: 3.6, z: 0.2, ry: 0.8, graze: false },
]

export class MeadowApp {
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.OrthographicCamera
  private controls: OrbitControls
  private sheep: SheepState[] = []
  private clock = new THREE.Clock()
  private canvas: HTMLCanvasElement
  private readonly homePolar: number
  private readonly homeAzimuth: number

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
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
    this.controls.zoomSpeed = 0.55
    this.controls.rotateSpeed = 0.35
    this.controls.minZoom = 0.72
    this.controls.maxZoom = 1.85
    // Tight left/right so it does not swing. Extra room downward = a bit more front-on.
    this.controls.minAzimuthAngle = this.homeAzimuth - 0.18
    this.controls.maxAzimuthAngle = this.homeAzimuth + 0.18
    this.controls.minPolarAngle = this.homePolar - 0.08
    this.controls.maxPolarAngle = this.homePolar + 0.32
    this.controls.update()

    const hemi = new THREE.HemisphereLight(0xfffaf3, 0x8fbe68, 0.72)
    this.scene.add(hemi)

    const sun = new THREE.DirectionalLight(0xfff7ee, 1.05)
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
    this.scene.add(createTrees())
    this.spawnSheep()
    this.resize()
    window.addEventListener('resize', () => this.resize())
  }

  private spawnSheep() {
    for (let i = 0; i < SHEEP_COUNT; i++) {
      const spec = LAYOUT[i]
      const state = createSheep(spec.graze)
      state.group.position.set(spec.x, 0, spec.z)
      state.group.rotation.y = spec.ry
      state.group.scale.setScalar(1.15)
      this.sheep.push(state)
      this.scene.add(state.group)
    }
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
  }

  tick() {
    const t = this.clock.getElapsedTime()
    this.updateGraze(t)
    this.controls.update()
    this.renderer.render(this.scene, this.camera)
  }

  private updateGraze(t: number) {
    for (const s of this.sheep) {
      const wave = Math.sin(t * 1.15 + s.phaseOffset) * 0.045
      s.headPivot.rotation.x = (s.grazing ? -0.62 : -0.06) + wave
    }
  }
}