import * as THREE from 'three'
import { CORNER_GAP, PEN_SIZE } from './constants'

const FENCE_COLOR = 0xc9a574
const FENCE_H = 0.38
const THICK = 0.12

function addFenceSegment(
  root: THREE.Group,
  x1: number,
  z1: number,
  x2: number,
  z2: number,
) {
  const dx = x2 - x1
  const dz = z2 - z1
  const len = Math.hypot(dx, dz)
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(len, FENCE_H, THICK),
    new THREE.MeshLambertMaterial({ color: FENCE_COLOR }),
  )
  mesh.position.set((x1 + x2) / 2, FENCE_H / 2 + 0.02, (z1 + z2) / 2)
  mesh.rotation.y = Math.atan2(dx, dz)
  mesh.castShadow = true
  mesh.receiveShadow = true
  root.add(mesh)
}

/** Square pen: each side is one segment; corners stay open for gameplay (phase 2). */
export function createPen(): THREE.Group {
  const pen = new THREE.Group()
  pen.name = 'pen'

  const h = PEN_SIZE / 2
  const inset = CORNER_GAP / 2 + 0.05

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(PEN_SIZE * 0.94, PEN_SIZE * 0.94),
    new THREE.MeshLambertMaterial({ color: 0xa8c78a, side: THREE.DoubleSide }),
  )
  floor.rotation.x = -Math.PI / 2
  floor.position.y = 0.028
  floor.receiveShadow = true
  pen.add(floor)

  addFenceSegment(pen, -h + inset, -h, h - inset, -h)
  addFenceSegment(pen, h, -h + inset, h, h - inset)
  addFenceSegment(pen, h - inset, h, -h + inset, h)
  addFenceSegment(pen, -h, h - inset, -h, -h + inset)

  const postMat = new THREE.MeshLambertMaterial({ color: 0xb89560 })
  for (const [x, z] of [
    [-h, -h],
    [h, -h],
    [h, h],
    [-h, h],
  ]) {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.08, FENCE_H + 0.05, 8),
      postMat,
    )
    post.position.set(x, FENCE_H / 2, z)
    post.castShadow = true
    pen.add(post)
  }

  return pen
}