import * as THREE from 'three'

type TreeSpec = { x: number; z: number; pink?: boolean; scale?: number }

const SPECS: TreeSpec[] = [
  { x: -5.5, z: -4, pink: true, scale: 1.1 },
  { x: -6, z: 2.5 },
  { x: 5.8, z: -3.2, scale: 0.95 },
  { x: 6.2, z: 4 },
  { x: -2, z: -6 },
  { x: 2.5, z: 5.5 },
  { x: -5, z: 5 },
  { x: 4, z: -5.5, scale: 1.05 },
]

function tree(spec: TreeSpec): THREE.Group {
  const g = new THREE.Group()
  const s = spec.scale ?? 1
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12 * s, 0.16 * s, 0.55 * s, 8),
    new THREE.MeshLambertMaterial({ color: 0x8b5a3c }),
  )
  trunk.position.y = 0.28 * s
  trunk.castShadow = true
  g.add(trunk)

  const leafColor = spec.pink ? 0xf0b4c8 : 0x6fb85a
  const layers = [
    [0.52, 0.55],
    [0.42, 0.48],
    [0.35, 0.4],
  ]
  for (const [y, r] of layers) {
    const leaf = new THREE.Mesh(
      new THREE.SphereGeometry(r * s, 10, 8),
      new THREE.MeshLambertMaterial({ color: leafColor }),
    )
    leaf.position.y = y * s + 0.35 * s
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