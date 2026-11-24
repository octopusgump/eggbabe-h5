import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { clay } from '../shared/clay'
import { roundedPadGeometry } from '../shared/roundedPad'
import type { ClayPiece, RoomLayout } from './tierCatalog'
import { resolveTier } from './tierCatalog'

const LIGHT_POS = new THREE.Vector3(4, 8, 6)

export class RoomModule {
  readonly group = new THREE.Group()
  private readonly scene = new THREE.Scene()
  private readonly camera: THREE.OrthographicCamera

  constructor(readonly layout: RoomLayout) {
    this.scene.background = null
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.85))
    const dir = new THREE.DirectionalLight(0xfff8e8, 0.65)
    dir.position.copy(LIGHT_POS)
    this.scene.add(dir)

  const aspect = layout.aabb.w / layout.aabb.h
    const h = 6
    const w = h * aspect
    this.camera = new THREE.OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, 0.1, 40)
    this.camera.position.set(3.2, 7.5, 7.5)
    this.camera.lookAt(0, 0, 0)

    const ground = new THREE.Mesh(
      new RoundedBoxGeometry(w * 0.92, 0.15, h * 0.92, 4, 0.25),
      clay(0xd7f3a4),
    )
    ground.position.y = -0.08
    this.group.add(ground)
    this.scene.add(ground.clone())
  }

  rebuild(tier: number) {
    const resolved = resolveTier(this.layout, tier)
    while (this.group.children.length > 1) this.group.remove(this.group.children[1])
    while (this.scene.children.length > 2) this.scene.remove(this.scene.children[2])

    if (resolved <= 1) return

    const def = this.layout.tiers[resolved]
    if (!def) return

    for (const p of def.pieces) {
      const mesh = this.pieceMesh(p)
      this.group.add(mesh)
      this.scene.add(mesh.clone())
    }
  }

  private pieceMesh(p: ClayPiece) {
    let geo: THREE.BufferGeometry
    if (p.kind === 'pad') {
      geo = roundedPadGeometry(Math.max(p.sx, p.sz), 0.35)
      geo.rotateX(-Math.PI / 2)
    } else if (p.kind === 'cylinder') {
      geo = new THREE.CylinderGeometry(p.sx * 0.5, p.sx * 0.55, p.sy, 10)
    } else {
      geo = new RoundedBoxGeometry(p.sx, p.sy, p.sz, 4, Math.min(p.sx, p.sz) * 0.15)
    }
    const mesh = new THREE.Mesh(geo, clay(p.color))
    mesh.position.set(p.x, p.y ?? p.sy / 2, p.z)
    mesh.castShadow = false
    return mesh
  }

  renderTo(renderer: THREE.WebGLRenderer, w: number, h: number) {
    renderer.setSize(w, h, false)
    renderer.render(this.scene, this.camera)
  }

  getScene() {
    return this.scene
  }

  getCamera() {
    return this.camera
  }
}