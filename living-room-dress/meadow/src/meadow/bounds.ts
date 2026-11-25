import { ISLAND_HALF } from './constants'
import { pushOutOfWater, type LevelId } from './levels'

/**
 * Single wide South-Center gate pen (Super Mario Party — Penguin Pushers layout):
 * - Centered at x = 0, mouth opens northward at z = GATE_MOUTH_Z
 * - Back wall sits flush at the south edge z = GATE_BACK_Z
 */
export const GATE_HALF_W = 2.35
export const GATE_MOUTH_Z = 5.45
export const GATE_BACK_Z = 7.75

/** Plan of the arena slab. */
const SLAB_RADIUS = 0.62
const BODY_MARGIN = 0.28
export const GRASS_HALF = ISLAND_HALF - BODY_MARGIN
export const GRASS_CORNER = Math.max(0.04, SLAB_RADIUS - BODY_MARGIN)

export const FENCE_CLEAR = 0.28

/** U-shaped wooden rails enclosing the single South-Center pen (left, right, back; north mouth is wide open). */
export function fenceRails(): [number, number, number, number][] {
  return [
    [-GATE_HALF_W, GATE_MOUTH_Z, -GATE_HALF_W, GATE_BACK_Z],
    [GATE_HALF_W, GATE_MOUTH_Z, GATE_HALF_W, GATE_BACK_Z],
    [-GATE_HALF_W, GATE_BACK_Z, GATE_HALF_W, GATE_BACK_Z],
  ]
}

function closestOnSegment(
  px: number,
  pz: number,
  x1: number,
  z1: number,
  x2: number,
  z2: number,
) {
  const dx = x2 - x1
  const dz = z2 - z1
  const len2 = dx * dx + dz * dz
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (pz - z1) * dz) / len2))
  const qx = x1 + dx * t
  const qz = z1 + dz * t
  return { qx, qz, ox: px - qx, oz: pz - qz }
}

export function hitsFence(x: number, z: number, radius: number) {
  for (const [x1, z1, x2, z2] of fenceRails()) {
    const { ox, oz } = closestOnSegment(x, z, x1, z1, x2, z2)
    if (ox * ox + oz * oz < radius * radius) return true
  }
  return false
}

/** Slide the center out of the rails so a step into wood becomes a step along it. */
export function pushOutOfFence(x: number, z: number, radius: number) {
  let px = x
  let pz = z
  for (let pass = 0; pass < 4; pass++) {
    let moved = false
    for (const [x1, z1, x2, z2] of fenceRails()) {
      const { qx, qz, ox, oz } = closestOnSegment(px, pz, x1, z1, x2, z2)
      const dist = Math.hypot(ox, oz)
      if (dist >= radius) continue
      moved = true
      if (dist < 1e-5) {
        const nx = -Math.sign(qx) || 0
        const nz = -Math.sign(qz) || -1
        const len = Math.hypot(nx, nz) || 1
        px += (nx / len) * radius
        pz += (nz / len) * radius
      } else {
        const k = (radius - dist) / dist
        px += ox * k
        pz += oz * k
      }
    }
    if (!moved) break
  }
  return { x: px, z: pz }
}

export function insideGrass(x: number, z: number) {
  const half = GRASS_HALF
  const radius = GRASS_CORNER
  const inner = Math.max(0, half - radius)
  const ax = Math.abs(x)
  const az = Math.abs(z)
  if (ax <= inner || az <= inner) return ax <= half && az <= half
  const dx = ax - inner
  const dz = az - inner
  return dx * dx + dz * dz <= radius * radius
}

export function clampToGrass(x: number, z: number) {
  const half = GRASS_HALF
  const radius = GRASS_CORNER
  const inner = Math.max(0, half - radius)
  const ax = Math.abs(x)
  const az = Math.abs(z)
  if (ax <= inner || az <= inner) {
    return {
      x: Math.max(-half, Math.min(half, x)),
      z: Math.max(-half, Math.min(half, z)),
    }
  }
  const cx = Math.sign(x) * inner
  const cz = Math.sign(z) * inner
  const dx = x - cx
  const dz = z - cz
  const d = Math.hypot(dx, dz) || 1
  const k = Math.min(1, radius / d)
  return { x: cx + dx * k, z: cz + dz * k }
}

/** Keeps the herder out of pen side walls and deep stream water. */
export function moveHerder(x: number, z: number, level: LevelId = 1) {
  let px = x
  let pz = z
  for (let i = 0; i < 3; i++) {
    const freed = pushOutOfFence(px, pz, FENCE_CLEAR)
    const dry = pushOutOfWater(level, freed.x, freed.z, FENCE_CLEAR)
    if (Math.hypot(dry.x - px, dry.z - pz) < 1e-4) return dry
    px = dry.x
    pz = dry.z
  }
  return { x: px, z: pz }
}

export function placeHerder(x: number, z: number, level: LevelId = 1) {
  let p = clampToGrass(x, z)
  for (let i = 0; i < 3; i++) {
    const freed = pushOutOfFence(p.x, p.z, FENCE_CLEAR)
    const dry = pushOutOfWater(level, freed.x, freed.z, FENCE_CLEAR)
    const next = clampToGrass(dry.x, dry.z)
    if (Math.hypot(next.x - p.x, next.z - p.z) < 1e-4) return next
    p = next
  }
  return p
}
