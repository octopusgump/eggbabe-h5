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
import { clay } from './materials'
import { isInsideCornerPen } from './pen'
import { ribbonMesh } from './ribbon'

const GRASS = 0xc9df9a
const SIDE = 0xa9c56e
/** Close pair. Both sit a step under the lawn, so the field stays calm EggBabe sage. */
const TUFT_A = 0x86ab58
const TUFT_B = 0x7aa04d

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
  [0.4, 7.2],
  [2.2, 4.6],
  [3.4, 2.0],
  [3.1, -0.6],
  [2.0, -3.2],
  [0.6, -5.8],
  [-0.6, -7.4],
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

function addTufts(island: THREE.Group, rng: () => number, level: LevelId = 1) {
  const count = 420
  const gap = 0.58
  const geo = new THREE.ConeGeometry(1, 1, 5)
  const make = (color: number, n: number) => {
    const mesh = new THREE.InstancedMesh(geo, clay(color), n)
    mesh.castShadow = false
    mesh.receiveShadow = false
    return mesh
  }
  const a = make(TUFT_A, count)
  const b = make(TUFT_B, Math.floor(count * 0.28))
  const dummy = new THREE.Object3D()
  const placed: [number, number][] = []
  let ia = 0
  let ib = 0
  const limitB = b.count

  for (let i = 0; ia + ib < count && i < count * 12; i++) {
    const x = (rng() - 0.5) * ISLAND_HALF * 1.92
    const z = (rng() - 0.5) * ISLAND_HALF * 1.92
    if (Math.abs(x) > ISLAND_HALF * 0.96 || Math.abs(z) > ISLAND_HALF * 0.96)
      continue
    if (isInsideCornerPen(x, z)) continue
    if (level === 1 && onRibbon(x, z, PATH, 1.05)) continue
    if (level !== 1 && riverClosest(x, z).dist < 1.05) continue
    if (placed.some(([px, pz]) => (x - px) ** 2 + (z - pz) ** 2 < gap * gap)) continue
    placed.push([x, z])

    const h = 0.09 + rng() * 0.09
    const w = 0.028 + rng() * 0.016
    const ground = level !== 1 ? groundHeight(level, x, z) : 0
    dummy.position.set(x, ground + h * 0.5 + 0.02, z)
    dummy.rotation.set(0, rng() * Math.PI, (rng() - 0.5) * 0.18)
    dummy.scale.set(w, h, w)
    dummy.updateMatrix()
    if (rng() > 0.78 && ib < limitB) {
      b.setMatrixAt(ib++, dummy.matrix)
    } else {
      a.setMatrixAt(ia++, dummy.matrix)
    }
  }
  a.count = ia
  b.count = ib
  a.instanceMatrix.needsUpdate = true
  b.instanceMatrix.needsUpdate = true
  island.add(a, b)
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

  let run: [number, number][] = []
  const flush = () => {
    if (run.length < 2) {
      run = []
      return
    }
    const mesh = ribbonMesh(run, 1.55, 0x9bc7c4, 0)
    const pos = mesh.geometry.getAttribute('position')
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, bankHeight(pos.getZ(i)) - 0.09)
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
    for (const ox of [-0.55, 0, 0.55]) {
      const hit = riverClosest(ford.x + ox, 0.5)
      const stone = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.24, 0.07, 8),
        clay(0xdad2c4),
      )
      stone.position.set(hit.x, bankHeight(hit.z) + 0.04, hit.z)
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
  const baseY = -0.82
  const positions: number[] = []
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
  topGeo.setIndex(indices)
  topGeo.computeVertexNormals()
  const top = new THREE.Mesh(topGeo, clay(GRASS))
  top.receiveShadow = true
  island.add(top)

  const edge: [number, number][] = []
  for (let i = 0; i < n; i++) edge.push([i, 0])
  for (let j = 1; j < n; j++) edge.push([seg, j])
  for (let i = seg - 1; i >= 0; i--) edge.push([i, seg])
  for (let j = seg - 1; j >= 1; j--) edge.push([0, j])
  const skirtPos: number[] = []
  for (const [i, j] of edge) {
    const p = point(i, j)
    skirtPos.push(p.x, p.y, p.z, p.x, baseY, p.z)
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
  skirtGeo.setIndex(skirtIdx)
  skirtGeo.computeVertexNormals()
  const skirt = new THREE.Mesh(skirtGeo, clay(SIDE))
  skirt.castShadow = true
  skirt.receiveShadow = true
  island.add(skirt)

  addWater(island)
  addTufts(island, mulberry32(level === 3 ? 37 : 23), level)
  return island
}

export function createIsland(level: LevelId = 1): THREE.Group {
  if (level !== 1) return createSlopeIsland(level)
  const island = new THREE.Group()
  const w = ISLAND_HALF * 2
  const d = ISLAND_HALF * 2

  const slab = new THREE.Mesh(
    new RoundedBoxGeometry(w, 0.7, d, 8, 0.62),
    clay(SIDE),
  )
  slab.position.y = -0.48
  slab.castShadow = true
  slab.receiveShadow = true
  island.add(slab)

  const top = new THREE.Mesh(
    new RoundedBoxGeometry(w - 0.08, 0.14, d - 0.08, 6, 0.4),
    clay(GRASS),
  )
  top.position.y = -0.08
  top.receiveShadow = true
  island.add(top)

  island.add(ribbonMesh(PATH, 1.9, 0xe7dcc3, 0.02))

  addTufts(island, mulberry32(19), 1)
  return island
}