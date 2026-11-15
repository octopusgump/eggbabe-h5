import { ISLAND_HALF } from './constants'
import { pushOutOfWater, type LevelId } from './levels'

/** L-shaped rail in each corner. The open side faces the middle of the meadow. */
export const PEN_ARM = 2.2
export const PEN_CORNERS: readonly [number, number][] = [
  [7.55, 7.55],
  [-7.55, 7.55],
  [7.55, -7.55],
  [-7.55, -7.55],
]

/** Plan of the grass slab. The herder's center stays this far in from the rim. */
const SLAB_RADIUS = 0.62
const BODY_MARGIN = 0.28
export const GRASS_HALF = ISLAND_HALF - BODY_MARGIN
export const GRASS_CORNER = Math.max(0.04, SLAB_RADIUS - BODY_MARGIN)

/** Clearance from a rail centerline. Wood is thin, so the rest of the grass stays open. */
export const FENCE_CLEAR = 0.28

export function fenceRails(): [number, number, number, number][] {
  const segs: [number, number, number, number][] = []
  for (const [cx, cz] of PEN_CORNERS) {
    const sx = Math.sign(cx)
    const sz = Math.sign(cz)
    segs.push([cx - sx * PEN_ARM, cz, cx, cz])
    segs.push([cx, cz - sz * PEN_ARM, cx, cz])
  }
  return segs
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
        const nz = -Math.sign(qz) || 0
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

/** Every grass point the herder can stand on, including inside the pens. */
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
