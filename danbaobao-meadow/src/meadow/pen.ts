import * as THREE from 'three'
import { clay } from './materials'

const ARM = 1.05
const CORNERS: [number, number][] = [
  [7.55, 7.55],
  [-7.55, 7.55],
  [7.55, -7.55],
  [-7.55, -7.55],
]

function rail(parent: THREE.Group, x1: number, z1: number, x2: number, z2: number) {
  const dx = x2 - x1
  const dz = z2 - z1
  const len = Math.hypot(dx, dz)
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(len, 0.32, 0.1), clay(0xc4a06a))
  mesh.position.set((x1 + x2) / 2, 0.18, (z1 + z2) / 2)
  mesh.rotation.y = Math.atan2(-dz, dx)
  mesh.castShadow = true
  parent.add(mesh)
}

function post(parent: THREE.Group, x: number, z: number) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.08, 0.42, 8),
    clay(0xb08a52),
  )
  mesh.position.set(x, 0.21, z)
  mesh.castShadow = true
  parent.add(mesh)
}

/** One small pen in each corner of the square. The open side faces the meadow. */
export function createCornerPens(): THREE.Group {
  const root = new THREE.Group()
  root.name = 'pens'

  for (const [cx, cz] of CORNERS) {
    const sx = Math.sign(cx)
    const sz = Math.sign(cz)
    const pen = new THREE.Group()

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(ARM * 0.92, ARM * 0.92),
      clay(0xd5e7a4),
    )
    floor.rotation.x = -Math.PI / 2
    floor.position.set(cx - sx * ARM * 0.42, 0.03, cz - sz * ARM * 0.42)
    floor.receiveShadow = true
    pen.add(floor)

    rail(pen, cx - sx * ARM, cz, cx, cz)
    rail(pen, cx, cz - sz * ARM, cx, cz)
    post(pen, cx, cz)
    post(pen, cx - sx * ARM, cz)
    post(pen, cx, cz - sz * ARM)

    root.add(pen)
  }

  return root
}

export function isInsideCornerPen(x: number, z: number) {
  for (const [cx, cz] of CORNERS) {
    const sx = Math.sign(cx)
    const sz = Math.sign(cz)
    const x0 = Math.min(cx, cx - sx * ARM)
    const x1 = Math.max(cx, cx - sx * ARM)
    const z0 = Math.min(cz, cz - sz * ARM)
    const z1 = Math.max(cz, cz - sz * ARM)
    if (x > x0 + 0.08 && x < x1 - 0.08 && z > z0 + 0.08 && z < z1 - 0.08) return true
  }
  return false
}