import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { ISLAND_HALF } from './constants'
import {
  bankHeight,
  FORDS,
  groundHeight,
  inFord,
  RIVER,
  riverClosest,
  type LevelId,
} from './levels'
import { ceramic, clay, felt, oakWood } from './materials'
import { isInsideCornerPen } from './pen'
import { ribbonMesh } from './ribbon'

const GRASS_BASE = 0xb5cf7a
const GRASS_ACCENT = 0x9fba65
const SOIL_WARM = 0xb18355
const OAK_TRIM = 0xc39666
const PEBBLE_COLORS = [0xe2d2b5, 0xd8c4a3, 0xe8dac0]
const DAISY_PETAL = 0xfffcf2
const DAISY_CENTER = 0xf0c558
const BLUSH_BUD = 0xf0c6b5

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const PATH: [number, number][] = [
  [0.4, 6.8],
  [2.1, 4.4],
  [3.2, 1.9],
  [2.9, -0.6],
  [1.9, -3.1],
  [0.6, -5.4],
  [-0.5, -6.9],
]

function onRibbon(x: number, z: number, pts: [number, number][], half: number) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, z1] = pts[i]
    const [x2, z2] = pts[i + 1]
    const dx = x2 - x1
    const dz = z2 - z1
    const len2 = dx * dx + dz * dz
    const t = Math.max(0, Math.min(1, ((x - x1) * dx + (z - z1) * dz) / len2))
    const px = x1 + dx * t
    const pz = z1 + dz * t
    if ((x - px) ** 2 + (z - pz) ** 2 < half * half) return true
  }
  return false
}

/** Smooth 3D pebble stepping stones nestled into the felt lawn */
function addPebblePath(island: THREE.Group, rng: () => number) {
  const curve = new THREE.CatmullRomCurve3(
    PATH.map(([x, z]) => new THREE.Vector3(x, 0, z)),
  )
  const samples = 21
  for (let i = 0; i < samples; i++) {
    const t = i / (samples - 1)
    const pt = curve.getPoint(t)
    const tangent = curve.getTangent(t)
    const perpX = -tangent.z
    const perpZ = tangent.x
    const side = (i % 2 === 0 ? 1 : -1) * (0.16 + rng() * 0.22)
    const sx = pt.x + perpX * side
    const sz = pt.z + perpZ * side
    const rx = 0.42 + rng() * 0.24
    const rz = 0.34 + rng() * 0.2
    const stone = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1.08, 0.12, 14),
      clay(PEBBLE_COLORS[i % PEBBLE_COLORS.length], 0.9),
    )
    stone.scale.set(rx, 1, rz)
    stone.position.set(sx, 0.035, sz)
    stone.rotation.y = Math.atan2(-tangent.z, tangent.x) + (rng() - 0.5) * 0.5
    stone.castShadow = true
    stone.receiveShadow = true
    island.add(stone)

    // Occasional tiny companion pebble beside the main stone
    if (rng() > 0.42) {
      const mini = new THREE.Mesh(
        new THREE.CylinderGeometry(1, 1.06, 0.09, 10),
        clay(PEBBLE_COLORS[(i + 1) % PEBBLE_COLORS.length], 0.92),
      )
      const mr = 0.14 + rng() * 0.08
      mini.scale.set(mr * 1.15, 1, mr)
      mini.position.set(
        sx - perpX * side * 1.6 + (rng() - 0.5) * 0.25,
        0.025,
        sz - perpZ * side * 1.6 + (rng() - 0.5) * 0.25,
      )
      mini.receiveShadow = true
      island.add(mini)
    }
  }
}

/** Plump handmade felt grass sprouts & miniature cream daisies (replacing spiky dark cones) */
function addMeadowFlora(island: THREE.Group, rng: () => number, level: LevelId = 1) {
  const placed: [number, number][] = []
  const sproutGeo = new THREE.SphereGeometry(1, 10, 8)
  const sproutMatA = felt(0x9ec068, 0x8eb058, 1, 0.02)
  const sproutMatB = felt(0xadc974, 0x9ab962, 1, 0.02)

  // 72 soft plump felt grass tufts
  const tuftCount = 72
  for (let i = 0; placed.length < tuftCount && i < tuftCount * 14; i++) {
    const x = (rng() - 0.5) * ISLAND_HALF * 1.84
    const z = (rng() - 0.5) * ISLAND_HALF * 1.84
    if (isInsideCornerPen(x, z)) continue
    if (level === 1 && onRibbon(x, z, PATH, 1.05)) continue
    if (level !== 1 && riverClosest(x, z).dist < 1.15) continue
    if (placed.some(([px, pz]) => (x - px) ** 2 + (z - pz) ** 2 < 1.15 * 1.15)) continue
    placed.push([x, z])

    const y = level !== 1 ? groundHeight(level, x, z) : 0.02
    const tuft = new THREE.Group()
    const mat = rng() > 0.45 ? sproutMatA : sproutMatB
    const blades = 3
    for (let b = 0; b < blades; b++) {
      const ang = (b / blades) * Math.PI * 2 + rng() * 0.6
      const blade = new THREE.Mesh(sproutGeo, mat)
      const h = 0.09 + rng() * 0.06
      const w = 0.045 + rng() * 0.02
      blade.scale.set(w, h, w)
      blade.position.set(Math.cos(ang) * 0.055, h * 0.72, Math.sin(ang) * 0.055)
      blade.rotation.z = (rng() - 0.5) * 0.35
      blade.rotation.x = (rng() - 0.5) * 0.35
      tuft.add(blade)
    }
    tuft.position.set(x, y, z)
    island.add(tuft)
  }

  // 26 tiny cream & butter-yellow daisies scattered near edges and meadows
  const petalMat = clay(DAISY_PETAL, 0.85)
  const peachMat = clay(BLUSH_BUD, 0.85)
  const centerMat = clay(DAISY_CENTER, 0.82)
  const petalGeo = new THREE.SphereGeometry(0.052, 8, 6)
  const centerGeo = new THREE.SphereGeometry(0.046, 8, 6)
  let flowers = 0
  for (let i = 0; flowers < 26 && i < 360; i++) {
    const x = (rng() - 0.5) * ISLAND_HALF * 1.82
    const z = (rng() - 0.5) * ISLAND_HALF * 1.82
    if (isInsideCornerPen(x, z)) continue
    if (level === 1 && onRibbon(x, z, PATH, 0.95)) continue
    if (level !== 1 && riverClosest(x, z).dist < 1.15) continue
    // Prefer gentle perimeter & pockets so the middle feels open and calm
    const edgeBias = Math.max(Math.abs(x), Math.abs(z))
    if (edgeBias < 2.6 && rng() < 0.55) continue

    const y = level !== 1 ? groundHeight(level, x, z) : 0.03
    const f = new THREE.Group()
    const pMat = rng() > 0.25 ? petalMat : peachMat
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * Math.PI * 2
      const petal = new THREE.Mesh(petalGeo, pMat)
      petal.scale.set(1.1, 0.52, 0.9)
      petal.position.set(Math.cos(a) * 0.068, 0.05, Math.sin(a) * 0.068)
      f.add(petal)
    }
    const core = new THREE.Mesh(centerGeo, centerMat)
    core.scale.set(1, 0.65, 1)
    core.position.y = 0.068
    f.add(core)
    const s = 0.85 + rng() * 0.5
    f.scale.setScalar(s)
    f.position.set(x, y, z)
    island.add(f)
    flowers++
  }
}

/** Decorative warm clay pebbles tucked along the island base rim */
function addRimAccents(island: THREE.Group, rng: () => number, level: LevelId) {
  const half = ISLAND_HALF
  const pebbleGeo = new THREE.SphereGeometry(1, 10, 8)
  const stoneMats = [clay(0xd7cbb7, 0.9), clay(0xc7b59a, 0.92), clay(0xe3d8c6, 0.88)]
  const mossMat = felt(0x95b762, 0x83a650, 1, 0.025)
  for (let i = 0; i < 24; i++) {
    const side = i % 4
    const u = (rng() - 0.5) * half * 1.68
    let x = half + 0.04
    let z = u
    if (side === 1) {
      x = -half - 0.04
      z = u
    } else if (side === 2) {
      x = u
      z = half + 0.04
    } else if (side === 3) {
      x = u
      z = -half - 0.04
    }
    const yTop = level !== 1 ? groundHeight(level, Math.max(-half, Math.min(half, x)), Math.max(-half, Math.min(half, z))) : 0
    const isMoss = rng() > 0.58
    const m = new THREE.Mesh(pebbleGeo, isMoss ? mossMat : stoneMats[i % stoneMats.length])
    const r = 0.14 + rng() * 0.14
    m.scale.set(r * 1.15, r * 0.72, r * 1.05)
    m.position.set(x, yTop - 0.38 - rng() * 0.68, z)
    island.add(m)
  }
}

function addWater(island: THREE.Group) {
  const samples: [number, number][] = []
  for (let i = 0; i < RIVER.length - 1; i++) {
    const [x1, z1] = RIVER[i]
    const [x2, z2] = RIVER[i + 1]
    const len = Math.hypot(x2 - x1, z2 - z1)
    const steps = Math.max(1, Math.round(len / 0.32))
    for (let s = 0; s < steps; s++) {
      const t = s / steps
      samples.push([x1 + (x2 - x1) * t, z1 + (z2 - z1) * t])
    }
  }
  const last = RIVER[RIVER.length - 1]
  samples.push([last[0], last[1]])

  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x99cac6,
    roughness: 0.24,
    metalness: 0.04,
    transparent: true,
    opacity: 0.92,
  })

  let run: [number, number][] = []
  const flush = () => {
    if (run.length < 2) {
      run = []
      return
    }
    const mesh = ribbonMesh(run, 1.56, 0x99cac6, 0)
    mesh.material = waterMat
    const pos = mesh.geometry.getAttribute('position')
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, bankHeight(pos.getZ(i)) - 0.08)
    }
    pos.needsUpdate = true
    mesh.geometry.computeVertexNormals()
    island.add(mesh)
    run = []
  }
  for (const [x, z] of samples) {
    if (inFord(x)) flush()
    else run.push([x, z])
  }
  flush()

  for (const ford of FORDS) {
    for (const ox of [-0.58, 0, 0.58]) {
      const hit = riverClosest(ford.x + ox, 0.5)
      const stone = new THREE.Mesh(
        new THREE.CylinderGeometry(0.24, 0.28, 0.09, 12),
        clay(0xebe2d0, 0.88),
      )
      stone.position.set(hit.x, bankHeight(hit.z) + 0.045, hit.z)
      stone.castShadow = true
      stone.receiveShadow = true
      island.add(stone)
    }
  }
}

function createSlopeIsland(level: LevelId) {
  const island = new THREE.Group()
  const seg = 64
  const half = ISLAND_HALF
  const n = seg + 1
  const baseY = -1.65
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  const point = (i: number, j: number) => {
    const x = -half + (i / seg) * half * 2
    const z = -half + (j / seg) * half * 2
    return { x, z, y: groundHeight(level, x, z) }
  }
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const p = point(i, j)
      positions.push(p.x, p.y, p.z)
      uvs.push(i / seg, j / seg)
    }
  }
  const vert = (i: number, j: number) => j * n + i
  for (let j = 0; j < seg; j++) {
    for (let i = 0; i < seg; i++) {
      const a = vert(i, j)
      const b = vert(i + 1, j)
      const c = vert(i, j + 1)
      const d = vert(i + 1, j + 1)
      indices.push(a, c, b, c, d, b)
    }
  }
  const topGeo = new THREE.BufferGeometry()
  topGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  topGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  topGeo.setIndex(indices)
  topGeo.computeVertexNormals()
  const top = new THREE.Mesh(topGeo, felt(GRASS_BASE, GRASS_ACCENT, 5, 0.04))
  top.receiveShadow = true
  island.add(top)

  // Warm oak / terracotta diorama skirt
  const edge: [number, number][] = []
  for (let i = 0; i < n; i++) edge.push([i, 0])
  for (let j = 1; j < n; j++) edge.push([seg, j])
  for (let i = seg - 1; i >= 0; i--) edge.push([i, seg])
  for (let j = seg - 1; j >= 1; j--) edge.push([0, j])
  const skirtPos: number[] = []
  const skirtUv: number[] = []
  for (let idx = 0; idx < edge.length; idx++) {
    const [i, j] = edge[idx]
    const p = point(i, j)
    skirtPos.push(p.x, p.y, p.z, p.x, baseY, p.z)
    const u = idx / edge.length
    skirtUv.push(u * 4, 1, u * 4, 0)
  }
  const skirtIdx: number[] = []
  for (let e = 0; e < edge.length; e++) {
    const e2 = (e + 1) % edge.length
    const a = e * 2
    const b = a + 1
    const c = e2 * 2
    const d = c + 1
    skirtIdx.push(a, b, c, c, b, d)
  }
  const skirtGeo = new THREE.BufferGeometry()
  skirtGeo.setAttribute('position', new THREE.Float32BufferAttribute(skirtPos, 3))
  skirtGeo.setAttribute('uv', new THREE.Float32BufferAttribute(skirtUv, 2))
  skirtGeo.setIndex(skirtIdx)
  skirtGeo.computeVertexNormals()
  const skirt = new THREE.Mesh(skirtGeo, oakWood(SOIL_WARM, 3))
  skirt.castShadow = true
  skirt.receiveShadow = true
  island.add(skirt)

  // Warm oak bottom tray lip
  const plinth = new THREE.Mesh(
    new RoundedBoxGeometry(half * 2 + 0.14, 0.36, half * 2 + 0.14, 6, 0.22),
    oakWood(OAK_TRIM, 3),
  )
  plinth.position.y = baseY - 0.12
  plinth.castShadow = true
  plinth.receiveShadow = true
  island.add(plinth)

  addWater(island)
  const rng = mulberry32(level === 3 ? 37 : 23)
  addMeadowFlora(island, rng, level)
  return island
}

export function createIsland(level: LevelId = 1): THREE.Group {
  if (level !== 1) return createSlopeIsland(level)
  const island = new THREE.Group()
  const w = ISLAND_HALF * 2
  const d = ISLAND_HALF * 2

  // Thick warm oak diorama base slab echoing EggBabe oak furniture
  const baseSlab = new THREE.Mesh(
    new RoundedBoxGeometry(w - 0.08, 1.38, d - 0.08, 8, 0.56),
    oakWood(SOIL_WARM, 3),
  )
  baseSlab.position.y = -0.82
  baseSlab.castShadow = true
  baseSlab.receiveShadow = true
  island.add(baseSlab)

  // Warm oak bottom tray lip
  const trayLip = new THREE.Mesh(
    new RoundedBoxGeometry(w + 0.12, 0.28, d + 0.12, 6, 0.2),
    oakWood(OAK_TRIM, 3),
  )
  trayLip.position.y = -1.46
  trayLip.castShadow = true
  trayLip.receiveShadow = true
  island.add(trayLip)

  // Plump overhanging wool-felt grass cushion top
  const grassTop = new THREE.Mesh(
    new RoundedBoxGeometry(w + 0.18, 0.38, d + 0.18, 8, 0.24),
    felt(GRASS_BASE, GRASS_ACCENT, 5, 0.048),
  )
  grassTop.position.y = -0.17
  grassTop.castShadow = true
  grassTop.receiveShadow = true
  island.add(grassTop)

  const rng = mulberry32(19)
  addPebblePath(island, rng)
  addMeadowFlora(island, rng, 1)

  void ceramic
  void addRimAccents
  return island
}