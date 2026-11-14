import * as THREE from 'three'

export type SheepState = {
  group: THREE.Group
  velocity: THREE.Vector2
  wanderTimer: number
  dragY: number
}

const WOOL = 0xf7f6f2
const INK = 0x1a1918

function woolBall(
  parent: THREE.Group,
  x: number,
  y: number,
  z: number,
  r: number,
) {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(r, 8, 7),
    new THREE.MeshLambertMaterial({ color: WOOL, flatShading: true }),
  )
  m.position.set(x, y, z)
  m.castShadow = true
  parent.add(m)
}

function addLeg(parent: THREE.Group, x: number, z: number) {
  const leg = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.028, 0.2, 5),
    new THREE.MeshLambertMaterial({ color: INK }),
  )
  leg.position.set(x, 0.1, z)
  leg.castShadow = true
  parent.add(leg)
}

/** Cluster-of-spheres sheep (Kimi reference). */
export function createSheep(): SheepState {
  const group = new THREE.Group()
  group.name = 'sheep'

  const blobs: [number, number, number, number][] = [
    [0, 0.36, 0, 0.28],
    [-0.14, 0.4, 0.08, 0.2],
    [0.12, 0.42, -0.06, 0.19],
    [-0.08, 0.48, -0.1, 0.17],
    [0.1, 0.5, 0.1, 0.16],
    [0, 0.52, 0.02, 0.15],
    [-0.18, 0.34, -0.05, 0.14],
    [0.16, 0.36, 0.06, 0.13],
  ]
  for (const [x, y, z, r] of blobs) woolBall(group, x, y, z, r)

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 8, 6),
    new THREE.MeshLambertMaterial({ color: INK }),
  )
  head.scale.set(1.15, 0.95, 0.9)
  head.position.set(0.38, 0.38, 0)
  head.castShadow = true
  group.add(head)

  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff })
  for (const z of [-0.04, 0.04]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 4), eyeMat)
    eye.position.set(0.46, 0.4, z)
    group.add(eye)
  }

  addLeg(group, -0.12, -0.1)
  addLeg(group, 0.12, -0.1)
  addLeg(group, -0.1, 0.1)
  addLeg(group, 0.1, 0.1)

  return {
    group,
    velocity: new THREE.Vector2(),
    wanderTimer: Math.random() * 3,
    dragY: 0.38,
  }
}