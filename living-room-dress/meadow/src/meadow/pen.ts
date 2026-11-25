import * as THREE from 'three'
import { PEN_ARM, PEN_CORNERS } from './bounds'
import { penLift, type LevelId } from './levels'
import { clay } from './materials'

const ARM = PEN_ARM
const CORNERS = PEN_CORNERS

function roundedPad(size: number, radius: number) {
  const s = size / 2
  const r = Math.min(radius, s - 0.001)
  const shape = new THREE.Shape()
  shape.moveTo(-s + r, -s)
  shape.lineTo(s - r, -s)
  shape.absarc(s - r, -s + r, r, -Math.PI / 2, 0, false)
  shape.lineTo(s, s - r)
  shape.absarc(s - r, s - r, r, 0, Math.PI / 2, false)
  shape.lineTo(-s + r, s)
  shape.absarc(-s + r, s - r, r, Math.PI / 2, Math.PI, false)
  shape.lineTo(-s, -s + r)
  shape.absarc(-s + r, -s + r, r, Math.PI, Math.PI * 1.5, false)
  return new THREE.ShapeGeometry(shape)
}

function layRail(parent: THREE.Group, x1: number, z1: number, x2: number, z2: number) {
  const dx = x2 - x1
  const dz = z2 - z1
  const len = Math.hypot(dx, dz) || 1
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, len, 8), clay(0xd5ba92))
  mesh.position.set((x1 + x2) / 2, 0.3, (z1 + z2) / 2)
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(dx / len, 0, dz / len),
  )
  mesh.castShadow = true
  parent.add(mesh)
}

function picket(parent: THREE.Group, x: number, z: number, tall = false) {
  const h = tall ? 0.5 : 0.36
  const top = tall ? 0.1 : 0.07
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(top, top + 0.02, h, 10),
    clay(tall ? 0xc69c6d : 0xdcc49e),
  )
  mesh.position.set(x, h / 2, z)
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

    const yard = new THREE.Mesh(roundedPad(ARM * 1.05, 0.42), clay(0xf3efe0))
    yard.rotation.x = -Math.PI / 2
    yard.position.set(cx - sx * ARM * 0.46, 0.025, cz - sz * ARM * 0.46)
    yard.receiveShadow = true
    pen.add(yard)

    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.08, 12), clay(0xe6d8be))
    bowl.position.set(cx - sx * ARM * 0.28, 0.05, cz - sz * ARM * 0.28)
    bowl.castShadow = true
    pen.add(bowl)
    const water = new THREE.Mesh(new THREE.CircleGeometry(0.2, 12), clay(0xa9cbc3))
    water.rotation.x = -Math.PI / 2
    water.position.set(bowl.position.x, 0.095, bowl.position.z)
    pen.add(water)

    const arms: [number, number, number, number][] = [
      [cx - sx * ARM, cz, cx, cz],
      [cx, cz - sz * ARM, cx, cz],
    ]
    arms.forEach(([x1, z1, x2, z2], arm) => {
      layRail(pen, x1, z1, x2, z2)
      const steps = 3
      for (let i = 0; i <= steps; i++) {
        if (arm === 1 && i === steps) continue
        const t = i / steps
        picket(pen, x1 + (x2 - x1) * t, z1 + (z2 - z1) * t, i === 0 || i === steps)
      }
    })

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

export function stepPens(rig: PenRig, dt: number, level: LevelId = 1) {
  const settle = Math.min(1, dt * 8)
  for (let i = 0; i < rig.groups.length; i++) {
    rig.shake[i] += (0 - rig.shake[i]) * settle
    if (rig.shake[i] < 0.001) rig.shake[i] = 0
    const [cx, cz] = CORNERS[i]
    const len = Math.hypot(cx, cz) || 1
    const k = rig.shake[i]
    rig.groups[i].position.set((cx / len) * k, penLift(level, i), (cz / len) * k)
  }
}

export function resetPens(rig: PenRig, level: LevelId = 1) {
  for (let i = 0; i < rig.groups.length; i++) {
    rig.shake[i] = 0
    rig.groups[i].position.set(0, penLift(level, i), 0)
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

export function penIndexAt(x: number, z: number, reach = 0) {
  for (let i = 0; i < CORNERS.length; i++) {
    const [cx, cz] = CORNERS[i]
    let { x0, x1, z0, z1 } = penBox(cx, cz, 0.08)
    const sx = Math.sign(cx)
    const sz = Math.sign(cz)
    if (sx > 0) x0 -= reach
    else x1 += reach
    if (sz > 0) z0 -= reach
    else z1 += reach
    if (x > x0 && x < x1 && z > z0 && z < z1) return i
  }
  return -1
}

/** Pen mouth the sheep should drift toward while it runs from the herder. */
export function herdTarget(x: number, z: number, awayX: number, awayZ: number) {
  const alen = Math.hypot(awayX, awayZ) || 1
  const ax = awayX / alen
  const az = awayZ / alen
  let bestScore = -Infinity
  let mouthX = 0
  let mouthZ = 0
  let mouthDist = 1
  for (const [cx, cz] of CORNERS) {
    const sx = Math.sign(cx)
    const sz = Math.sign(cz)
    const mx = cx - sx * ARM * 0.62
    const mz = cz - sz * ARM * 0.62
    const dx = mx - x
    const dz = mz - z
    const dist = Math.hypot(dx, dz) || 1
    const align = (dx / dist) * ax + (dz / dist) * az
    const score = align * 1.6 - dist * 0.07
    if (score > bestScore) {
      bestScore = score
      mouthX = mx
      mouthZ = mz
      mouthDist = dist
    }
  }
  const near = Math.max(0, 1 - mouthDist / 6.5)
  const aimed = bestScore > 0.12
  const weight = Math.min(0.86, (aimed ? 0.4 : 0.16) + near * 0.42)
  return { x: mouthX, z: mouthZ, weight }
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