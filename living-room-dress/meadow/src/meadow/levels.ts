export type LevelId = 1 | 2 | 3

export type LevelMeta = {
  id: LevelId
  name: string
  hint: string
}

export const LEVEL_META: Record<LevelId, LevelMeta> = {
  1: { id: 1, name: '晨霜滑冰场', hint: '方向键/摇杆滑行 · 反向急刹甩尾 · 空格滑冲' },
  2: { id: 2, name: '暖阳冰溪坡', hint: '借北坡惯性俯冲滑行，过浅滩把羊群铲进木圈' },
  3: { id: 3, name: '双冰暖丘谷', hint: '绕雪丘漂移连撞，抓紧金绒领头羊得 3 倍分' },
}

/** Level 1: classic flat meadow. */
const LEVEL1_SHEEP: readonly [number, number][] = [
  [-3.4, 2.2],
  [-1.6, 1.1],
  [0.2, 1.8],
  [1.8, 0.4],
  [-0.5, -0.4],
  [0.9, -1.5],
  [3.0, -2.0],
  [-2.8, -1.3],
  [-1.1, -2.5],
  [2.4, 2.3],
  [3.6, 0.2],
]

/** Level 2: five sheep on the south flat, six on the north slope. */
const LEVEL2_SHEEP: readonly [number, number][] = [
  [-2.8, 2.2],
  [-1.0, 3.0],
  [0.6, 1.6],
  [2.4, 2.6],
  [1.4, 3.4],
  [-3.2, -2.6],
  [-1.4, -3.5],
  [0.2, -2.4],
  [2.0, -3.3],
  [3.4, -2.5],
  [-0.3, -4.4],
]

/** Level 3: gentle central knoll + river + north bank, sheep scattered high and low. */
const LEVEL3_SHEEP: readonly [number, number][] = [
  [-3.6, 3.1],
  [-1.2, 3.6],
  [1.5, 3.2],
  [3.5, 2.4],
  [0.0, 2.2],
  [-3.5, -2.2],
  [-1.8, -3.8],
  [0.1, -2.8],
  [2.2, -3.6],
  [3.6, -2.0],
  [-0.2, -4.7],
]

const HOMES: Record<LevelId, [number, number]> = {
  1: [0, -4.4],
  2: [0, 4.6],
  3: [0, 4.9],
}

/** Gentle east-west stream. North bank rises; the south side stays flat or knolled. */
export const RIVER: readonly [number, number][] = [
  [-7.4, 0.85],
  [-4.2, 0.35],
  [-1.2, 0.72],
  [1.6, 0.28],
  [4.4, 0.62],
  [7.4, 0.32],
]

/** Deep water, measured from the stream center. Fords are gaps in this. */
export const WATER_HALF = 0.7

export const FORDS = [
  { x: -3.4, half: 1.1 },
  { x: 3.5, half: 1.1 },
] as const

export const SLOPE_RISE = 2.2
/** Southward slide on the north bank, slower than a sheep's run. */
export const SLOPE_DRIFT = 0.45

const NORTH_PADS = [
  [7.55, -7.55],
  [-7.55, -7.55],
] as const
const PAD_ARM = 2.2

export function hasRiver(level: LevelId) {
  return level === 2 || level === 3
}

export function sheepLayout(level: LevelId) {
  if (level === 1) return LEVEL1_SHEEP
  if (level === 2) return LEVEL2_SHEEP
  return LEVEL3_SHEEP
}

export function herderHome(level: LevelId) {
  return HOMES[level]
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

export function inFord(x: number) {
  return FORDS.some((ford) => Math.abs(x - ford.x) <= ford.half)
}

export function riverClosest(x: number, z: number) {
  let bestX = RIVER[0][0]
  let bestZ = RIVER[0][1]
  let best = Infinity
  for (let i = 0; i < RIVER.length - 1; i++) {
    const [x1, z1] = RIVER[i]
    const [x2, z2] = RIVER[i + 1]
    const dx = x2 - x1
    const dz = z2 - z1
    const len2 = dx * dx + dz * dz
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - x1) * dx + (z - z1) * dz) / len2))
    const qx = x1 + dx * t
    const qz = z1 + dz * t
    const dist = Math.hypot(x - qx, z - qz)
    if (dist < best) {
      best = dist
      bestX = qx
      bestZ = qz
    }
  }
  return { x: bestX, z: bestZ, dist: best }
}

/** Height of the bank if the stream had not cut a channel. North (negative z) is high. */
export function bankHeight(z: number) {
  return smoothstep(-0.2, -5.2, z) * SLOPE_RISE
}

function northPad(x: number, z: number) {
  let best = 0
  for (const [cx, cz] of NORTH_PADS) {
    const px = cx - Math.sign(cx) * PAD_ARM * 0.46
    const pz = cz - Math.sign(cz) * PAD_ARM * 0.46
    const half = 1.28
    const dx = Math.max(Math.abs(x - px) - half, 0)
    const dz = Math.max(Math.abs(z - pz) - half, 0)
    const blend = 1 - smoothstep(0, 0.55, Math.hypot(dx, dz))
    if (blend > best) best = blend
  }
  return best
}

/** Gentle south-central clay knoll for Level 3. */
function southKnoll(x: number, z: number) {
  const d = Math.hypot(x, z - 3.35)
  return (1 - smoothstep(0.6, 2.75, d)) * 0.78
}

export function groundHeight(level: LevelId, x: number, z: number) {
  if (level === 1) return 0
  const slope = bankHeight(z)
  const knoll = level === 3 ? southKnoll(x, z) : 0
  const hit = riverClosest(x, z)
  let groove = 0
  const reach = 0.98
  if (hit.dist < reach && !inFord(hit.x)) {
    const t = 1 - hit.dist / reach
    groove = t * t * 0.22
  }
  const carved = slope + knoll - groove
  const pad = northPad(x, z)
  return carved * (1 - pad) + SLOPE_RISE * pad
}

/** How far to lift a corner pen so its floor sits on the ground. */
export function penLift(level: LevelId, index: number) {
  if (level === 1) return 0
  return index === 2 || index === 3 ? SLOPE_RISE : 0
}

export function hitsWater(level: LevelId, x: number, z: number, radius: number) {
  if (!hasRiver(level)) return false
  const hit = riverClosest(x, z)
  if (inFord(hit.x)) return false
  return hit.dist < WATER_HALF + radius
}

export function pushOutOfWater(level: LevelId, x: number, z: number, radius: number) {
  if (!hasRiver(level)) return { x, z }
  let px = x
  let pz = z
  const limit = WATER_HALF + radius
  for (let pass = 0; pass < 3; pass++) {
    const hit = riverClosest(px, pz)
    if (inFord(hit.x) || hit.dist >= limit) break
    let ox = px - hit.x
    let oz = pz - hit.z
    let dist = hit.dist
    if (dist < 1e-5) {
      ox = 0
      oz = 1
      dist = 1
    }
    const k = (limit - dist) / dist
    px += ox * k
    pz += oz * k
  }
  return { x: px, z: pz }
}

/** Extra southward speed for a sheep standing on the north slope. */
export function slopeDrift(level: LevelId, x: number, z: number) {
  if (!hasRiver(level) || z > -1.05) return 0
  const hit = riverClosest(x, z)
  if (hit.dist < 1.25 && inFord(hit.x)) return 0
  for (const [cx, cz] of NORTH_PADS) {
    const mx = cx - Math.sign(cx) * PAD_ARM * 0.62
    const mz = cz - Math.sign(cz) * PAD_ARM * 0.62
    if ((x - mx) ** 2 + (z - mz) ** 2 < 2.8 * 2.8) return 0
  }
  const factor = level === 3 ? SLOPE_DRIFT * 1.15 : SLOPE_DRIFT
  return factor * smoothstep(-1.05, -1.7, z)
}
