import * as THREE from 'three'
import {
  groundHeight,
  hitsWater,
  pushOutOfWater,
  slopeDrift,
  type LevelId,
} from './levels'
import { blobShadow, clay, felt } from './materials'
import { herdTarget, hitsFence, penIndexAt } from './pen'

export type SheepMode = 'wander' | 'graze' | 'flee' | 'penned'

export type SheepState = {
  group: THREE.Group
  headPivot: THREE.Group
  mode: SheepMode
  velocity: THREE.Vector2
  timer: number
  phaseOffset: number
  penIndex: number
  homeX: number
  homeZ: number
  bumpCooldown: number
  fleeCarry: number
}

export type SheepEvent = {
  kind: 'fence' | 'penned'
  x: number
  z: number
  nx: number
  nz: number
  penIndex: number
}

const WOOL_PAIRS: [number, number][] = [
  [0xfdfaf3, 0xf2eadc],
  [0xfffdf8, 0xf5efe3],
  [0xf6f0e4, 0xeae1cf],
]
const COCOA_FACE = 0x735846
const COCOA_EAR = 0x866854

function puff(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  r: number,
  pairIndex: number,
) {
  const [base, accent] = WOOL_PAIRS[pairIndex % WOOL_PAIRS.length]
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(r, 16, 12),
    felt(base, accent, 1, 0.036),
  )
  m.position.set(x, y, z)
  m.castShadow = true
  m.receiveShadow = true
  parent.add(m)
}

export function createSheep(): SheepState {
  const group = new THREE.Group()
  group.name = 'sheep'

  const blobs: [number, number, number, number][] = [
    [0, 0.35, 0, 0.27],
    [-0.17, 0.39, 0.08, 0.21],
    [0.14, 0.41, -0.06, 0.2],
    [-0.06, 0.49, -0.1, 0.18],
    [0.08, 0.51, 0.1, 0.17],
    [0.02, 0.45, 0.15, 0.15],
    [-0.13, 0.33, -0.13, 0.16],
    [0.17, 0.35, 0.08, 0.14],
    [-0.02, 0.54, 0, 0.14],
    [0.06, 0.37, -0.14, 0.13],
    // Fluffy little puff tail
    [-0.28, 0.38, 0, 0.09],
  ]
  blobs.forEach(([x, y, z, r], i) => puff(group, x, y, z, r, i))

  const headPivot = new THREE.Group()
  headPivot.position.set(0.22, 0.36, 0)
  group.add(headPivot)

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.115, 16, 14),
    clay(COCOA_FACE, 0.86),
  )
  head.scale.set(1.18, 0.94, 0.96)
  head.position.set(0.1, 0, 0)
  head.castShadow = true
  headPivot.add(head)

  // Cream wool bang tuft on top of head
  const bang = new THREE.Mesh(
    new THREE.SphereGeometry(0.085, 12, 10),
    felt(0xfffdf8, 0xf3ecde, 1, 0.03),
  )
  bang.scale.set(1.05, 0.72, 1.08)
  bang.position.set(0.075, 0.09, 0)
  headPivot.add(bang)

  // Soft drooping cocoa ears
  const earMat = clay(COCOA_EAR, 0.88)
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.048, 10, 8), earMat)
    ear.scale.set(0.62, 1.18, 0.45)
    ear.position.set(0.07, 0.01, side * 0.112)
    ear.rotation.x = side * 0.42
    headPivot.add(ear)
  }

  // Expressive glossy dark eyes with soft white sclera
  const scleraMat = clay(0xfffdf8, 0.45)
  const pupilMat = clay(0x231b16, 0.25)
  for (const z of [-0.042, 0.042]) {
    const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.025, 10, 8), scleraMat)
    sclera.position.set(0.185, 0.022, z)
    headPivot.add(sclera)
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), pupilMat)
    pupil.position.set(0.203, 0.022, z * 1.04)
    headPivot.add(pupil)
  }

  // Stubby warm cocoa plush legs
  const legMat = clay(COCOA_FACE, 0.88)
  for (const [x, z] of [
    [-0.1, -0.09],
    [0.1, -0.09],
    [-0.08, 0.09],
    [0.08, 0.09],
  ] as const) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.036, 0.12, 4, 8), legMat)
    leg.position.set(x, 0.1, z)
    leg.castShadow = true
    group.add(leg)
  }

  const shade = blobShadow(0.45, 0.31, 0.88)
  shade.position.set(0.05, 0.024, 0.06)
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
    penIndex: -1,
    homeX: 0,
    homeZ: 0,
    bumpCooldown: 0,
    fleeCarry: 0,
  }
}

export function resetSheep(s: SheepState, level: LevelId = 1) {
  s.penIndex = -1
  s.mode = Math.random() > 0.45 ? 'wander' : 'graze'
  s.velocity.set(0, 0)
  if (s.mode === 'wander') {
    const a = Math.random() * Math.PI * 2
    const speed = 0.4 + Math.random() * 0.35
    s.velocity.set(Math.cos(a) * speed, Math.sin(a) * speed)
    s.group.rotation.y = Math.atan2(-s.velocity.y, s.velocity.x)
  }
  s.timer = 0.6 + Math.random() * 2
  s.bumpCooldown = 0
  s.fleeCarry = 0
  s.group.visible = true
  s.group.position.set(s.homeX, groundHeight(level, s.homeX, s.homeZ), s.homeZ)
  s.headPivot.rotation.x = s.mode === 'graze' ? -0.62 : -0.08
}

const BOUND = 6.9
/** How close the herder must be before a sheep starts to run. The ground ring uses this. */
export const SHEEP_FEAR = 4.6
const FEAR = SHEEP_FEAR
const CAPTURE = 1.2
const COHESION = 2.7

/** Wander, graze, flee from the herder, or stay locked in a corner pen. */
export function stepSheep(
  s: SheepState,
  dt: number,
  t: number,
  herderX: number,
  herderZ: number,
  flock: { x: number; z: number }[] = [],
  level: LevelId = 1,
): SheepEvent | null {
  s.bumpCooldown = Math.max(0, s.bumpCooldown - dt)
  s.fleeCarry = Math.max(0, s.fleeCarry - dt)
  if (s.mode === 'penned' && s.penIndex >= 0) {
    s.group.visible = false
    s.velocity.set(0, 0)
    return null
  }

  const dx = s.group.position.x - herderX
  const dz = s.group.position.z - herderZ
  const dist = Math.hypot(dx, dz)
  const afraid = dist < FEAR && dist > 0.001

  if (afraid) {
    s.mode = 'flee'
    s.fleeCarry = 1.05
    s.velocity.copy(fleeVelocity(s, dx / dist, dz / dist, dist, flock, true))
  } else if (s.mode === 'flee' && s.fleeCarry > 0 && dist > 0.001) {
    s.velocity.copy(fleeVelocity(s, dx / dist, dz / dist, dist, flock, false))
  } else if (s.mode === 'flee') {
    s.mode = 'wander'
    s.timer = 0.7 + Math.random() * 1.1
  }

  if (s.mode !== 'flee') {
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
  }

  if (s.mode !== 'flee') {
    const pull = mouthPull(s)
    if (pull) s.velocity.copy(pull)
  }

  const px0 = s.group.position.x
  const pz0 = s.group.position.z
  let drift = slopeDrift(level, px0, pz0)
  if (drift > 0 && hitsWater(level, px0, pz0 + 0.08, 0.26)) drift = 0
  if (s.mode === 'graze' && s.velocity.lengthSq() < 0.0001 && drift === 0) {
    s.group.position.y = groundHeight(level, px0, pz0)
    s.headPivot.rotation.x = -0.62 + Math.sin(t * 1.15 + s.phaseOffset) * 0.045
    return null
  }

  const prevX = px0
  const prevZ = pz0
  let nx = clamp(prevX + s.velocity.x * dt, -BOUND, BOUND)
  let nz = clamp(prevZ + (s.velocity.y + drift) * dt, -BOUND, BOUND)
  if (hitsWater(level, nx, nz, 0.26)) {
    const dry = pushOutOfWater(level, nx, nz, 0.26)
    nx = clamp(dry.x, -BOUND, BOUND)
    nz = clamp(dry.z, -BOUND, BOUND)
  }
  const enteredEarly = penIndexAt(nx, nz, CAPTURE)
  if (enteredEarly >= 0) {
    return penned(s, nx, nz, enteredEarly)
  }
  let fence: SheepEvent | null = null
  if (hitsFence(nx, nz, 0.26)) {
    const goal = herdTarget(prevX, prevZ, s.velocity.x, s.velocity.y)
    const slideX = prevX + (goal.x - prevX) * 0.18
    const slideZ = prevZ + (goal.z - prevZ) * 0.18
    const slipped = penIndexAt(slideX, slideZ, CAPTURE + 0.35)
    if (slipped >= 0) return penned(s, slideX, slideZ, slipped)
    if (!hitsFence(slideX, slideZ, 0.22)) {
      nx = slideX
      nz = slideZ
    } else {
      const vx = s.velocity.x
      const vz = s.velocity.y
      s.velocity.multiplyScalar(-1)
      nx = prevX
      nz = prevZ
      fence = { kind: 'fence', x: prevX, z: prevZ, nx: -vx, nz: -vz, penIndex: -1 }
    }
  }
  if (hitsWater(level, nx, nz, 0.26)) {
    const dry = pushOutOfWater(level, nx, nz, 0.26)
    nx = clamp(dry.x, -BOUND, BOUND)
    nz = clamp(dry.z, -BOUND, BOUND)
  }
  s.group.position.x = nx
  s.group.position.z = nz

  const entered = penIndexAt(nx, nz, CAPTURE)
  if (entered >= 0) return penned(s, nx, nz, entered)

  if (s.velocity.lengthSq() > 0.0001) {
    const facing = Math.atan2(-s.velocity.y, s.velocity.x)
    s.group.rotation.y = dampAngle(s.group.rotation.y, facing, dt)
  }
  const bob = s.mode === 'graze' ? 0 : Math.abs(Math.sin(t * 7 + s.phaseOffset)) * 0.035
  s.group.position.y = groundHeight(level, nx, nz) + bob
  s.headPivot.rotation.x = s.mode === 'graze'
    ? -0.62 + Math.sin(t * 1.15 + s.phaseOffset) * 0.045
    : -0.08
  return fence
}

function fleeVelocity(
  s: SheepState,
  awayX: number,
  awayZ: number,
  dist: number,
  flock: { x: number; z: number }[],
  afraid: boolean,
) {
  let vx = awayX
  let vz = awayZ
  let cx = 0
  let cz = 0
  let n = 0
  const sx = s.group.position.x
  const sz = s.group.position.z
  for (const other of flock) {
    const ox = other.x - sx
    const oz = other.z - sz
    const od = Math.hypot(ox, oz)
    if (od > 0.08 && od < COHESION) {
      cx += other.x
      cz += other.z
      n++
    }
  }
  if (n > 0) {
    const tx = cx / n - sx
    const tz = cz / n - sz
    const td = Math.hypot(tx, tz) || 1
    vx += (tx / td) * 0.34
    vz += (tz / td) * 0.34
  }
  const goal = herdTarget(sx, sz, vx, vz)
  const gx = goal.x - sx
  const gz = goal.z - sz
  const gd = Math.hypot(gx, gz) || 1
  vx = vx * (1 - goal.weight) + (gx / gd) * goal.weight
  vz = vz * (1 - goal.weight) + (gz / gd) * goal.weight
  const len = Math.hypot(vx, vz) || 1
  const closeness = afraid ? Math.max(0, 1 - dist / FEAR) : 0.4
  const speed = afraid ? 1.15 + closeness * 0.4 : 1.12
  return new THREE.Vector2((vx / len) * speed, (vz / len) * speed)
}

/** Finish the last steps into a pen once a shove has already brought the sheep close. */
function mouthPull(s: SheepState) {
  const sx = s.group.position.x
  const sz = s.group.position.z
  const goal = herdTarget(sx, sz, s.velocity.x, s.velocity.y)
  const gx = goal.x - sx
  const gz = goal.z - sz
  const gd = Math.hypot(gx, gz)
  if (gd > 3.2 || gd < 0.05) return null
  return new THREE.Vector2((gx / gd) * 0.95, (gz / gd) * 0.95)
}

function penned(s: SheepState, x: number, z: number, index: number): SheepEvent {
  s.mode = 'penned'
  s.penIndex = index
  s.group.visible = false
  s.velocity.set(0, 0)
  s.group.position.set(x, 0, z)
  return {
    kind: 'penned',
    x,
    z,
    nx: -Math.sign(x),
    nz: -Math.sign(z),
    penIndex: index,
  }
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