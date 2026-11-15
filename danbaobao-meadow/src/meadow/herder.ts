import * as THREE from 'three'
import { blobShadow, clay } from './materials'

/**
 * Clay herder skinned to a humanoid skeleton.
 * Playback follows the official three.js sample: every clip stays active,
 * weights blend with crossFadeTo.
 * https://github.com/mrdoob/three.js/blob/dev/examples/webgl_animation_skinning_blending.html
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
  run: THREE.AnimationAction
  current: THREE.AnimationAction
}

function joint(name: string, parent: THREE.Object3D, x: number, y: number, z: number) {
  const bone = new THREE.Bone()
  bone.name = name
  bone.position.set(x, y, z)
  parent.add(bone)
  return bone
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

function rot(
  name: string,
  times: number[],
  duration: number,
  sample: (u: number) => [number, number, number],
) {
  return new THREE.QuaternionKeyframeTrack(`${name}.quaternion`, times, quatSamples(times, duration, sample))
}

function timesOf(duration: number, steps: number) {
  return Array.from({ length: steps + 1 }, (_, i) => (duration * i) / steps)
}

function locomotionClip(name: string, duration: number, amp: number) {
  const times = timesOf(duration, 8)
  const swing = (u: number) => Math.sin(u * Math.PI * 2) * amp
  const lift = (u: number, sign: number) => Math.max(0, sign * Math.sin(u * Math.PI * 2)) * amp
  const tracks: THREE.KeyframeTrack[] = [
    rot('hips', times, duration, (u) => [0, swing(u) * 0.1, 0]),
    rot('spine', times, duration, (u) => [0.05, -swing(u) * 0.08, 0]),
    rot('head', times, duration, () => [-0.04, 0, 0]),
    rot('leftUpperLeg', times, duration, (u) => [0, 0, swing(u) * 0.85]),
    rot('rightUpperLeg', times, duration, (u) => [0, 0, -swing(u) * 0.85]),
    rot('leftLowerLeg', times, duration, (u) => [0, 0, 0.12 + lift(u, 1) * 0.75]),
    rot('rightLowerLeg', times, duration, (u) => [0, 0, 0.12 + lift(u, -1) * 0.75]),
    rot('leftFoot', times, duration, (u) => [0, 0, -0.08 - lift(u, 1) * 0.2]),
    rot('rightFoot', times, duration, (u) => [0, 0, -0.08 - lift(u, -1) * 0.2]),
    rot('leftUpperArm', times, duration, (u) => [-0.28, 0, -swing(u) * 0.75]),
    rot('rightUpperArm', times, duration, (u) => [0.28, 0, swing(u) * 0.75]),
    rot('leftLowerArm', times, duration, (u) => [0, 0, 0.4 + lift(u, -1) * 0.2]),
    rot('rightLowerArm', times, duration, (u) => [0, 0, 0.4 + lift(u, 1) * 0.2]),
  ]
  const bob = times.flatMap((t) => [0, 0.78 + Math.abs(Math.sin((t / duration) * Math.PI * 2)) * 0.05 * amp, 0])
  tracks.push(new THREE.VectorKeyframeTrack('hips.position', times, bob))
  return new THREE.AnimationClip(name, duration, tracks)
}

function idleClip() {
  const duration = 2.4
  const times = timesOf(duration, 4)
  const breathe = (u: number) => Math.sin(u * Math.PI * 2)
  const tracks: THREE.KeyframeTrack[] = [
    rot('hips', times, duration, () => [0, 0, 0]),
    rot('spine', times, duration, (u) => [0.04 + breathe(u) * 0.03, 0, 0]),
    rot('head', times, duration, (u) => [-0.04 + breathe(u) * 0.02, 0, 0]),
    rot('leftUpperLeg', times, duration, () => [0, 0, 0.02]),
    rot('rightUpperLeg', times, duration, () => [0, 0, -0.02]),
    rot('leftLowerLeg', times, duration, () => [0, 0, 0.08]),
    rot('rightLowerLeg', times, duration, () => [0, 0, 0.08]),
    rot('leftFoot', times, duration, () => [0, 0, -0.04]),
    rot('rightFoot', times, duration, () => [0, 0, -0.04]),
    rot('leftUpperArm', times, duration, (u) => [-0.22, 0, 0.08 + breathe(u) * 0.04]),
    rot('rightUpperArm', times, duration, (u) => [0.22, 0, -0.08 - breathe(u) * 0.04]),
    rot('leftLowerArm', times, duration, () => [0, 0, 0.35]),
    rot('rightLowerArm', times, duration, () => [0, 0, 0.35]),
  ]
  const bob = times.flatMap((t) => [0, 0.78 + breathe(t / duration) * 0.012, 0])
  tracks.push(new THREE.VectorKeyframeTrack('hips.position', times, bob))
  return new THREE.AnimationClip('idle', duration, tracks)
}

function skinPart(
  group: THREE.Group,
  skeleton: THREE.Skeleton,
  bone: THREE.Bone,
  geometry: THREE.BufferGeometry,
  color: number,
  x: number,
  y: number,
  z: number,
  sx = 1,
  sy = 1,
  sz = 1,
) {
  const local = new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion(),
    new THREE.Vector3(sx, sy, sz),
  )
  geometry.applyMatrix4(bone.matrixWorld.clone().multiply(local))
  const count = geometry.attributes.position.count
  const indices = new Uint16Array(count * 4)
  const weights = new Float32Array(count * 4)
  const index = skeleton.bones.indexOf(bone)
  for (let i = 0; i < count; i++) {
    indices[i * 4] = index
    weights[i * 4] = 1
  }
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4))
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4))
  const mesh = new THREE.SkinnedMesh(geometry, clay(color))
  mesh.castShadow = true
  mesh.frustumCulled = false
  group.add(mesh)
  mesh.bind(skeleton)
  return mesh
}

/** Same weight setup as the three.js skinning example: all clips play, one has weight 1. */
function setWeight(action: THREE.AnimationAction, weight: number) {
  action.enabled = true
  action.setEffectiveTimeScale(1)
  action.setEffectiveWeight(weight)
}

function arm(spine: THREE.Bone, side: 'left' | 'right', z: number) {
  const upper = joint(`${side}UpperArm`, spine, 0.02, 0.34, z)
  const lower = joint(`${side}LowerArm`, upper, 0, -0.24, 0)
  return { upper, lower }
}

function leg(hips: THREE.Bone, side: 'left' | 'right', z: number) {
  const upper = joint(`${side}UpperLeg`, hips, 0, 0, z)
  const lower = joint(`${side}LowerLeg`, upper, 0, -0.32, 0)
  const foot = joint(`${side}Foot`, lower, 0, -0.28, 0)
  return { upper, lower, foot }
}

export function createHerder(): HerderState {
  const group = new THREE.Group()
  group.name = 'herder'

  const hips = joint('hips', group, 0, 0.78, 0)
  const spine = joint('spine', hips, 0, 0.06, 0)
  const head = joint('head', spine, 0.02, 0.46, 0)
  const leftArm = arm(spine, 'left', 0.2)
  const rightArm = arm(spine, 'right', -0.2)
  const leftLeg = leg(hips, 'left', 0.1)
  const rightLeg = leg(hips, 'right', -0.1)

  group.updateMatrixWorld(true)
  const bones: THREE.Bone[] = []
  hips.traverse((obj) => {
    if (obj instanceof THREE.Bone) bones.push(obj)
  })
  const skeleton = new THREE.Skeleton(bones)

  const part = (
    bone: THREE.Bone,
    geometry: THREE.BufferGeometry,
    color: number,
    x: number,
    y: number,
    z: number,
    sx = 1,
    sy = 1,
    sz = 1,
  ) => skinPart(group, skeleton, bone, geometry, color, x, y, z, sx, sy, sz)

  part(spine, new THREE.CapsuleGeometry(0.15, 0.28, 6, 12), SHIRT, 0.02, 0.2, 0)
  part(head, new THREE.SphereGeometry(0.16, 20, 16), SKIN, 0, 0.02, 0)
  part(head, new THREE.SphereGeometry(0.15, 16, 12), HAIR, -0.03, 0.1, 0, 1.05, 0.72, 1.05)
  part(head, new THREE.SphereGeometry(0.028, 10, 8), EYE, 0.13, 0.04, 0.055)
  part(head, new THREE.SphereGeometry(0.028, 10, 8), EYE, 0.13, 0.04, -0.055)
  part(head, new THREE.SphereGeometry(0.03, 8, 6), SKIN, 0.15, -0.01, 0, 1, 0.7, 0.8)

  part(leftArm.upper, new THREE.CapsuleGeometry(0.05, 0.2, 4, 8), SHIRT, 0, -0.12, 0)
  part(leftArm.lower, new THREE.CapsuleGeometry(0.042, 0.18, 4, 8), SKIN, 0, -0.12, 0)
  part(leftArm.lower, new THREE.SphereGeometry(0.048, 10, 8), SKIN, 0.02, -0.24, 0)
  part(rightArm.upper, new THREE.CapsuleGeometry(0.05, 0.2, 4, 8), SHIRT, 0, -0.12, 0)
  part(rightArm.lower, new THREE.CapsuleGeometry(0.042, 0.18, 4, 8), SKIN, 0, -0.12, 0)
  part(rightArm.lower, new THREE.SphereGeometry(0.048, 10, 8), SKIN, 0.02, -0.24, 0)

  for (const limb of [leftLeg, rightLeg]) {
    part(limb.upper, new THREE.CapsuleGeometry(0.07, 0.26, 4, 8), PANTS, 0, -0.16, 0)
    part(limb.lower, new THREE.CapsuleGeometry(0.055, 0.24, 4, 8), PANTS, 0, -0.14, 0)
    part(limb.foot, new THREE.SphereGeometry(0.07, 12, 8), SHOE, 0.05, -0.02, 0, 1.35, 0.65, 0.85)
  }

  const shade = blobShadow(0.42, 0.28, 0.9)
  shade.position.set(0.04, 0.02, 0)
  group.add(shade)

  const mixer = new THREE.AnimationMixer(group)
  const idle = mixer.clipAction(idleClip())
  const walk = mixer.clipAction(locomotionClip('walk', 0.68, 1))
  const run = mixer.clipAction(locomotionClip('run', 0.46, 1.25))
  for (const action of [idle, walk, run]) action.play()
  setWeight(idle, 1)
  setWeight(walk, 0)
  setWeight(run, 0)
  mixer.update(0)

  return { group, mixer, idle, walk, run, current: idle }
}

function crossFade(state: HerderState, next: THREE.AnimationAction, duration: number) {
  setWeight(next, 1)
  next.time = 0
  state.current.crossFadeTo(next, duration, true)
  state.current = next
}

export function stepHerder(state: HerderState, dt: number, power: number) {
  const next = power > 0.72 ? state.run : power > 0.08 ? state.walk : state.idle
  if (state.current !== next) {
    const fromIdle = state.current === state.idle
    crossFade(state, next, fromIdle ? 0.35 : 0.28)
  }
  state.mixer.timeScale = next === state.idle ? 1 : 0.85 + power * 0.5
  state.mixer.update(dt)
}

export function resetHerder(state: HerderState) {
  for (const action of [state.idle, state.walk, state.run]) {
    action.reset().play()
  }
  setWeight(state.idle, 1)
  setWeight(state.walk, 0)
  setWeight(state.run, 0)
  state.current = state.idle
  state.mixer.timeScale = 1
  state.mixer.update(0)
}
