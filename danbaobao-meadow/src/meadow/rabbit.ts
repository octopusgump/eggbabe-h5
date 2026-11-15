import * as THREE from 'three'
import { blobShadow, clay } from './materials'

export type RabbitState = {
  group: THREE.Group
}

const FUR = 0xfff7f1
const PINK = 0xf4b7c6

function ear(z: number) {
  const g = new THREE.Group()
  const outer = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.28, 4, 8), clay(FUR))
  outer.castShadow = true
  const inner = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.18, 3, 6), clay(PINK))
  inner.position.set(0.02, -0.01, 0)
  g.add(outer, inner)
  g.position.set(0.16, 0.72, z)
  g.rotation.z = -0.35
  g.rotation.x = z > 0 ? -0.18 : 0.18
  return g
}

/** Low-poly white rabbit. Local +X is forward. */
export function createRabbit(): RabbitState {
  const group = new THREE.Group()
  group.name = 'rabbit'

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), clay(FUR))
  body.scale.set(1.15, 0.86, 0.78)
  body.position.set(0, 0.32, 0)
  body.castShadow = true
  group.add(body)

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 12), clay(FUR))
  head.position.set(0.26, 0.4, 0)
  head.castShadow = true
  group.add(head)

  group.add(ear(-0.07), ear(0.07))

  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1c1b19 })
  for (const z of [-0.05, 0.05]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), eyeMat)
    eye.position.set(0.39, 0.44, z)
    group.add(eye)
  }

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), clay(PINK))
  nose.position.set(0.42, 0.38, 0)
  group.add(nose)

  const tail = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), clay(FUR))
  tail.position.set(-0.28, 0.36, 0)
  group.add(tail)

  const shade = blobShadow(0.38, 0.26, 0.85)
  shade.position.set(0.02, 0.02, 0.02)
  group.add(shade)

  return { group }
}