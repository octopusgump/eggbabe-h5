import * as THREE from 'three'

type TreeSpec = { x: number; z: number; pink?: boolean; scale?: number }

const SPECS: TreeSpec[] = [
  { x: -5.2, z: -3.5, pink: true, scale: 1.15 },
  { x: -6.2, z: 1.8, scale: 0.92 },
  { x: 5.5, z: -2.8, scale: 1.0 },
  { x: 6.0, z: 3.8, scale: 1.05 },
  { x: -1.5, z: -5.8, scale: 0.88 },
  { x: 2.2, z: 5.2, scale: 0.95 },
  { x: -4.8, z: 4.6, scale: 1.02 },
  { x: 4.5, z: -5.0, scale: 0.9 },
]

function tree(spec: TreeSpec): THREE.Group {
  const g = new THREE.Group()
  const s = spec.scale ?? 1
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1 * s, 0.14 * s, 0.5 * s, 6),
    new THREE.MeshLambertMaterial({ color: 0x9a6b45 }),
  )
  trunk.position.y = 0.25 * s
  trunk.castShadow = true
  g.add(trunk)

  const leafColor = spec.pink ? 0xe8a4be : 0x6cc464
  const blobs: [number, number, number, number][] = [
    [0, 0.72, 0, 0.52],
    [-0.18, 0.62, 0.1, 0.42],
    [0.2, 0.65, -0.12, 0.4],
    [0.05, 0.85, 0.08, 0.38],
    [-0.08, 0.55, -0.18, 0.36],
    [0.15, 0.58, 0.2, 0.34],
  ]

  for (const [x, y, z, r] of blobs) {
    const leaf = new THREE.Mesh(
      new THREE.SphereGeometry(r * s, 8, 7),
      new THREE.MeshLambertMaterial({ color: leafColor, flatShading: true }),
    )
    leaf.position.set(x * s, y * s, z * s)
    leaf.castShadow = true
    g.add(leaf)
  }

  g.position.set(spec.x, 0, spec.z)
  return g
}

export function createTrees(): THREE.Group {
  const root = new THREE.Group()
  for (const spec of SPECS) root.add(tree(spec))
  return root
}