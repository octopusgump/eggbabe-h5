import * as THREE from 'three'
import { groundHeight, levelConfig, type LevelId, type TreeObstacle } from './levels'
import { blobShadow, clay, felt, oakWood, snowTrim } from './materials'

function canopy(parent: THREE.Group, s: number) {
  const crownTop = felt(0x9cb976, 0x87a663, 2, 0.04)
  const crownMid = felt(0x82a564, 0x6f9253, 2, 0.042)
  const crownLow = felt(0x6c8f52, 0x5c7d44, 2, 0.04)
  const mats = [crownMid, crownTop, crownLow]

  const blobs: [number, number, number, number, number][] = [
    [0, 1.0, 0, 0.62, 0],
    [-0.3, 0.82, 0.14, 0.48, 2],
    [0.32, 0.86, -0.1, 0.46, 0],
    [0.04, 1.22, 0.06, 0.44, 1],
    [-0.14, 0.74, -0.28, 0.4, 2],
    [0.2, 0.72, 0.26, 0.36, 0],
  ]
  for (const [x, y, z, r, ci] of blobs) {
    const leaf = new THREE.Mesh(
      new THREE.SphereGeometry(r * s, 20, 16),
      mats[ci % mats.length],
    )
    leaf.position.set(x * s, y * s, z * s)
    leaf.castShadow = true
    leaf.receiveShadow = true
    parent.add(leaf)
  }

  const snowCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.41 * s, 16, 12),
    snowTrim(0xfffdf8, 0xeef4f6, 1),
  )
  snowCap.scale.set(1.06, 0.44, 1.04)
  snowCap.position.set(0.04 * s, 1.54 * s, 0.06 * s)
  snowCap.castShadow = true
  parent.add(snowCap)

  const budMat = clay(0xfff8e6, 0.82)
  const budPositions: [number, number, number][] = [
    [0.24, 1.18, 0.34],
    [-0.36, 1.0, 0.22],
    [0.36, 0.94, -0.24],
  ]
  for (const [bx, by, bz] of budPositions) {
    const bud = new THREE.Mesh(new THREE.SphereGeometry(0.058 * s, 8, 6), budMat)
    bud.position.set(bx * s, by * s, bz * s)
    parent.add(bud)
  }
}

function tree(spec: TreeObstacle, level: LevelId, idx: number): THREE.Group {
  const g = new THREE.Group()
  g.userData.swayPhase = idx * 1.17
  const s = spec.scale ?? 1
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11 * s, 0.16 * s, 0.62 * s, 12),
    oakWood(0x9b6e45, 1),
  )
  trunk.position.y = 0.3 * s
  trunk.castShadow = true
  trunk.receiveShadow = true
  g.add(trunk)

  const crownPivot = new THREE.Group()
  crownPivot.name = 'crown'
  canopy(crownPivot, s)
  g.add(crownPivot)

  const shade = blobShadow(1.02 * s, 0.68 * s, 0.9)
  shade.position.set(0.24 * s, 0.03, 0.32 * s)
  g.add(shade)

  g.position.set(spec.x, groundHeight(level, spec.x, spec.z), spec.z)
  return g
}

/** Strictly spawns trees from levelConfig(level).trees (Level 1 has 0 trees!). */
export function createTrees(level: LevelId = 1): THREE.Group {
  const root = new THREE.Group()
  const specs = levelConfig(level).trees
  specs.forEach((spec, idx) => root.add(tree(spec, level, idx)))
  return root
}

export function stepTrees(root: THREE.Group | null, t: number) {
  if (!root) return
  for (const child of root.children) {
    const phase = Number(child.userData.swayPhase || 0)
    const crown = child.getObjectByName('crown')
    if (crown) {
      crown.rotation.z = Math.sin(t * 1.25 + phase) * 0.028
      crown.rotation.x = Math.cos(t * 0.95 + phase * 1.3) * 0.018
    }
  }
}