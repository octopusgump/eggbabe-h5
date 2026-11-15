import * as THREE from 'three'
import { blobShadow, clay } from './materials'

export type RabbitState = {
  group: THREE.Group
  ears: THREE.Group[]
}

const FUR = 0xf4efe8
const BELLY = 0xfffaf4
const PINK = 0xf3b7c4
const BLUSH = 0xf6c8d4

function ball(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  r: number,
  color: number,
  sx = 1,
  sy = 1,
  sz = 1,
) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 16), clay(color))
  mesh.position.set(x, y, z)
  mesh.scale.set(sx, sy, sz)
  mesh.castShadow = true
  parent.add(mesh)
  return mesh
}

function limb(x: number, y: number, z: number, radius: number, length: number) {
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 4, 10), clay(FUR))
  mesh.position.set(x, y, z)
  mesh.castShadow = true
  return mesh
}

/** Standing plush rabbit. Local +X is the face. */
export function createRabbit(): RabbitState {
  const group = new THREE.Group()
  group.name = 'rabbit'

  ball(group, 0, 0.4, 0, 0.3, FUR, 1.08, 1.05, 1.02)
  ball(group, 0.08, 0.32, 0, 0.18, BELLY, 1, 0.85, 0.9)

  for (const z of [-0.11, 0.11]) {
    group.add(limb(0, 0.15, z, 0.055, 0.1))
    ball(group, 0.04, 0.05, z, 0.065, FUR, 1.2, 0.65, 0.95)
  }
  for (const z of [-0.3, 0.3]) {
    const arm = limb(0.04, 0.38, z, 0.048, 0.16)
    arm.rotation.z = z > 0 ? -0.35 : 0.35
    arm.rotation.x = z > 0 ? 0.2 : -0.2
    group.add(arm)
  }

  ball(group, 0.05, 0.78, 0, 0.26, FUR)
  ball(group, -0.2, 0.44, 0, 0.08, FUR)

  const ears: THREE.Group[] = []
  for (const z of [-1, 1]) {
    const ear = new THREE.Group()
    const outer = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.46, 4, 10), clay(FUR))
    outer.castShadow = true
    const inner = new THREE.Mesh(new THREE.CapsuleGeometry(0.028, 0.3, 3, 8), clay(PINK))
    inner.position.set(0.025, -0.02, 0)
    ear.add(outer, inner)
    ear.position.set(-0.02, 1.12, z * 0.1)
    ear.rotation.x = z * -0.28
    ear.rotation.z = -0.12
    group.add(ear)
    ears.push(ear)
  }

  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x2a241f })
  const shineMat = new THREE.MeshBasicMaterial({ color: 0xffffff })
  for (const z of [-0.075, 0.075]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.062, 16, 12), eyeMat)
    eye.scale.set(0.9, 1.05, 0.7)
    eye.position.set(0.28, 0.82, z)
    group.add(eye)
    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), shineMat)
    shine.position.set(0.325, 0.855, z + Math.sign(z) * 0.012)
    group.add(shine)
  }

  ball(group, 0.32, 0.72, 0, 0.032, PINK, 1.2, 0.7, 0.8)
  ball(group, 0.26, 0.74, -0.16, 0.045, BLUSH, 1, 0.65, 0.5)
  ball(group, 0.26, 0.74, 0.16, 0.045, BLUSH, 1, 0.65, 0.5)

  const shade = blobShadow(0.46, 0.32, 0.9)
  shade.position.set(0.02, 0.02, 0)
  group.add(shade)

  return { group, ears }
}

export function swayEars(rabbit: RabbitState, t: number) {
  const [left, right] = rabbit.ears
  left.rotation.x = -0.28 + Math.sin(t * 1.7) * 0.05
  right.rotation.x = 0.28 + Math.sin(t * 1.7 + 0.8) * 0.05
}
