import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { ISLAND_HALF } from './constants'

const GRASS_TOP = 0xa0db6d
const GRASS_SIDE = 0x7fbe58
const TUFT = 0x3d6b3a

function mulberry32(a: number) {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function isOnPathOrRiver(x: number, z: number) {
  const river = x < -1.8 && z > -2 && z < 5
  const path = x > 1.2 && z < 2.5
  return river || path
}

function addGrassTufts(island: THREE.Group, rng: () => number) {
  const count = 680
  const geo = new THREE.ConeGeometry(1, 1, 4)
  const mat = new THREE.MeshLambertMaterial({ color: TUFT, flatShading: true })
  const mesh = new THREE.InstancedMesh(geo, mat, count)
  mesh.castShadow = true

  const dummy = new THREE.Object3D()
  let placed = 0
  for (let i = 0; placed < count && i < count * 4; i++) {
    const x = (rng() - 0.5) * ISLAND_HALF * 1.9
    const z = (rng() - 0.5) * ISLAND_HALF * 1.9
    if (Math.abs(x) > ISLAND_HALF * 0.95 || Math.abs(z) > ISLAND_HALF * 0.95)
      continue
    if (isOnPathOrRiver(x, z) && rng() > 0.35) continue

    const h = 0.05 + rng() * 0.11
    const w = 0.03 + rng() * 0.032
    dummy.position.set(x, 0.04 + h * 0.5, z)
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
  group.rotation.y = -0.48
  group.position.set(-3.6, 0.045, 1.0)

  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, ISLAND_HALF * 1.5),
    new THREE.MeshLambertMaterial({ color: 0x4fc3ef }),
  )
  water.rotation.x = -Math.PI / 2
  water.receiveShadow = true
  group.add(water)

  const bankMat = new THREE.MeshLambertMaterial({ color: 0xc8efff })
  for (const side of [-1.18, 1.18]) {
    const bank = new THREE.Mesh(
      new THREE.PlaneGeometry(0.18, ISLAND_HALF * 1.5),
      bankMat,
    )
    bank.rotation.x = -Math.PI / 2
    bank.position.set(side, 0.004, 0)
    group.add(bank)
  }
  island.add(group)
}

function addPath(island: THREE.Group) {
  const path = new THREE.Mesh(
    new THREE.PlaneGeometry(2.5, ISLAND_HALF * 1.55),
    new THREE.MeshLambertMaterial({ color: 0xdcc89a }),
  )
  path.rotation.x = -Math.PI / 2
  path.rotation.z = 0.42
  path.position.set(3.35, 0.04, -0.85)
  path.receiveShadow = true
  island.add(path)
}

export function createIsland(): THREE.Group {
  const island = new THREE.Group()
  const w = ISLAND_HALF * 2
  const d = ISLAND_HALF * 2

  const top = new THREE.Mesh(
    new RoundedBoxGeometry(w, 0.52, d, 10, 0.55),
    new THREE.MeshLambertMaterial({ color: GRASS_TOP }),
  )
  top.position.y = -0.1
  top.receiveShadow = true
  top.castShadow = true
  island.add(top)

  const skirt = new THREE.Mesh(
    new RoundedBoxGeometry(w + 0.1, 0.38, d + 0.1, 8, 0.35),
    new THREE.MeshLambertMaterial({ color: GRASS_SIDE }),
  )
  skirt.position.y = -0.42
  skirt.castShadow = true
  island.add(skirt)

  const rnd = mulberry32(11)
  addGrassTufts(island, rnd)
  addRiver(island)
  addPath(island)

  return island
}