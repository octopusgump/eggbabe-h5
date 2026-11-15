import * as THREE from 'three'
import { blobShadow, clay } from './materials'

/**
 * Clay herder on a humanoid bone rig.
 * Motion is three.js AnimationMixer, the same player as
 * https://github.com/mrdoob/three.js/blob/dev/examples/webgl_animation_skinning_blending.html
 * Bone names follow the glTF humanoid set so a later CC0 clip
 * (Quaternius Universal Animation Library) can be retargeted onto this rig.
 * Local +X is the face.
 */

const SKIN = 0xf6d2b4
const HAIR = 0x3a2a22
const SHIRT = 0xf4f1ea
const PANTS = 0x4e6a48
const SHOE = 0x6d4a32
const EYE = 0x2a241f

export type HerderState = {
  group: THREE.Group
  mixer: THREE.AnimationMixer
  idle: THREE.AnimationAction
  walk: THREE.AnimationAction
  current: THREE.AnimationAction
}

function joint(name: string, parent: THREE.Object3D, x: number, y: number, z: number) {
  const bone = new THREE.Bone()
  bone.name = name
  bone.position.set(x, y, z)
  parent.add(bone)
  return bone
}

function mesh(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  color: number,
  x: number,
  y: number,
  z: number,
) {
  const body = new THREE.Mesh(geometry, clay(color))
  body.position.set(x, y, z)
  body.castShadow = true
  parent.add(body)
  return body
}

function quatSamples(times: number[], duration: number, sample: (u: number) => [number, number, number]) {
  const values: number[] = []
  const q = new THREE.Quaternion()
  const euler = new THREE.Euler(0, 0, 0, 'XYZ')
  for (const t of times) {
    const [x, y, z] = sample(t / duration)
    euler.set(x, y, z)
    q.setFromEuler(euler)
    values.push(q.x, q.y, q.z, q.w)
  }
  return values
}

function rotTrack(
  name: string,
  times: number[],
  duration: number,
  sample: (u: number) => [number, number, number],
) {
  return new THREE.QuaternionKeyframeTrack(
    `${name}.quaternion`,
    times,
    quatSamples(times, duration, sample),
  )
}

function walkClip() {
  const duration = 0.68
  const steps = 8
  const times = Array.from({ length: steps + 1 }, (_, i) => (duration * i) / steps)
  const swing = (u: number) => Math.sin(u * Math.PI * 2)
  const lift = (u: number) => Math.max(0, swing(u))
  const tracks = [
    rotTrack('hips', times, duration, (u) => [0, swing(u) * 0.08, 0]),
    rotTrack('spine', times, duration, (u) => [0.05, -swing(u) * 0.07, 0]),
    rotTrack('head', times, duration, () => [-0.04, 0, 0]),
    rotTrack('leftUpperLeg', times, duration, (u) => [0, 0, swing(u) * 0.85]),
    rotTrack('rightUpperLeg', times, duration, (u) => [0, 0, -swing(u) * 0.85]),
    rotTrack('leftLowerLeg', times, duration, (u) => [0, 0, 0.12 + lift(u) * 0.75]),
    rotTrack('rightLowerLeg', times, duration, (u) => [0, 0, 0.12 + Math.max(0, -swing(u)) * 0.75]),
    rotTrack('leftFoot', times, duration, (u) => [0, 0, -0.08 - lift(u) * 0.2]),
    rotTrack('rightFoot', times, duration, (u) => [0, 0, -0.08 - Math.max(0, -swing(u)) * 0.2]),
    rotTrack('leftUpperArm', times, duration, (u) => [-0.28, 0, -swing(u) * 0.75]),
    rotTrack('rightUpperArm', times, duration, (u) => [0.28, 0, swing(u) * 0.75]),
    rotTrack('leftLowerArm', times, duration, () => [0, 0, 0.42]),
    rotTrack('rightLowerArm', times, duration, () => [0, 0, 0.42]),
  ]
  const bob = times.flatMap((t) => [0, 0.78 + Math.abs(swing(t / duration)) * 0.045, 0])
  tracks.push(new THREE.VectorKeyframeTrack('hips.position', times, bob))
  return new THREE.AnimationClip('walk', duration, tracks)
}

function idleClip() {
  const duration = 2.4
  const times = [0, 0.6, 1.2, 1.8, 2.4]
  const breathe = (u: number) => Math.sin(u * Math.PI * 2)
  const tracks = [
    rotTrack('hips', times, duration, () => [0, 0, 0]),
    rotTrack('spine', times, duration, (u) => [0.04 + breathe(u) * 0.03, 0, 0]),
    rotTrack('head', times, duration, (u) => [-0.04 + breathe(u) * 0.02, 0, 0]),
    rotTrack('leftUpperLeg', times, duration, () => [0, 0, 0.02]),
    rotTrack('rightUpperLeg', times, duration, () => [0, 0, -0.02]),
    rotTrack('leftLowerLeg', times, duration, () => [0, 0, 0.08]),
    rotTrack('rightLowerLeg', times, duration, () => [0, 0, 0.08]),
    rotTrack('leftFoot', times, duration, () => [0, 0, -0.04]),
    rotTrack('rightFoot', times, duration, () => [0, 0, -0.04]),
    rotTrack('leftUpperArm', times, duration, (u) => [-0.22, 0, 0.08 + breathe(u) * 0.04]),
    rotTrack('rightUpperArm', times, duration, (u) => [0.22, 0, -0.08 - breathe(u) * 0.04]),
    rotTrack('leftLowerArm', times, duration, () => [0, 0, 0.35]),
    rotTrack('rightLowerArm', times, duration, () => [0, 0, 0.35]),
  ]
  const bob = times.flatMap((t) => [0, 0.78 + breathe(t / duration) * 0.012, 0])
  tracks.push(new THREE.VectorKeyframeTrack('hips.position', times, bob))
  return new THREE.AnimationClip('idle', duration, tracks)
}

export function createHerder(): HerderState {
  const group = new THREE.Group()
  group.name = 'herder'

  const hips = joint('hips', group, 0, 0.78, 0)
  const spine = joint('spine', hips, 0, 0.06, 0)
  mesh(spine, new THREE.CapsuleGeometry(0.15, 0.28, 6, 12), SHIRT, 0.02, 0.2, 0)

  const head = joint('head', spine, 0.02, 0.46, 0)
  mesh(head, new THREE.SphereGeometry(0.16, 20, 16), SKIN, 0, 0.02, 0)
  const hair = mesh(head, new THREE.SphereGeometry(0.15, 16, 12), HAIR, -0.03, 0.1, 0)
  hair.scale.set(1.05, 0.72, 1.05)
  mesh(head, new THREE.SphereGeometry(0.028, 10, 8), EYE, 0.13, 0.04, 0.055)
  mesh(head, new THREE.SphereGeometry(0.028, 10, 8), EYE, 0.13, 0.04, -0.055)
  mesh(head, new THREE.SphereGeometry(0.03, 8, 6), SKIN, 0.15, -0.01, 0).scale.set(1, 0.7, 0.8)

  const arm = (side: 'left' | 'right', z: number) => {
    const upper = joint(`${side}UpperArm`, spine, 0.02, 0.34, z)
    mesh(upper, new THREE.CapsuleGeometry(0.05, 0.2, 4, 8), SHIRT, 0, -0.12, 0)
    const lower = joint(`${side}LowerArm`, upper, 0, -0.24, 0)
    mesh(lower, new THREE.CapsuleGeometry(0.042, 0.18, 4, 8), SKIN, 0, -0.12, 0)
    mesh(lower, new THREE.SphereGeometry(0.048, 10, 8), SKIN, 0.02, -0.24, 0)
  }
  arm('left', 0.2)
  arm('right', -0.2)

  const leg = (side: 'left' | 'right', z: number) => {
    const upper = joint(`${side}UpperLeg`, hips, 0, 0, z)
    mesh(upper, new THREE.CapsuleGeometry(0.07, 0.26, 4, 8), PANTS, 0, -0.16, 0)
    const lower = joint(`${side}LowerLeg`, upper, 0, -0.32, 0)
    mesh(lower, new THREE.CapsuleGeometry(0.055, 0.24, 4, 8), PANTS, 0, -0.14, 0)
    const foot = joint(`${side}Foot`, lower, 0, -0.28, 0)
    const shoe = mesh(foot, new THREE.SphereGeometry(0.07, 12, 8), SHOE, 0.05, -0.02, 0)
    shoe.scale.set(1.35, 0.65, 0.85)
  }
  leg('left', 0.1)
  leg('right', -0.1)

  const shade = blobShadow(0.42, 0.28, 0.9)
  shade.position.set(0.04, 0.02, 0)
  group.add(shade)

  const mixer = new THREE.AnimationMixer(group)
  const idle = mixer.clipAction(idleClip())
  const walk = mixer.clipAction(walkClip())
  idle.play()
  mixer.update(0)

  return { group, mixer, idle, walk, current: idle }
}

export function stepHerder(state: HerderState, dt: number, power: number) {
  const moving = power > 0.08
  const next = moving ? state.walk : state.idle
  if (state.current !== next) {
    next.reset().fadeIn(0.16).play()
    state.current.fadeOut(0.16)
    state.current = next
  }
  if (moving) state.walk.setEffectiveTimeScale(0.8 + power * 0.75)
  state.mixer.update(dt)
}
