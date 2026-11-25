import * as THREE from 'three'
import { GATE_BACK_Z, GATE_HALF_W, GATE_MOUTH_Z, hitsFence } from './bounds'
import { type LevelId } from './levels'
import { ceramic, clay, felt, oakWood, snowTrim, strawPad } from './materials'

export { hitsFence }

export const PEN_COUNT = 1

function roundedRect(width: number, depth: number, radius: number) {
  const hw = width / 2
  const hd = depth / 2
  const r = Math.min(radius, hw - 0.001, hd - 0.001)
  const shape = new THREE.Shape()
  shape.moveTo(-hw + r, -hd)
  shape.lineTo(hw - r, -hd)
  shape.absarc(hw - r, -hd + r, r, -Math.PI / 2, 0, false)
  shape.lineTo(hw, hd - r)
  shape.absarc(hw - r, hd - r, r, 0, Math.PI / 2, false)
  shape.lineTo(-hw + r, hd)
  shape.absarc(-hw + r, hd - r, r, Math.PI / 2, Math.PI, false)
  shape.lineTo(-hw, -hd + r)
  shape.absarc(-hw + r, -hd + r, r, Math.PI, Math.PI * 1.5, false)
  return new THREE.ShapeGeometry(shape)
}

function layRail(parent: THREE.Group, x1: number, z1: number, x2: number, z2: number) {
  const dx = x2 - x1
  const dz = z2 - z1
  const len = Math.hypot(dx, dz) || 1
  const railMat = oakWood(0xc69b6b, 1)
  for (const y of [0.22, 0.44]) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.062, len, 10), railMat)
    mesh.position.set((x1 + x2) / 2, y, (z1 + z2) / 2)
    mesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(dx / len, 0, dz / len),
    )
    mesh.castShadow = true
    mesh.receiveShadow = true
    parent.add(mesh)
  }
}

function picket(parent: THREE.Group, x: number, z: number, tall = false) {
  const h = tall ? 0.72 : 0.52
  const top = tall ? 0.145 : 0.1
  const mat = oakWood(tall ? 0xae7f4f : 0xc69a6a, 1)
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(top, top + 0.02, h, 12), mat)
  mesh.position.set(x, h / 2, z)
  mesh.castShadow = true
  mesh.receiveShadow = true
  parent.add(mesh)

  const cap = new THREE.Mesh(new THREE.SphereGeometry(top * 1.04, 12, 8), mat)
  cap.scale.set(1, 0.55, 1)
  cap.position.set(x, h, z)
  cap.castShadow = true
  parent.add(cap)
}

/** Cute sculpted frost-sheep / golden lantern gate totem flanking the single entrance (Penguin Pushers gate nod!) */
function addGatePillar(parent: THREE.Group, x: number, z: number) {
  const pillar = new THREE.Group()
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.28, 0.56, 12),
    oakWood(0xb88958, 1),
  )
  base.position.y = 0.28
  base.castShadow = true
  base.receiveShadow = true
  pillar.add(base)

  const snowCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.26, 0.25, 0.1, 12),
    snowTrim(0xfffdf8, 0xedf4f7, 1),
  )
  snowCap.position.y = 0.58
  pillar.add(snowCap)

  // Glowing warm-amber star lantern orb on top of each gate post
  const orb = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 14, 12),
    new THREE.MeshStandardMaterial({
      color: 0xffe48a,
      emissive: 0xffc84a,
      emissiveIntensity: 0.45,
      roughness: 0.35,
      metalness: 0.05,
    }),
  )
  orb.position.y = 0.78
  orb.castShadow = true
  pillar.add(orb)

  pillar.position.set(x, 0, z)
  parent.add(pillar)
}

/** Warm golden-cream checkered entrance threshold mat (exact visual landmark cue like Penguin Pushers!) */
function addGateThresholdMat(parent: THREE.Group) {
  const cols = 6
  const rows = 2
  const totalW = GATE_HALF_W * 2 - 0.32
  const totalD = 0.72
  const cellW = totalW / cols
  const cellD = totalD / rows
  const matA = clay(0xf6d365, 0.72)
  const matB = clay(0xfff4c8, 0.72)
  const geo = new THREE.PlaneGeometry(cellW * 0.98, cellD * 0.98)
  geo.rotateX(-Math.PI / 2)

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tile = new THREE.Mesh(geo, (r + c) % 2 === 0 ? matA : matB)
      tile.position.set(
        -totalW / 2 + cellW * (c + 0.5),
        0.038,
        GATE_MOUTH_Z - 0.1 + cellD * (r - 0.5),
      )
      tile.receiveShadow = true
      parent.add(tile)
    }
  }
}

function addPlanter(parent: THREE.Group, x: number, z: number) {
  const pot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.17, 0.13, 0.19, 12),
    clay(0xc97f57, 0.84),
  )
  pot.position.set(x, 0.095, z)
  pot.castShadow = true
  parent.add(pot)

  const foliage = new THREE.Mesh(
    new THREE.SphereGeometry(0.17, 12, 10),
    felt(0x8bb056, 0x769a44, 1, 0.025),
  )
  foliage.scale.set(1.1, 0.78, 1.1)
  foliage.position.set(x, 0.23, z)
  foliage.castShadow = true
  parent.add(foliage)

  const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), clay(0xfff9ea, 0.8))
  bloom.position.set(x + 0.04, 0.33, z - 0.03)
  parent.add(bloom)
}

export type PenRig = {
  root: THREE.Group
  groups: THREE.Group[]
  shake: number[]
}

/** Single grand South-Center Sheep Gate & Straw Pen (replacing 4 corner pens). */
export function createCornerPens(): PenRig {
  const root = new THREE.Group()
  root.name = 'pens'

  const pen = new THREE.Group()
  const width = GATE_HALF_W * 2
  const depth = GATE_BACK_Z - GATE_MOUTH_Z
  const centerZ = (GATE_MOUTH_Z + GATE_BACK_Z) / 2

  // Cozy golden straw floor pad wide enough to visibly hold all 11 sheep
  const yard = new THREE.Mesh(roundedRect(width + 0.12, depth + 0.12, 0.42), strawPad(0xe9d6a7, 3))
  yard.rotation.x = -Math.PI / 2
  yard.position.set(0, 0.034, centerZ)
  yard.receiveShadow = true
  pen.add(yard)

  // Warm checkered golden entry threshold mat
  addGateThresholdMat(pen)

  // Glazed ceramic water bowl tucked in the back-right of the cozy pen
  const bowl = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.36, 0.12, 16),
    ceramic(0xf4ede0, 0.34),
  )
  bowl.position.set(GATE_HALF_W - 0.56, 0.06, GATE_BACK_Z - 0.5)
  bowl.castShadow = true
  pen.add(bowl)
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(0.24, 16),
    ceramic(0x9ccbc4, 0.18),
  )
  water.rotation.x = -Math.PI / 2
  water.position.set(bowl.position.x, 0.122, bowl.position.z)
  pen.add(water)

  // Three-sided oak fence rails (Left, Right, Back; North mouth stays wide open!)
  const segments: [number, number, number, number, number][] = [
    [-GATE_HALF_W, GATE_MOUTH_Z, -GATE_HALF_W, GATE_BACK_Z, 3],
    [GATE_HALF_W, GATE_MOUTH_Z, GATE_HALF_W, GATE_BACK_Z, 3],
    [-GATE_HALF_W, GATE_BACK_Z, GATE_HALF_W, GATE_BACK_Z, 5],
  ]
  for (const [x1, z1, x2, z2, steps] of segments) {
    layRail(pen, x1, z1, x2, z2)
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      picket(pen, x1 + (x2 - x1) * t, z1 + (z2 - z1) * t, i === 0 || i === steps)
    }
  }

  // Twin glowing gate pillars flanking the wide entrance
  addGatePillar(pen, -GATE_HALF_W, GATE_MOUTH_Z)
  addGatePillar(pen, GATE_HALF_W, GATE_MOUTH_Z)

  // Cozy potted plants just outside each gate pillar
  addPlanter(pen, -GATE_HALF_W - 0.42, GATE_MOUTH_Z + 0.18)
  addPlanter(pen, GATE_HALF_W + 0.42, GATE_MOUTH_Z + 0.18)

  root.add(pen)
  return { root, groups: [pen], shake: [0] }
}

/** Joyful spring bounce on the pen when a sheep jumps inside. */
export function kickPen(rig: PenRig, index = 0) {
  const i = Math.min(rig.shake.length - 1, Math.max(0, index))
  rig.shake[i] = 0.18
}

export function stepPens(rig: PenRig, dt: number, _level: LevelId = 1) {
  const settle = Math.min(1, dt * 9)
  for (let i = 0; i < rig.groups.length; i++) {
    rig.shake[i] += (0 - rig.shake[i]) * settle
    if (rig.shake[i] < 0.001) rig.shake[i] = 0
    const k = rig.shake[i]
    rig.groups[i].position.set(0, k * 0.45, k * 0.85)
  }
}

export function resetPens(rig: PenRig, _level: LevelId = 1) {
  for (let i = 0; i < rig.groups.length; i++) {
    rig.shake[i] = 0
    rig.groups[i].position.set(0, 0, 0)
  }
}

/** Returns 0 if (x, z) has entered the single South-Center gate mouth, else -1. */
export function penIndexAt(x: number, z: number, reach = 0) {
  const halfW = GATE_HALF_W - 0.14
  const mouthZ = GATE_MOUTH_Z - reach * 0.48
  if (Math.abs(x) < halfW && z > mouthZ && z < GATE_BACK_Z + 0.25) {
    return 0
  }
  return -1
}

/** Guides fleeing sheep gently toward the single South-Center gate mouth when pushed roughly southward. */
export function herdTarget(x: number, z: number, awayX: number, awayZ: number) {
  const mouthX = 0
  const mouthZ = GATE_MOUTH_Z + 0.2
  const alen = Math.hypot(awayX, awayZ) || 1
  const ax = awayX / alen
  const az = awayZ / alen
  const dx = mouthX - x
  const dz = mouthZ - z
  const dist = Math.hypot(dx, dz) || 1
  const align = (dx / dist) * ax + (dz / dist) * az
  const near = Math.max(0, 1 - dist / 6.8)
  const aimed = align > 0.05
  const weight = Math.min(0.84, (aimed ? 0.34 : 0.08) + near * (aimed ? 0.46 : 0.14))
  return { x: mouthX, z: mouthZ, weight }
}

export function isInsideCornerPen(x: number, z: number) {
  return penIndexAt(x, z, 0) >= 0
}

/** Assigns one of 11 cozy non-overlapping straw spots inside the single grand South-Center pen. */
export function assignSinglePenSpot(slotIndex: number): [number, number] {
  const spots: [number, number][] = [
    [0.0, 6.45],
    [-0.9, 6.4],
    [0.9, 6.4],
    [-1.65, 6.55],
    [1.65, 6.55],
    [-0.45, 7.15],
    [0.45, 7.15],
    [-1.3, 7.2],
    [1.25, 7.2],
    [-1.7, 5.95],
    [1.65, 5.95],
  ]
  return spots[slotIndex % spots.length]
}

export function clampToPen(_index: number, x: number, z: number) {
  return {
    x: Math.min(GATE_HALF_W - 0.25, Math.max(-GATE_HALF_W + 0.25, x)),
    z: Math.min(GATE_BACK_Z - 0.25, Math.max(GATE_MOUTH_Z + 0.25, z)),
  }
}