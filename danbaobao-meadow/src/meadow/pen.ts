import * as THREE from 'three'
import { PEN_ARM, PEN_CORNERS } from './bounds'
import { clay } from './materials'

const ARM = PEN_ARM
const CORNERS = PEN_CORNERS

function rail(parent: THREE.Group, x1: number, z1: number, x2: number, z2: number) {
  const dx = x2 - x1
  const dz = z2 - z1
  const len = Math.hypot(dx, dz)
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(len, 0.46, 0.16), clay(0xc4a06a))
  mesh.position.set((x1 + x2) / 2, 0.26, (z1 + z2) / 2)
  mesh.rotation.y = Math.atan2(-dz, dx)
  mesh.castShadow = true
  parent.add(mesh)
}

function post(parent: THREE.Group, x: number, z: number) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.11, 0.58, 8),
    clay(0xb08a52),
  )
  mesh.position.set(x, 0.29, z)
  mesh.castShadow = true
  parent.add(mesh)
}

export type PenRig = {
  root: THREE.Group
  groups: THREE.Group[]
  shake: number[]
}

/** One small pen in each corner of the square. The open side faces the meadow. */
export function createCornerPens(): PenRig {
  const root = new THREE.Group()
  root.name = 'pens'
  const groups: THREE.Group[] = []
  const shake: number[] = []

  for (const [cx, cz] of CORNERS) {
    const sx = Math.sign(cx)
    const sz = Math.sign(cz)
    const pen = new THREE.Group()

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(ARM * 0.86, ARM * 0.86),
      clay(0xe7f6bc),
    )
    floor.rotation.x = -Math.PI / 2
    floor.position.set(cx - sx * ARM * 0.46, 0.03, cz - sz * ARM * 0.46)
    floor.receiveShadow = true
    pen.add(floor)

    rail(pen, cx - sx * ARM, cz, cx, cz)
    rail(pen, cx, cz - sz * ARM, cx, cz)
    post(pen, cx, cz)
    post(pen, cx - sx * ARM, cz)
    post(pen, cx, cz - sz * ARM)

    root.add(pen)
    groups.push(pen)
    shake.push(0)
  }

  return { root, groups, shake }
}

/** Nudge one corner outward. Collision tests stay on the unshifted coordinates. */
export function kickPen(rig: PenRig, index: number) {
  rig.shake[index] = 0.16
}

export function stepPens(rig: PenRig, dt: number) {
  const settle = Math.min(1, dt * 8)
  for (let i = 0; i < rig.groups.length; i++) {
    rig.shake[i] += (0 - rig.shake[i]) * settle
    if (rig.shake[i] < 0.001) rig.shake[i] = 0
    const [cx, cz] = CORNERS[i]
    const len = Math.hypot(cx, cz) || 1
    const k = rig.shake[i]
    rig.groups[i].position.set((cx / len) * k, 0, (cz / len) * k)
  }
}

export function resetPens(rig: PenRig) {
  for (let i = 0; i < rig.groups.length; i++) {
    rig.shake[i] = 0
    rig.groups[i].position.set(0, 0, 0)
  }
}

function penBox(cx: number, cz: number, inset: number) {
  const sx = Math.sign(cx)
  const sz = Math.sign(cz)
  const x0 = Math.min(cx, cx - sx * ARM) + inset
  const x1 = Math.max(cx, cx - sx * ARM) - inset
  const z0 = Math.min(cz, cz - sz * ARM) + inset
  const z1 = Math.max(cz, cz - sz * ARM) - inset
  return { x0, x1, z0, z1 }
}

export function penIndexAt(x: number, z: number) {
  for (let i = 0; i < CORNERS.length; i++) {
    const [cx, cz] = CORNERS[i]
    const { x0, x1, z0, z1 } = penBox(cx, cz, 0.08)
    if (x > x0 && x < x1 && z > z0 && z < z1) return i
  }
  return -1
}

export function isInsideCornerPen(x: number, z: number) {
  return penIndexAt(x, z) >= 0
}

/** Keep a penned sheep inside its corner, including off the open side. */
export function clampToPen(index: number, x: number, z: number) {
  const [cx, cz] = CORNERS[index]
  const { x0, x1, z0, z1 } = penBox(cx, cz, 0.2)
  return {
    x: Math.min(x1, Math.max(x0, x)),
    z: Math.min(z1, Math.max(z0, z)),
  }
}

export { hitsFence } from './bounds'