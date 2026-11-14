import * as THREE from 'three'
import { SHEEP_COUNT } from './constants'
import { createIsland } from './island'
import { createSheep, type SheepState } from './sheep'
import { createTrees } from './trees'

/** Fixed isometric framing — Kimi screenshot 1. */
const CAM_POS = new THREE.Vector3(12, 14.2, 12)
const LOOK = new THREE.Vector3(0, 0.1, 0)
const FRUSTUM = 9.4

type Spawn = { x: number; z: number; ry: number; graze: boolean }

const LAYOUT: Spawn[] = [
  { x: -2.8, z: 2.2, ry: 2.1, graze: true },
  { x: -1.2, z: 0.2, ry: 0.6, graze: true },
  { x: 0.4, z: -0.8, ry: -0.4, graze: false },
  { x: 1.6, z: 1.0, ry: 1.8, graze: true },
  { x: -0.5, z: 2.4, ry: 2.8, graze: true },
  { x: 0.3, z: -2.0, ry: -1.2, graze: false },
  { x: 2.4, z: -0.5, ry: 0.9, graze: true },
  { x: -2.2, z: -0.6, ry: -2.2, graze: true },
  { x: 1.0, z: 2.2, ry: 2.4, graze: false },
  { x: -0.2, z: -2.6, ry: -0.8, graze: true },
  { x: 2.0, z: 0.8, ry: 1.1, graze: true },
]

export class MeadowApp {
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.OrthographicCamera
  private sheep: SheepState[] = []
  private clock = new THREE.Clock()
  private canvas: HTMLCanvasElement

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

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0xe8ede8)

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

    const hemi = new THREE.HemisphereLight(0xf4f8ff, 0x7cb562, 0.5)
    this.scene.add(hemi)

    const sun = new THREE.DirectionalLight(0xffffff, 1.22)
    sun.position.set(-11, 20, 7)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.bias = -0.00015
    sun.shadow.normalBias = 0.02
    sun.shadow.camera.near = 2
    sun.shadow.camera.far = 42
    const s = 15
    sun.shadow.camera.left = -s
    sun.shadow.camera.right = s
    sun.shadow.camera.top = s
    sun.shadow.camera.bottom = -s
    this.scene.add(sun)

    const fill = new THREE.DirectionalLight(0xe8f0ff, 0.22)
    fill.position.set(8, 6, -10)
    this.scene.add(fill)

    this.scene.add(createIsland())
    this.scene.add(createTrees())
    this.addGroundShadow()

    this.spawnSheep()
    this.resize()
    window.addEventListener('resize', () => this.resize())
  }

  private addGroundShadow() {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xb8cdb8,
      transparent: true,
      opacity: 0.35,
    })
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(9.5, 48), mat)
    shadow.rotation.x = -Math.PI / 2
    shadow.position.set(1.2, -0.72, 2.4)
    this.scene.add(shadow)
  }

  private spawnSheep() {
    for (let i = 0; i < SHEEP_COUNT; i++) {
      const spec = LAYOUT[i]
      const state = createSheep(spec.graze)
      state.grazing = spec.graze
      state.group.position.set(spec.x, 0, spec.z)
      state.group.rotation.y = spec.ry
      this.sheep.push(state)
      this.scene.add(state.group)
    }
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
    const t = this.clock.getElapsedTime()
    this.updateGraze(t)
    this.renderer.render(this.scene, this.camera)
  }

  private updateGraze(t: number) {
    for (const s of this.sheep) {
      const wave = Math.sin(t * 1.2 + s.phaseOffset) * 0.04
      if (s.grazing) {
        s.headPivot.rotation.x = -0.55 + wave
      } else {
        s.headPivot.rotation.x = -0.08 + wave * 0.5
      }
    }
  }
}