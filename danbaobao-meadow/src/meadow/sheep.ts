import * as THREE from 'three'

export type SheepState = {
  group: THREE.Group
  velocity: THREE.Vector2
  wanderTimer: number
  dragY: number
}

function addLeg(parent: THREE.Group, x: number, z: number) {
  const leg = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.05, 0.22, 6),
    new THREE.MeshLambertMaterial({ color: 0x2a2520 }),
  )
  leg.position.set(x, 0.11, z)
  leg.castShadow = true
  parent.add(leg)
}

export function createSheep(): SheepState {
  const group = new THREE.Group()
  group.name = 'sheep'

  const wool = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 16, 14),
    new THREE.MeshLambertMaterial({ color: 0xf8f6f2 }),
  )
  wool.position.y = 0.38
  wool.castShadow = true
  wool.scale.set(1.1, 0.95, 1.05)
  group.add(wool)

  const puff = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0xf8f6f2 }),
  )
  puff.position.set(0.32, 0.52, 0)
  puff.castShadow = true
  group.add(puff)

  const face = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0x1e1c1a }),
  )
  face.position.set(0.42, 0.42, 0)
  group.add(face)

  addLeg(group, -0.18, -0.12)
  addLeg(group, 0.18, -0.12)
  addLeg(group, -0.18, 0.12)
  addLeg(group, 0.18, 0.12)

  return {
    group,
    velocity: new THREE.Vector2(),
    wanderTimer: Math.random() * 3,
    dragY: 0.38,
  }
}