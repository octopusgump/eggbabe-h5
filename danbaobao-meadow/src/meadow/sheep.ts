import * as THREE from 'three'

export type SheepState = {
  group: THREE.Group
  headPivot: THREE.Group
  grazing: boolean
  grazePhase: number
  phaseOffset: number
}

const WOOL = 0xf7f6f2
const INK = 0x1a1918

function woolBall(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  r: number,
) {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(r, 12, 10),
    new THREE.MeshLambertMaterial({ color: WOOL, flatShading: true }),
  )
  m.position.set(x, y, z)
  m.castShadow = true
  m.receiveShadow = true
  parent.add(m)
}

function addLeg(parent: THREE.Group, x: number, z: number) {
  const leg = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.028, 0.2, 6),
    new THREE.MeshLambertMaterial({ color: INK }),
  )
  leg.position.set(x, 0.1, z)
  leg.castShadow = true
  parent.add(leg)
}

export function createSheep(grazing = false): SheepState {
  const group = new THREE.Group()
  group.name = 'sheep'

  const body = new THREE.Group()
  group.add(body)

  const blobs: [number, number, number, number][] = [
    [0, 0.36, 0, 0.28],
    [-0.14, 0.4, 0.08, 0.21],
    [0.12, 0.42, -0.06, 0.2],
    [-0.08, 0.48, -0.1, 0.18],
    [0.1, 0.5, 0.1, 0.17],
    [0, 0.52, 0.02, 0.15],
    [-0.18, 0.34, -0.05, 0.14],
    [0.16, 0.36, 0.06, 0.13],
    [-0.04, 0.44, 0.14, 0.12],
    [0.06, 0.46, -0.14, 0.11],
  ]
  for (const [x, y, z, r] of blobs) woolBall(body, x, y, z, r)

  const headPivot = new THREE.Group()
  headPivot.position.set(0.28, 0.38, 0)
  body.add(headPivot)

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 10, 8),
    new THREE.MeshLambertMaterial({ color: INK }),
  )
  head.scale.set(1.15, 0.95, 0.9)
  head.position.set(0.12, 0, 0)
  head.castShadow = true
  headPivot.add(head)

  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff })
  for (const z of [-0.035, 0.035]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.016, 6, 4), eyeMat)
    eye.position.set(0.18, 0.02, z)
    headPivot.add(eye)
  }

  addLeg(group, -0.12, -0.1)
  addLeg(group, 0.12, -0.1)
  addLeg(group, -0.1, 0.1)
  addLeg(group, 0.1, 0.1)

  if (grazing) headPivot.rotation.x = -0.55

  return {
    group,
    headPivot,
    grazing,
    grazePhase: 0,
    phaseOffset: Math.random() * Math.PI * 2,
  }
}