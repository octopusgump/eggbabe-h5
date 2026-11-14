import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { ISLAND_HALF } from './constants'
import { blobShadow, clay } from './materials'
import { ribbonMesh } from './ribbon'

const GRASS = 0xc5e99a
const SIDE = 0x9ed56e
const TUFT_A = 0x4e8f3e
const TUFT_B = 0x3d7a34

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

const RIVER: [number, number][] = [
  [-7.2, 6.4],
  [-5.6, 4.2],
  [-4.5, 2.1],
  [-3.7, -0.2],
  [-4.4, -2.6],
  [-5.8, -5.0],
  [-7.4, -7.2],
]

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

function addTufts(island: THREE.Group, rng: () => number) {
  const count = 1100
  const geo = new THREE.ConeGeometry(1, 1, 5)
  const make = (color: number, n: number) => {
    const mesh = new THREE.InstancedMesh(geo, clay(color), n)
    mesh.castShadow = false
    mesh.receiveShadow = false
    return mesh
  }
  const a = make(TUFT_A, count)
  const b = make(TUFT_B, Math.floor(count * 0.45))
  const dummy = new THREE.Object3D()
  let ia = 0
  let ib = 0
  const limitB = b.count

  for (let i = 0; ia < count && i < count * 5; i++) {
    const x = (rng() - 0.5) * ISLAND_HALF * 1.92
    const z = (rng() - 0.5) * ISLAND_HALF * 1.92
    if (Math.abs(x) > ISLAND_HALF * 0.96 || Math.abs(z) > ISLAND_HALF * 0.96)
      continue
    if (onRibbon(x, z, RIVER, 1.15) || onRibbon(x, z, PATH, 1.05)) continue

    const h = 0.1 + rng() * 0.16
    const w = 0.035 + rng() * 0.03
    dummy.position.set(x, h * 0.5 + 0.02, z)
    dummy.rotation.set(0, rng() * Math.PI, (rng() - 0.5) * 0.25)
    dummy.scale.set(w, h, w)
    dummy.updateMatrix()
    if (rng() > 0.62 && ib < limitB) {
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

export function createIsland(): THREE.Group {
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

  const drop = blobShadow(9.2, 7.4, 0.85)
  drop.position.set(0.85, -0.78, 1.15)
  island.add(drop)

  island.add(ribbonMesh(RIVER, 2.35, 0xd7f3e8, 0.012))
  island.add(ribbonMesh(RIVER, 1.7, 0x4eb8ea, 0.028))
  island.add(ribbonMesh(PATH, 1.9, 0xe6d4a8, 0.02))

  addTufts(island, mulberry32(19))
  return island
}