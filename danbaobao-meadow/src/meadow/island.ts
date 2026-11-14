import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { ISLAND_HALF } from './constants'

const GRASS_TOP = 0x9ed66f
const GRASS_SIDE = 0x7fb85a
const TUFT = 0x3f7342

function mulberry32(a: number) {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function addGrassTufts(island: THREE.Group, rng: () => number) {
  const count = 520
  const geo = new THREE.ConeGeometry(1, 1, 4)
  const mat = new THREE.MeshLambertMaterial({ color: TUFT, flatShading: true })
  const mesh = new THREE.InstancedMesh(geo, mat, count)
  mesh.castShadow = true
  mesh.receiveShadow = false

  const dummy = new THREE.Object3D()
  let placed = 0
  for (let i = 0; placed < count && i < count * 3; i++) {
    const x = (rng() - 0.5) * ISLAND_HALF * 1.88
    const z = (rng() - 0.5) * ISLAND_HALF * 1.88
    if (Math.abs(x) > ISLAND_HALF * 0.94 || Math.abs(z) > ISLAND_HALF * 0.94)
      continue
    const h = 0.06 + rng() * 0.1
    const w = 0.035 + rng() * 0.03
    dummy.position.set(x, 0.03 + h * 0.5, z)
    dummy.rotation.y = rng() * Math.PI
    dummy.scale.set(w, h, w)
    dummy.updateMatrix()
    mesh.setMatrixAt(placed, dummy.matrix)
    placed++
  }
  mesh.count = placed
  mesh.instanceMatrix.needsUpdate = true
  island.add(mesh)
}

function addRiver(island: THREE.Group) {
  const group = new THREE.Group()
  group.rotation.y = -0.42
  group.position.set(-3.8, 0.042, 0.8)

  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, ISLAND_HALF * 1.55),
    new THREE.MeshLambertMaterial({ color: 0x45c4f0 }),
  )
  water.rotation.x = -Math.PI / 2
  water.receiveShadow = true
  group.add(water)

  const bankMat = new THREE.MeshLambertMaterial({ color: 0xb8ecff })
  for (const side of [-1.3, 1.3]) {
    const bank = new THREE.Mesh(new THREE.PlaneGeometry(0.22, ISLAND_HALF * 1.55), bankMat)
    bank.rotation.x = -Math.PI / 2
    bank.position.x = side
    bank.position.y = 0.004
    group.add(bank)
  }
  island.add(group)
}

function addPath(island: THREE.Group) {
  const path = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, ISLAND_HALF * 1.62),
    new THREE.MeshLambertMaterial({ color: 0xddc89a }),
  )
  path.rotation.x = -Math.PI / 2
  path.rotation.z = 0.38
  path.position.set(3.2, 0.038, -0.6)
  path.receiveShadow = true
  island.add(path)
}

/** Kimi-style rounded floating island with dense grass tufts. */
export function createIsland(): THREE.Group {
  const island = new THREE.Group()
  const w = ISLAND_HALF * 2
  const d = ISLAND_HALF * 2

  const top = new THREE.Mesh(
    new RoundedBoxGeometry(w, 0.48, d, 8, 0.45),
    new THREE.MeshLambertMaterial({ color: GRASS_TOP }),
  )
  top.position.y = -0.12
  top.receiveShadow = true
  top.castShadow = true
  island.add(top)

  const skirt = new THREE.Mesh(
    new RoundedBoxGeometry(w + 0.08, 0.32, d + 0.08, 6, 0.25),
    new THREE.MeshLambertMaterial({ color: GRASS_SIDE }),
  )
  skirt.position.y = -0.38
  skirt.castShadow = true
  island.add(skirt)

  const rnd = mulberry32(7)
  addGrassTufts(island, rnd)
  addRiver(island)
  addPath(island)

  return island
}