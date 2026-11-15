import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { ISLAND_HALF } from './constants'
import { clay } from './materials'
import { isInsideCornerPen } from './pen'
import { ribbonMesh } from './ribbon'

const GRASS = 0xd7f3a4
const SIDE = 0xb8e472
/** Close pair. Both sit a step under the lawn, so the field stays one green. */
const TUFT_A = 0x7ec45a
const TUFT_B = 0x74b854

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

function addTufts(island: THREE.Group, rng: () => number) {
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
    if (onRibbon(x, z, PATH, 1.05) || isInsideCornerPen(x, z)) continue
    if (placed.some(([px, pz]) => (x - px) ** 2 + (z - pz) ** 2 < gap * gap)) continue
    placed.push([x, z])

    const h = 0.09 + rng() * 0.09
    const w = 0.028 + rng() * 0.016
    dummy.position.set(x, h * 0.5 + 0.02, z)
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

  island.add(ribbonMesh(PATH, 1.9, 0xe6d4a8, 0.02))

  addTufts(island, mulberry32(19))
  return island
}