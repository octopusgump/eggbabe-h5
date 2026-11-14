import * as THREE from 'three'

type TreeSpec = { x: number; z: number; pink?: boolean; scale?: number }

const SPECS: TreeSpec[] = [
  { x: -5.4, z: -3.2, pink: true, scale: 1.12 },
  { x: -6.0, z: 2.0, scale: 0.94 },
  { x: 5.6, z: -3.0, scale: 1.0 },
  { x: 5.8, z: 4.2, scale: 1.08 },
  { x: -1.8, z: -5.6, scale: 0.9 },
  { x: 2.4, z: 5.4, scale: 0.96 },
  { x: -4.6, z: 5.0, scale: 1.0 },
  { x: 4.2, z: -5.2, scale: 0.88 },
]

function tree(spec: TreeSpec): THREE.Group {
  const g = new THREE.Group()
  const s = spec.scale ?? 1
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1 * s, 0.14 * s, 0.52 * s, 6),
    new THREE.MeshLambertMaterial({ color: 0x9a6b45 }),
  )
  trunk.position.y = 0.26 * s
  trunk.castShadow = true
  g.add(trunk)

  const leafColor = spec.pink ? 0xe8a4be : 0x6bc65e
  const blobs: [number, number, number, number][] = [
    [0, 0.74, 0, 0.54],
    [-0.2, 0.62, 0.12, 0.44],
    [0.22, 0.66, -0.14, 0.42],
    [0.04, 0.88, 0.1, 0.4],
    [-0.1, 0.54, -0.2, 0.38],
    [0.18, 0.56, 0.22, 0.36],
    [-0.14, 0.78, -0.08, 0.32],
  ]

  for (const [x, y, z, r] of blobs) {
    const leaf = new THREE.Mesh(
      new THREE.SphereGeometry(r * s, 10, 8),
      new THREE.MeshLambertMaterial({ color: leafColor, flatShading: true }),
    )
    leaf.position.set(x * s, y * s, z * s)
    leaf.castShadow = true
    leaf.receiveShadow = true
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