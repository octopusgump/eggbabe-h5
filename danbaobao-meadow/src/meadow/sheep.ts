import * as THREE from 'three'
import { blobShadow, clay } from './materials'

export type SheepMode = 'wander' | 'graze'

export type SheepState = {
  group: THREE.Group
  headPivot: THREE.Group
  mode: SheepMode
  velocity: THREE.Vector2
  timer: number
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

export function createSheep(): SheepState {
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

  const mode: SheepMode = Math.random() > 0.4 ? 'wander' : 'graze'
  const velocity = new THREE.Vector2()
  if (mode === 'wander') {
    const a = Math.random() * Math.PI * 2
    const speed = 0.4 + Math.random() * 0.35
    velocity.set(Math.cos(a) * speed, Math.sin(a) * speed)
  } else {
    headPivot.rotation.x = -0.62
  }

  return {
    group,
    headPivot,
    mode,
    velocity,
    timer: 0.8 + Math.random() * 2.4,
    phaseOffset: Math.random() * Math.PI * 2,
  }
}

const BOUND = 6.2

/** Walk a while, then pause to graze, then pick a new direction. */
export function stepSheep(s: SheepState, dt: number, t: number) {
  s.timer -= dt
  if (s.timer <= 0) {
    if (s.mode === 'wander') {
      s.mode = 'graze'
      s.velocity.set(0, 0)
      s.timer = 1.2 + Math.random() * 2.4
    } else {
      s.mode = 'wander'
      const a = Math.random() * Math.PI * 2
      const speed = 0.38 + Math.random() * 0.4
      s.velocity.set(Math.cos(a) * speed, Math.sin(a) * speed)
      s.timer = 1.8 + Math.random() * 2.6
    }
  }

  if (s.mode === 'wander') {
    s.group.position.x += s.velocity.x * dt
    s.group.position.z += s.velocity.y * dt
    if (Math.abs(s.group.position.x) > BOUND) {
      s.group.position.x = clamp(s.group.position.x, -BOUND, BOUND)
      s.velocity.x *= -1
    }
    if (Math.abs(s.group.position.z) > BOUND) {
      s.group.position.z = clamp(s.group.position.z, -BOUND, BOUND)
      s.velocity.y *= -1
    }
    if (s.velocity.lengthSq() > 0.0001) {
      const facing = Math.atan2(-s.velocity.y, s.velocity.x)
      s.group.rotation.y = dampAngle(s.group.rotation.y, facing, dt)
    }
    s.group.position.y = Math.abs(Math.sin(t * 7 + s.phaseOffset)) * 0.035
    s.headPivot.rotation.x = -0.08
    return
  }

  s.group.position.y = 0
  s.headPivot.rotation.x = -0.62 + Math.sin(t * 1.15 + s.phaseOffset) * 0.045
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

function dampAngle(current: number, target: number, dt: number) {
  let d = target - current
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return current + d * Math.min(1, dt * 6)
}