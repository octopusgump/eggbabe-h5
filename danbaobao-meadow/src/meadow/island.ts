import * as THREE from 'three'
import { ISLAND_HALF } from './constants'

function tuft(x: number, z: number, root: THREE.Group, rng: () => number) {
  const g = new THREE.Mesh(
    new THREE.ConeGeometry(0.08 + rng() * 0.06, 0.12 + rng() * 0.08, 5),
    new THREE.MeshLambertMaterial({ color: 0x5a8f4a }),
  )
  g.position.set(x, 0.06, z)
  g.rotation.y = rng() * Math.PI
  root.add(g)
}

export function createIsland(): THREE.Group {
  const island = new THREE.Group()

  const top = new THREE.Mesh(
    new THREE.BoxGeometry(ISLAND_HALF * 2, 0.5, ISLAND_HALF * 2),
    new THREE.MeshLambertMaterial({ color: 0x8fcf6e }),
  )
  top.position.y = -0.15
  top.receiveShadow = true
  top.castShadow = true
  island.add(top)

  const rim = new THREE.Mesh(
    new THREE.BoxGeometry(ISLAND_HALF * 2 + 0.3, 0.35, ISLAND_HALF * 2 + 0.3),
    new THREE.MeshLambertMaterial({ color: 0x7ab85c }),
  )
  rim.position.y = -0.38
  island.add(rim)

  const rnd = mulberry32(42)
  for (let i = 0; i < 120; i++) {
    const x = (rnd() - 0.5) * ISLAND_HALF * 1.85
    const z = (rnd() - 0.5) * ISLAND_HALF * 1.85
    tuft(x, z, island, rnd)
  }

  const river = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, ISLAND_HALF * 1.6),
    new THREE.MeshLambertMaterial({ color: 0x5eb8e8 }),
  )
  river.rotation.x = -Math.PI / 2
  river.rotation.z = -0.55
  river.position.set(-4.2, 0.04, 0.5)
  island.add(river)

  const path = new THREE.Mesh(
    new THREE.PlaneGeometry(2.8, ISLAND_HALF * 1.5),
    new THREE.MeshLambertMaterial({ color: 0xd9c4a0 }),
  )
  path.rotation.x = -Math.PI / 2
  path.rotation.z = 0.45
  path.position.set(3.5, 0.035, -1)
  island.add(path)

  return island
}

function mulberry32(a: number) {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}