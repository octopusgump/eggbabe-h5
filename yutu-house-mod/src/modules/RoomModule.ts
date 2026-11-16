import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { clay } from '../shared/clay'
import { roundedPadGeometry } from '../shared/roundedPad'
import { blobShadow } from '../shared/shadow'
import type { ClayPiece, RoomLayout } from './tierCatalog'
import { resolveTier } from './tierCatalog'
import { fitCamera, type PlateFit } from '../bake/roomPlate'

const LIGHT_POS = new THREE.Vector3(4, 8, 6)

export class RoomModule {
  readonly group = new THREE.Group()
  private readonly scene = new THREE.Scene()
  private camera: THREE.OrthographicCamera
  private fit: PlateFit

  constructor(readonly layout: RoomLayout) {
    this.scene.background = null
    const amb = new THREE.AmbientLight(0xfff6e8, 0.72)
    amb.userData.keep = true
    this.scene.add(amb)
    const dir = new THREE.DirectionalLight(0xfff0d8, 0.78)
    dir.position.copy(LIGHT_POS)
    dir.userData.keep = true
    this.scene.add(dir)

    this.fit = fitCamera(layout)
    this.camera = this.fit.camera

    this.buildGround()
  }

  private buildGround() {
    // Art already has the floor — only drop a soft AO ring so clay pieces feel seated.
    // A solid clay ground plate reads as a floating sticker over the illustration.
    const { plateW, plateD } = this.fit
    const ao = blobShadow(plateW * 0.48, plateD * 0.48, 0.28)
    ao.scale.multiplyScalar(1.05)
    ao.position.y = 0.01
    ao.userData.keep = true
    this.scene.add(ao)
  }

  /** Recompute camera when ?pxu= changes. */
  refit() {
    // Drop keep meshes except lights — rebuild ground
    const keepLights: THREE.Object3D[] = []
    for (const c of [...this.scene.children]) {
      if (c instanceof THREE.Light) keepLights.push(c)
      else this.scene.remove(c)
    }
    this.group.clear()
    this.fit = fitCamera(this.layout)
    this.camera = this.fit.camera
    for (const l of keepLights) this.scene.add(l)
    this.buildGround()
  }

  rebuild(tier: number) {
    const resolved = resolveTier(this.layout, tier)
    this.clearPieces()
    if (resolved <= 1) return

    const def = this.layout.tiers[resolved]
    if (!def) return

    for (const p of def.pieces) {
      const mesh = this.pieceMesh(p)
      this.scene.add(mesh)
      this.group.add(mesh.clone())

      const shadow = blobShadow(p.sx * 0.55, p.sz * 0.55, 0.5)
      shadow.position.set(p.x, 0.02, p.z)
      this.scene.add(shadow)
      this.group.add(shadow.clone())
    }
  }

  private clearPieces() {
    const doomed: THREE.Object3D[] = []
    for (const c of this.scene.children) {
      if (c.userData.keep || c instanceof THREE.Light) continue
      doomed.push(c)
    }
    for (const c of doomed) this.scene.remove(c)
    // group: keep ground (userData.keep), drop the rest
    const gDoomed: THREE.Object3D[] = []
    for (const c of this.group.children) {
      if (c.userData.keep) continue
      gDoomed.push(c)
    }
    for (const c of gDoomed) this.group.remove(c)
  }

  private pieceMesh(p: ClayPiece) {
    let geo: THREE.BufferGeometry
    if (p.kind === 'pad') {
      geo = roundedPadGeometry(p.sx, p.sz, Math.min(p.sx, p.sz) * 0.18)
    } else if (p.kind === 'cylinder') {
      geo = new THREE.CylinderGeometry(p.sx * 0.5, p.sx * 0.55, p.sy, 10)
    } else {
      geo = new RoundedBoxGeometry(p.sx, p.sy, p.sz, 4, Math.min(p.sx, p.sz) * 0.15)
    }
    const mesh = new THREE.Mesh(geo, clay(p.color))
    if (p.kind === 'pad') {
      mesh.position.set(p.x, p.y ?? 0, p.z)
    } else {
      mesh.position.set(p.x, p.y ?? p.sy / 2, p.z)
    }
    mesh.castShadow = false
    return mesh
  }

  renderTo(renderer: THREE.WebGLRenderer, w: number, h: number) {
    renderer.setSize(w, h, false)
    renderer.setClearColor(0x000000, 0)
    renderer.render(this.scene, this.camera)
  }

  getFit() {
    return this.fit
  }

  getCanvasSize() {
    return {
      canvasW: this.fit.canvasW,
      canvasH: this.fit.canvasH,
      cssW: this.fit.cssW,
      cssH: this.fit.cssH,
    }
  }

  getPlateQuad() {
    return this.fit.plateQuad
  }

  getScene() {
    return this.scene
  }

  getCamera() {
    return this.camera
  }
}
