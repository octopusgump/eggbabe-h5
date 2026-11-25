export type LevelId = 1 | 2 | 3 | 4 | 5 | 6

export type SheepSpawn = {
  x: number
  z: number
  isGolden: boolean
}

export type TreeObstacle = {
  x: number
  z: number
  scale: number
  radius: number
}

export type BumperObstacle = {
  x: number
  z: number
  radius: number
}

export type BoostPad = {
  x: number
  z: number
  halfW: number
  halfD: number
  dirX: number
  dirZ: number
  force: number
}

export type LevelConfig = {
  id: LevelId
  name: string
  shortLabel: string
  hint: string
  herderHome: [number, number]
  hasRiver: boolean
  hasSlope: boolean
  hasKnoll: boolean
  sheep: readonly SheepSpawn[]
  trees: readonly TreeObstacle[]
  bumpers: readonly BumperObstacle[]
  boostPads: readonly BoostPad[]
  starThresholds: readonly [number, number, number]
}

function makeSheep(coords: readonly [number, number][], goldenIndices: readonly number[]): SheepSpawn[] {
  const goldSet = new Set(goldenIndices)
  return coords.map(([x, z], idx) => ({ x, z, isGolden: goldSet.has(idx) }))
}

export const LEVEL_CONFIGS: Record<LevelId, LevelConfig> = {
  // 第 1 关：完全无树木、全护栏、6 只羊（5 白 + 1 黄，满分 8 分）
  1: {
    id: 1,
    name: '晨霜纯冰场',
    shortLabel: '1 · 晨霜纯冰场',
    hint: '方向键/摇杆滑行 · 把自由滑溜的小羊铲进下方大门',
    herderHome: [0, -4.6],
    hasRiver: false,
    hasSlope: false,
    hasKnoll: false,
    sheep: makeSheep(
      [
        [-2.8, -0.4],
        [2.6, -0.6],
        [-1.4, 1.5],
        [1.5, 1.4],
        [0.0, -1.6],
        [0.1, 2.3],
      ],
      [0],
    ),
    trees: [],
    bumpers: [],
    boostPads: [],
    starThresholds: [3, 5, 6],
  },

  // 第 2 关：雪墩弹弹场 — 3 个弹性碰碰雪墩，8 只羊（7 白 + 1 黄，满分 10 分）
  2: {
    id: 2,
    name: '雪墩弹弹场',
    shortLabel: '2 · 雪墩弹弹场',
    hint: '借冰面弹弹雪墩折返反弹，把 8 只小羊弹进大门',
    herderHome: [0, -5.0],
    hasRiver: false,
    hasSlope: false,
    hasKnoll: false,
    sheep: makeSheep(
      [
        [-3.4, -1.2],
        [3.4, -1.2],
        [-2.2, 1.8],
        [2.2, 1.8],
        [0.0, -2.2],
        [-1.0, 0.2],
        [1.2, 0.2],
        [0.0, 2.7],
      ],
      [0],
    ),
    trees: [],
    bumpers: [
      { x: -3.1, z: 0.4, radius: 0.72 },
      { x: 3.1, z: 0.4, radius: 0.72 },
      { x: 0.0, z: -0.6, radius: 0.76 },
    ],
    boostPads: [],
    starThresholds: [4, 6, 8],
  },

  // 第 3 关：霜林松柏场 — 4 棵带碰撞体积的积雪松树，10 只羊（8 白 + 2 黄，满分 14 分）
  3: {
    id: 3,
    name: '霜林松柏场',
    shortLabel: '3 · 霜林松柏场',
    hint: '绕开积雪松树甩尾卡位，拦截 2 只高速金绒羊',
    herderHome: [0, -5.2],
    hasRiver: false,
    hasSlope: false,
    hasKnoll: false,
    sheep: makeSheep(
      [
        [-3.6, -2.0],
        [3.6, -2.0],
        [-1.8, -0.8],
        [1.8, -0.8],
        [-3.2, 1.8],
        [3.2, 1.8],
        [-0.9, 1.2],
        [0.9, 1.2],
        [0.0, -2.6],
        [0.0, 2.7],
      ],
      [0, 1],
    ),
    trees: [
      { x: -3.5, z: -3.4, scale: 0.96, radius: 0.62 },
      { x: 3.5, z: -3.4, scale: 0.96, radius: 0.62 },
      { x: -3.8, z: 2.8, scale: 0.92, radius: 0.6 },
      { x: 3.8, z: 2.8, scale: 0.92, radius: 0.6 },
    ],
    bumpers: [],
    boostPads: [],
    starThresholds: [5, 8, 11],
  },

  // 第 4 关：暖阳冰溪坡 — 北坡加速俯冲 + 冰溪双浅滩，12 只羊（10 白 + 2 黄，满分 16 分）
  4: {
    id: 4,
    name: '暖阳冰溪坡',
    shortLabel: '4 · 暖阳冰溪坡',
    hint: '顺北坡俯冲加速，过双浅滩把 12 只羊推入大门',
    herderHome: [0, -5.6],
    hasRiver: true,
    hasSlope: true,
    hasKnoll: false,
    sheep: makeSheep(
      [
        [-3.4, -3.2],
        [3.4, -3.0],
        [-1.6, -3.6],
        [1.7, -3.4],
        [-0.1, -2.5],
        [-2.8, -2.2],
        [2.6, -2.0],
        [-3.0, 2.3],
        [3.0, 2.4],
        [-1.1, 2.8],
        [1.2, 2.6],
        [0.0, 1.8],
      ],
      [0, 1],
    ),
    trees: [],
    bumpers: [],
    boostPads: [],
    starThresholds: [6, 9, 12],
  },

  // 第 5 关：星光加速道 — 暖金加速滑道助推连杀，14 只羊（11 白 + 3 黄，满分 20 分）
  5: {
    id: 5,
    name: '星光加速道',
    shortLabel: '5 · 星光加速道',
    hint: '把四散小羊赶上暖金加速冰道，触发连环多杀！',
    herderHome: [0, -5.4],
    hasRiver: false,
    hasSlope: false,
    hasKnoll: false,
    sheep: makeSheep(
      [
        [-4.4, -2.6],
        [4.4, -2.6],
        [0.0, -2.4],
        [-2.6, -1.6],
        [2.6, -1.6],
        [-4.2, 0.4],
        [4.2, 0.4],
        [-1.8, 0.2],
        [1.8, 0.2],
        [-3.4, 2.4],
        [3.4, 2.4],
        [-1.2, 2.2],
        [1.2, 2.2],
        [0.0, 1.2],
      ],
      [0, 1, 2],
    ),
    trees: [],
    bumpers: [],
    boostPads: [
      { x: -4.2, z: 0.4, halfW: 0.95, halfD: 2.5, dirX: 0.32, dirZ: 0.95, force: 16.5 },
      { x: 4.2, z: 0.4, halfW: 0.95, halfD: 2.5, dirX: -0.32, dirZ: 0.95, force: 16.5 },
      { x: 0.0, z: -1.4, halfW: 1.05, halfD: 1.5, dirX: 0, dirZ: 1, force: 15.0 },
    ],
    starThresholds: [7, 11, 15],
  },

  // 第 6 关：金绒嘉年华 — 中央微雪丘 + 双弹弹柱 + 4 只黄羊狂欢，16 只羊（12 白 + 4 黄，满分 24 分）
  6: {
    id: 6,
    name: '金绒嘉年华',
    shortLabel: '6 · 金绒嘉年华',
    hint: '终极狂欢！4 只金绒领头羊满场飞滑，暴击 +3 ✦！',
    herderHome: [0, -5.6],
    hasRiver: false,
    hasSlope: false,
    hasKnoll: true,
    sheep: makeSheep(
      [
        [-4.4, -2.8],
        [4.4, -2.8],
        [-3.8, 2.2],
        [3.8, 2.2],
        [-2.2, -3.2],
        [2.2, -3.2],
        [0.0, -2.6],
        [-4.5, -0.2],
        [4.5, -0.2],
        [-2.0, -0.8],
        [2.0, -0.8],
        [-1.8, 1.4],
        [1.8, 1.4],
        [0.0, 0.5],
        [-0.9, 2.9],
        [0.9, 2.9],
      ],
      [0, 1, 2, 3],
    ),
    trees: [],
    bumpers: [
      { x: -3.2, z: -0.6, radius: 0.72 },
      { x: 3.2, z: -0.6, radius: 0.72 },
    ],
    boostPads: [
      { x: 0.0, z: 2.4, halfW: 1.1, halfD: 1.25, dirX: 0, dirZ: 1, force: 14.5 },
    ],
    starThresholds: [8, 13, 18],
  },
}

export function levelConfig(level: LevelId): LevelConfig {
  return LEVEL_CONFIGS[level]
}

export function computeStarTier(level: LevelId, score: number): 0 | 1 | 2 | 3 {
  const [s1, s2, s3] = LEVEL_CONFIGS[level].starThresholds
  if (score >= s3) return 3
  if (score >= s2) return 2
  if (score >= s1) return 1
  return 0
}

export function maxLevelScore(level: LevelId): number {
  return LEVEL_CONFIGS[level].sheep.reduce((acc, s) => acc + (s.isGolden ? 3 : 1), 0)
}

/** Gentle east-west stream for Level 4. */
export const RIVER: readonly [number, number][] = [
  [-7.4, 0.85],
  [-4.2, 0.35],
  [-1.2, 0.72],
  [1.6, 0.28],
  [4.4, 0.62],
  [7.4, 0.32],
]

export const WATER_HALF = 0.7

export const FORDS = [
  { x: -3.4, half: 1.15 },
  { x: 3.5, half: 1.15 },
] as const

export const SLOPE_RISE = 2.1
export const SLOPE_DRIFT = 0.48

export function hasRiver(level: LevelId) {
  return LEVEL_CONFIGS[level].hasRiver
}

export function hasTerrainRelief(level: LevelId) {
  const cfg = LEVEL_CONFIGS[level]
  return cfg.hasRiver || cfg.hasSlope || cfg.hasKnoll
}

export function sheepLayout(level: LevelId): readonly SheepSpawn[] {
  return LEVEL_CONFIGS[level].sheep
}

export function herderHome(level: LevelId) {
  return LEVEL_CONFIGS[level].herderHome
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

export function bankHeight(z: number) {
  return smoothstep(-0.2, -5.2, z) * SLOPE_RISE
}

function centerKnoll(x: number, z: number) {
  const d = Math.hypot(x, z - 0.1)
  return (1 - smoothstep(0.6, 2.9, d)) * 0.68
}

export function groundHeight(level: LevelId, x: number, z: number) {
  const cfg = LEVEL_CONFIGS[level]
  if (!cfg.hasSlope && !cfg.hasRiver && !cfg.hasKnoll) return 0
  let y = 0
  if (cfg.hasSlope) y += bankHeight(z)
  if (cfg.hasKnoll) y += centerKnoll(x, z)
  if (cfg.hasRiver) {
    const hit = riverClosest(x, z)
    const reach = 0.98
    if (hit.dist < reach && !inFord(hit.x)) {
      const t = 1 - hit.dist / reach
      y -= t * t * 0.22
    }
  }
  return y
}

export function penLift(_level: LevelId, _index: number) {
  return 0
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

export function slopeDrift(level: LevelId, x: number, z: number) {
  const cfg = LEVEL_CONFIGS[level]
  if (!cfg.hasSlope || z > -1.05) return 0
  if (cfg.hasRiver) {
    const hit = riverClosest(x, z)
    if (hit.dist < 1.25 && inFord(hit.x)) return 0
  }
  return SLOPE_DRIFT * smoothstep(-1.05, -1.7, z)
}

export type ObstacleHit = {
  x: number
  z: number
  vx: number
  vz: number
  hitKind: 'none' | 'tree' | 'bumper'
  bumperIndex: number
  nx: number
  nz: number
}

/** Resolves solid collision against Level 3 pine trees and high-bounce Level 2/6 snow bumpers. */
export function resolveCircleObstacles(
  level: LevelId,
  x: number,
  z: number,
  vx: number,
  vz: number,
  entityRadius: number,
): ObstacleHit {
  const cfg = LEVEL_CONFIGS[level]
  let px = x
  let pz = z
  let nvx = vx
  let nvz = vz
  let hitKind: 'none' | 'tree' | 'bumper' = 'none'
  let bumperIndex = -1
  let outNx = 0
  let outNz = 0

  for (let i = 0; i < cfg.bumpers.length; i++) {
    const b = cfg.bumpers[i]
    const dx = px - b.x
    const dz = pz - b.z
    const dist = Math.hypot(dx, dz)
    const minD = b.radius + entityRadius
    if (dist < minD) {
      const nx = dist > 1e-4 ? dx / dist : 0
      const nz = dist > 1e-4 ? dz / dist : 1
      px = b.x + nx * (minD + 0.02)
      pz = b.z + nz * (minD + 0.02)
      const vn = nvx * nx + nvz * nz
      if (vn < 0) {
        // High-elastic pinball bumper kick!
        const bounce = Math.max(3.6, -vn * 1.24)
        nvx += nx * (-vn + bounce)
        nvz += nz * (-vn + bounce)
      } else {
        nvx += nx * 2.8
        nvz += nz * 2.8
      }
      hitKind = 'bumper'
      bumperIndex = i
      outNx = nx
      outNz = nz
    }
  }

  for (const t of cfg.trees) {
    const dx = px - t.x
    const dz = pz - t.z
    const dist = Math.hypot(dx, dz)
    const minD = t.radius + entityRadius
    if (dist < minD) {
      const nx = dist > 1e-4 ? dx / dist : 0
      const nz = dist > 1e-4 ? dz / dist : 1
      px = t.x + nx * (minD + 0.02)
      pz = t.z + nz * (minD + 0.02)
      const vn = nvx * nx + nvz * nz
      if (vn < 0) {
        nvx -= (1 + 0.62) * vn * nx
        nvz -= (1 + 0.62) * vn * nz
      }
      if (hitKind === 'none') {
        hitKind = 'tree'
        outNx = nx
        outNz = nz
      }
    }
  }

  return { x: px, z: pz, vx: nvx, vz: nvz, hitKind, bumperIndex, nx: outNx, nz: outNz }
}

/** Samples Level 5/6 warm-gold starlight ice boost pads. */
export function sampleBoostPad(
  level: LevelId,
  x: number,
  z: number,
): { active: boolean; fx: number; fz: number } {
  const pads = LEVEL_CONFIGS[level].boostPads
  for (const pad of pads) {
    if (Math.abs(x - pad.x) <= pad.halfW && Math.abs(z - pad.z) <= pad.halfD) {
      const len = Math.hypot(pad.dirX, pad.dirZ) || 1
      return {
        active: true,
        fx: (pad.dirX / len) * pad.force,
        fz: (pad.dirZ / len) * pad.force,
      }
    }
  }
  return { active: false, fx: 0, fz: 0 }
}
