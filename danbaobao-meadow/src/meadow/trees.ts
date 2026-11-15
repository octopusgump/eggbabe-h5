import * as THREE from 'three'
import { blobShadow, clay } from './materials'

type TreeSpec = { x: number; z: number; pink?: boolean; scale?: number }

const SPECS: TreeSpec[] = [
  { x: -5.6, z: -2.4, pink: true, scale: 1.15 },
  { x: -5.8, z: 3.6, scale: 1.05 },
  { x: -1.6, z: 5.8, scale: 0.92 },
  { x: 2.6, z: 4.8, scale: 1.0 },
  { x: 5.6, z: 2.2, scale: 0.95 },
  { x: 5.2, z: -2.6, scale: 1.08 },
  { x: 1.4, z: -4.6, scale: 1.12 },
  { x: -4.4, z: -5.4, scale: 0.88 },
]

const GREEN = [0x7ed86c, 0x94e484, 0x6ccc58]
const PINK = [0xd7a4d4, 0xe4b6df, 0xc890cc]

function canopy(
  parent: THREE.Group,
  colors: number[],
  s: number,
) {
  const blobs: [number, number, number, number, number][] = [
    [0, 0.95, 0, 0.58, 0],
    [-0.28, 0.78, 0.12, 0.46, 1],
    [0.3, 0.82, -0.1, 0.44, 2],
    [0.05, 1.12, 0.08, 0.4, 1],
    [-0.12, 0.7, -0.26, 0.36, 0],
    [0.18, 0.68, 0.24, 0.34, 2],
  ]
  for (const [x, y, z, r, ci] of blobs) {
    const leaf = new THREE.Mesh(
      new THREE.SphereGeometry(r * s, 18, 14),
      clay(colors[ci % colors.length]),
    )
    leaf.position.set(x * s, y * s, z * s)
    leaf.castShadow = true
    parent.add(leaf)
  }
}

function tree(spec: TreeSpec): THREE.Group {
  const g = new THREE.Group()
  const s = spec.scale ?? 1
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09 * s, 0.13 * s, 0.55 * s, 10),
    clay(0x8d5a34),
  )
  trunk.position.y = 0.28 * s
  trunk.castShadow = true
  g.add(trunk)
  canopy(g, spec.pink ? PINK : GREEN, s)

  const shade = blobShadow(0.95 * s, 0.62 * s, 0.95)
  shade.position.set(0.28 * s, 0.03, 0.36 * s)
  g.add(shade)

  g.position.set(spec.x, 0, spec.z)
  return g
}

export function createTrees(): THREE.Group {
  const root = new THREE.Group()
  for (const spec of SPECS) root.add(tree(spec))
  return root
}