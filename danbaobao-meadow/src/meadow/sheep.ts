import * as THREE from 'three'
import { blobShadow, clay } from './materials'

export type SheepState = {
  group: THREE.Group
  headPivot: THREE.Group
  grazing: boolean
  phaseOffset: number
}

const WOOL = [0xf7f6f3, 0xfffefb, 0xeeeae4]

function puff(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  r: number,
  color: number,
) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), clay(color))
  m.position.set(x, y, z)
  m.castShadow = true
  parent.add(m)
}

export function createSheep(grazing = false): SheepState {
  const group = new THREE.Group()
  group.name = 'sheep'

  const blobs: [number, number, number, number][] = [
    [0, 0.34, 0, 0.26],
    [-0.16, 0.38, 0.08, 0.2],
    [0.14, 0.4, -0.06, 0.19],
    [-0.06, 0.48, -0.1, 0.17],
    [0.08, 0.5, 0.1, 0.16],
    [0.02, 0.44, 0.14, 0.14],
    [-0.12, 0.32, -0.12, 0.15],
    [0.16, 0.34, 0.08, 0.13],
    [-0.02, 0.52, 0, 0.13],
    [0.06, 0.36, -0.14, 0.12],
  ]
  blobs.forEach(([x, y, z, r], i) => puff(group, x, y, z, r, WOOL[i % WOOL.length]))

  const headPivot = new THREE.Group()
  headPivot.position.set(0.22, 0.34, 0)
  group.add(headPivot)

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 14, 12),
    clay(0x1c1b19),
  )
  head.scale.set(1.2, 0.92, 0.88)
  head.position.set(0.1, 0, 0)
  head.castShadow = true
  headPivot.add(head)

  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff })
  for (const z of [-0.032, 0.032]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), eyeMat)
    eye.position.set(0.17, 0.02, z)
    headPivot.add(eye)
  }

  const legMat = clay(0x1c1b19)
  for (const [x, z] of [
    [-0.1, -0.08],
    [0.1, -0.08],
    [-0.08, 0.09],
    [0.08, 0.09],
  ] as const) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.026, 0.2, 8), legMat)
    leg.position.set(x, 0.1, z)
    leg.castShadow = true
    group.add(leg)
  }

  const shade = blobShadow(0.42, 0.28, 0.9)
  shade.position.set(0.05, 0.02, 0.06)
  group.add(shade)

  if (grazing) headPivot.rotation.x = -0.62

  return {
    group,
    headPivot,
    grazing,
    phaseOffset: Math.random() * Math.PI * 2,
  }
}