import * as THREE from 'three'
import {
  groundHeight,
  hitsWater,
  penLift,
  pushOutOfWater,
  slopeDrift,
  type LevelId,
} from './levels'
import { blobShadow, clay, felt } from './materials'
import { assignSinglePenSpot, herdTarget, hitsFence, penIndexAt } from './pen'
import { bounceInArena } from './physics'

export type SheepMode = 'wander' | 'graze' | 'flee' | 'penned'

export type SheepState = {
  group: THREE.Group
  bodyPivot: THREE.Group
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
  slideCarry: number
  sliding: boolean
  isGolden: boolean
  penHopT: number
  penStartX: number
  penStartZ: number
  penTargetX: number
  penTargetZ: number
}

export type SheepEvent = {
  kind: 'fence' | 'penned' | 'slideStart'
  x: number
  z: number
  nx: number
  nz: number
  penIndex: number
  isGolden: boolean
}

const WOOL_PAIRS: [number, number][] = [
  [0xfdfaf3, 0xf2eadc],
  [0xfffdf8, 0xf5efe3],
  [0xf6f0e4, 0xeae1cf],
]
const GOLD_WOOL_PAIRS: [number, number][] = [
  [0xfae29c, 0xe8c468],
  [0xfff0b8, 0xf0cf76],
  [0xf3d47f, 0xe2ba58],
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
  isGolden: boolean,
) {
  const table = isGolden ? GOLD_WOOL_PAIRS : WOOL_PAIRS
  const [base, accent] = table[pairIndex % table.length]
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(r, 16, 12),
    felt(base, accent, 1, 0.036),
  )
  m.position.set(x, y, z)
  m.castShadow = true
  m.receiveShadow = true
  parent.add(m)
}

export function createSheep(isGolden = false): SheepState {
  const group = new THREE.Group()
  group.name = isGolden ? 'sheep_golden' : 'sheep'

  const bodyPivot = new THREE.Group()
  group.add(bodyPivot)

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
    [-0.28, 0.38, 0, 0.09],
  ]
  blobs.forEach(([x, y, z, r], i) => puff(bodyPivot, x, y, z, r, i, isGolden))

  const headPivot = new THREE.Group()
  headPivot.position.set(0.22, 0.36, 0)
  bodyPivot.add(headPivot)

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.115, 16, 14),
    clay(COCOA_FACE, 0.86),
  )
  head.scale.set(1.18, 0.94, 0.96)
  head.position.set(0.1, 0, 0)
  head.castShadow = true
  headPivot.add(head)

  const bang = new THREE.Mesh(
    new THREE.SphereGeometry(0.085, 12, 10),
    isGolden ? felt(0xfff1bf, 0xedd07c, 1, 0.03) : felt(0xfffdf8, 0xf3ecde, 1, 0.03),
  )
  bang.scale.set(1.05, 0.72, 1.08)
  bang.position.set(0.075, 0.09, 0)
  headPivot.add(bang)

  // Golden Crown Lead Sheep wears a miniature warm-gold crown (+3 bonus!)
  if (isGolden) {
    const crownMat = new THREE.MeshStandardMaterial({
      color: 0xffd75e,
      roughness: 0.32,
      metalness: 0.22,
    })
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.062, 0.06, 10), crownMat)
    band.position.set(0.075, 0.155, 0)
    headPivot.add(band)
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.065, 6), crownMat)
      tip.position.set(0.075 + Math.cos(a) * 0.052, 0.2, Math.sin(a) * 0.052)
      headPivot.add(tip)
    }
  }

  const earMat = clay(COCOA_EAR, 0.88)
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.048, 10, 8), earMat)
    ear.scale.set(0.62, 1.18, 0.45)
    ear.position.set(0.07, 0.01, side * 0.112)
    ear.rotation.x = side * 0.42
    headPivot.add(ear)
  }

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
    bodyPivot.add(leg)
  }

  // Subtle ice-mirror reflection disc + warm contact shadow
  const iceRefl = new THREE.Mesh(
    new THREE.CircleGeometry(0.32, 16),
    new THREE.MeshBasicMaterial({
      color: isGolden ? 0xf6de97 : 0xeef5f7,
      transparent: true,
      opacity: 0.26,
      depthWrite: false,
    }),
  )
  iceRefl.rotation.x = -Math.PI / 2
  iceRefl.scale.set(1.2, 0.9, 1)
  iceRefl.position.set(0, 0.02, 0)
  group.add(iceRefl)

  const shade = blobShadow(0.45, 0.31, 0.72)
  shade.position.set(0.05, 0.026, 0.06)
  group.add(shade)

  const mode: SheepMode = Math.random() > 0.4 ? 'wander' : 'graze'
  const velocity = new THREE.Vector2()
  if (mode === 'wander') {
    const a = Math.random() * Math.PI * 2
    const speed = 0.42 + Math.random() * 0.35
    velocity.set(Math.cos(a) * speed, Math.sin(a) * speed)
  } else {
    headPivot.rotation.x = -0.62
  }

  return {
    group,
    bodyPivot,
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
    slideCarry: 0,
    sliding: false,
    isGolden,
    penHopT: 1,
    penStartX: 0,
    penStartZ: 0,
    penTargetX: 0,
    penTargetZ: 0,
  }
}

export function resetSheep(s: SheepState, level: LevelId = 1) {
  s.penIndex = -1
  s.mode = Math.random() > 0.45 ? 'wander' : 'graze'
  s.velocity.set(0, 0)
  if (s.mode === 'wander') {
    const a = Math.random() * Math.PI * 2
    const speed = 0.42 + Math.random() * 0.35
    s.velocity.set(Math.cos(a) * speed, Math.sin(a) * speed)
    s.group.rotation.y = Math.atan2(-s.velocity.y, s.velocity.x)
  }
  s.timer = 0.6 + Math.random() * 2
  s.bumpCooldown = 0
  s.fleeCarry = 0
  s.slideCarry = 0
  s.sliding = false
  s.penHopT = 1
  s.bodyPivot.rotation.set(0, 0, 0)
  s.bodyPivot.position.set(0, 0, 0)
  s.bodyPivot.scale.set(1, 1, 1)
  s.group.visible = true
  s.group.position.set(s.homeX, groundHeight(level, s.homeX, s.homeZ), s.homeZ)
  s.headPivot.rotation.x = s.mode === 'graze' ? -0.62 : -0.08
}

const BOUND = 7.05
export const SHEEP_FEAR = 4.6
const FEAR = SHEEP_FEAR
const CAPTURE = 1.1
const COHESION = 2.7
const ICE_GLIDE_DRAG = 1.55

/** Pick a cozy non-overlapping straw spot inside the single grand pen so penned sheep stay visible! */
function assignPenSpot(_penIndex: number, existingCountInPen: number): [number, number] {
  return assignSinglePenSpot(existingCountInPen)
}

/**
 * Penguin-Pushers-style icy sliding sheep physics:
 * - Preserves momentum & external bump impulses with low ice friction
 * - Enters visible belly-sliding posture when pushed or fleeing fast
 * - Jumps joyfully into the corner pen and stays visible bobbing on the straw!
 */
export function stepSheep(
  s: SheepState,
  dt: number,
  t: number,
  herderX: number,
  herderZ: number,
  flock: { x: number; z: number }[] = [],
  level: LevelId = 1,
  penSlotCounter?: (penIndex: number) => number,
): SheepEvent | null {
  s.bumpCooldown = Math.max(0, s.bumpCooldown - dt)
  s.fleeCarry = Math.max(0, s.fleeCarry - dt)
  s.slideCarry = Math.max(0, s.slideCarry - dt)

  // Penned sheep stay visible & cheerfully hop into their cozy straw spot!
  if (s.mode === 'penned' && s.penIndex >= 0) {
    s.group.visible = true
    s.sliding = false
    const baseY = penLift(level, s.penIndex) + 0.04
    if (s.penHopT < 1) {
      s.penHopT = Math.min(1, s.penHopT + dt / 0.38)
      const u = s.penHopT
      const ease = 1 - (1 - u) * (1 - u)
      s.group.position.x = s.penStartX + (s.penTargetX - s.penStartX) * ease
      s.group.position.z = s.penStartZ + (s.penTargetZ - s.penStartZ) * ease
      const arc = Math.sin(u * Math.PI) * 0.95
      s.group.position.y = baseY + arc
      s.bodyPivot.rotation.z = Math.sin(u * Math.PI) * 0.25
      s.bodyPivot.scale.set(1.06, 0.94, 1.06)
    } else {
      const happyBob = Math.abs(Math.sin(t * 3.8 + s.phaseOffset)) * 0.055
      s.group.position.set(s.penTargetX, baseY + happyBob, s.penTargetZ)
      s.bodyPivot.rotation.z += (0 - s.bodyPivot.rotation.z) * Math.min(1, dt * 10)
      s.bodyPivot.scale.set(1, 1, 1)
      s.headPivot.rotation.x = -0.18 + Math.sin(t * 2.4 + s.phaseOffset) * 0.14
    }
    return null
  }

  const dx = s.group.position.x - herderX
  const dz = s.group.position.z - herderZ
  const dist = Math.hypot(dx, dz)
  const afraid = dist < FEAR && dist > 0.001
  const wasSliding = s.sliding

  if (afraid) {
    if (s.mode !== 'flee') {
      // Initial startle burst triggers penguin belly-slide!
      s.slideCarry = Math.max(s.slideCarry, 0.65)
    }
    s.mode = 'flee'
    s.fleeCarry = 1.15
    const desired = fleeVelocity(s, dx / dist, dz / dist, dist, flock, true, s.isGolden)
    // Smooth momentum blending on ice (preserves high-speed bump slides!)
    const steer = Math.min(1, dt * 3.6)
    s.velocity.x += (desired.x - s.velocity.x) * steer
    s.velocity.y += (desired.y - s.velocity.y) * steer
  } else if (s.mode === 'flee' && s.fleeCarry > 0 && dist > 0.001) {
    const desired = fleeVelocity(s, dx / dist, dz / dist, dist, flock, false, s.isGolden)
    const steer = Math.min(1, dt * 2.4)
    s.velocity.x += (desired.x - s.velocity.x) * steer
    s.velocity.y += (desired.y - s.velocity.y) * steer
  } else if (s.mode === 'flee') {
    s.mode = 'wander'
    s.timer = 0.7 + Math.random() * 1.1
  }

  if (s.mode !== 'flee') {
    // Low-friction ice glide decay so bumped sheep slide a generous distance!
    const drag = Math.exp(-ICE_GLIDE_DRAG * dt)
    s.velocity.multiplyScalar(drag)

    const curSpeed = s.velocity.length()
    if (curSpeed < 0.75) {
      s.timer -= dt
      if (s.timer <= 0) {
        if (s.mode === 'wander') {
          s.mode = 'graze'
          s.timer = 1.1 + Math.random() * 2.0
        } else {
          s.mode = 'wander'
          const a = Math.random() * Math.PI * 2
          const speed = (s.isGolden ? 0.65 : 0.45) + Math.random() * 0.4
          s.velocity.set(Math.cos(a) * speed, Math.sin(a) * speed)
          s.timer = 1.6 + Math.random() * 2.2
        }
      }
    }

    const pull = mouthPull(s)
    if (pull) {
      s.velocity.x += (pull.x - s.velocity.x) * Math.min(1, dt * 4.5)
      s.velocity.y += (pull.y - s.velocity.y) * Math.min(1, dt * 4.5)
    }
  }

  const px0 = s.group.position.x
  const pz0 = s.group.position.z
  let drift = slopeDrift(level, px0, pz0) * 1.55
  if (drift > 0 && hitsWater(level, px0, pz0 + 0.08, 0.26)) drift = 0

  const speedNow = Math.hypot(s.velocity.x, s.velocity.y + drift)
  s.sliding = speedNow > 1.85 || (s.slideCarry > 0 && speedNow > 1.15)
  let slideEvent: SheepEvent | null = null
  if (!wasSliding && s.sliding && speedNow > 2.2) {
    slideEvent = { kind: 'slideStart', x: px0, z: pz0, nx: 0, nz: 0, penIndex: -1, isGolden: s.isGolden }
  }

  if (s.mode === 'graze' && speedNow < 0.05 && drift === 0) {
    s.group.position.y = groundHeight(level, px0, pz0)
    s.bodyPivot.rotation.z += (0 - s.bodyPivot.rotation.z) * Math.min(1, dt * 8)
    s.bodyPivot.scale.set(1, 1, 1)
    s.headPivot.rotation.x = -0.62 + Math.sin(t * 1.15 + s.phaseOffset) * 0.045
    return null
  }

  const prevX = px0
  const prevZ = pz0
  let nx = prevX + s.velocity.x * dt
  let nz = prevZ + (s.velocity.y + drift) * dt

  // Soft elastic rebound off the arena's snow-oak perimeter bumpers
  const arenaBounce = bounceInArena(nx, nz, s.velocity.x, s.velocity.y, BOUND, 0.68)
  nx = arenaBounce.x
  nz = arenaBounce.z
  s.velocity.set(arenaBounce.vx, arenaBounce.vz)

  if (hitsWater(level, nx, nz, 0.26)) {
    const dry = pushOutOfWater(level, nx, nz, 0.26)
    nx = clamp(dry.x, -BOUND, BOUND)
    nz = clamp(dry.z, -BOUND, BOUND)
  }

  const enteredEarly = penIndexAt(nx, nz, CAPTURE)
  if (enteredEarly >= 0) {
    return enterPen(s, nx, nz, enteredEarly, penSlotCounter)
  }

  let fence: SheepEvent | null = null
  if (hitsFence(nx, nz, 0.26)) {
    const goal = herdTarget(prevX, prevZ, s.velocity.x, s.velocity.y)
    const slideX = prevX + (goal.x - prevX) * 0.22
    const slideZ = prevZ + (goal.z - prevZ) * 0.22
    const slipped = penIndexAt(slideX, slideZ, CAPTURE + 0.35)
    if (slipped >= 0) return enterPen(s, slideX, slideZ, slipped, penSlotCounter)
    if (!hitsFence(slideX, slideZ, 0.22)) {
      nx = slideX
      nz = slideZ
    } else {
      const vx = s.velocity.x
      const vz = s.velocity.y
      s.velocity.multiplyScalar(-0.78)
      nx = prevX
      nz = prevZ
      fence = { kind: 'fence', x: prevX, z: prevZ, nx: -vx, nz: -vz, penIndex: -1, isGolden: s.isGolden }
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
  if (entered >= 0) return enterPen(s, nx, nz, entered, penSlotCounter)

  if (s.velocity.lengthSq() > 0.01) {
    const facing = Math.atan2(-s.velocity.y, s.velocity.x)
    s.group.rotation.y = dampAngle(s.group.rotation.y, facing, dt)
  }

  // Expressive Penguin-style belly-slide posture vs cute trotting bob!
  if (s.sliding) {
    const wobble = Math.sin(t * 16 + s.phaseOffset) * 0.1
    s.bodyPivot.rotation.z += (-0.34 - s.bodyPivot.rotation.z) * Math.min(1, dt * 14)
    s.bodyPivot.rotation.x += (wobble - s.bodyPivot.rotation.x) * Math.min(1, dt * 14)
    s.bodyPivot.position.y = -0.04
    s.bodyPivot.scale.set(1.16, 0.84, 1.08)
    s.group.position.y = groundHeight(level, nx, nz)
    s.headPivot.rotation.x = 0.22
  } else {
    s.bodyPivot.rotation.z += (0 - s.bodyPivot.rotation.z) * Math.min(1, dt * 10)
    s.bodyPivot.rotation.x += (0 - s.bodyPivot.rotation.x) * Math.min(1, dt * 10)
    s.bodyPivot.position.y = 0
    s.bodyPivot.scale.set(1, 1, 1)
    const bob = s.mode === 'graze' ? 0 : Math.abs(Math.sin(t * 8 + s.phaseOffset)) * 0.045
    s.group.position.y = groundHeight(level, nx, nz) + bob
    s.headPivot.rotation.x = s.mode === 'graze'
      ? -0.62 + Math.sin(t * 1.15 + s.phaseOffset) * 0.045
      : -0.08
  }

  return fence || slideEvent
}

function fleeVelocity(
  s: SheepState,
  awayX: number,
  awayZ: number,
  dist: number,
  flock: { x: number; z: number }[],
  afraid: boolean,
  isGolden: boolean,
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
    vx += (tx / td) * 0.3
    vz += (tz / td) * 0.3
  }
  const goal = herdTarget(sx, sz, vx, vz)
  const gx = goal.x - sx
  const gz = goal.z - sz
  const gd = Math.hypot(gx, gz) || 1
  vx = vx * (1 - goal.weight) + (gx / gd) * goal.weight
  vz = vz * (1 - goal.weight) + (gz / gd) * goal.weight
  const len = Math.hypot(vx, vz) || 1
  const closeness = afraid ? Math.max(0, 1 - dist / FEAR) : 0.45
  const goldMul = isGolden ? 1.2 : 1
  const speed = (afraid ? 1.95 + closeness * 1.15 : 1.7) * goldMul
  return new THREE.Vector2((vx / len) * speed, (vz / len) * speed)
}

function mouthPull(s: SheepState) {
  const sx = s.group.position.x
  const sz = s.group.position.z
  const goal = herdTarget(sx, sz, s.velocity.x, s.velocity.y)
  const gx = goal.x - sx
  const gz = goal.z - sz
  const gd = Math.hypot(gx, gz)
  if (gd > 3.2 || gd < 0.05) return null
  return new THREE.Vector2((gx / gd) * 1.35, (gz / gd) * 1.35)
}

function enterPen(
  s: SheepState,
  x: number,
  z: number,
  index: number,
  penSlotCounter?: (penIndex: number) => number,
): SheepEvent {
  s.mode = 'penned'
  s.penIndex = index
  s.sliding = false
  s.velocity.set(0, 0)
  s.penStartX = x
  s.penStartZ = z
  const slotIdx = penSlotCounter ? penSlotCounter(index) : 0
  const [tx, tz] = assignPenSpot(index, slotIdx)
  s.penTargetX = tx
  s.penTargetZ = tz
  s.penHopT = 0
  s.group.visible = true
  return {
    kind: 'penned',
    x,
    z,
    nx: -Math.sign(x),
    nz: -Math.sign(z),
    penIndex: index,
    isGolden: s.isGolden,
  }
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

function dampAngle(current: number, target: number, dt: number) {
  let d = target - current
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return current + d * Math.min(1, dt * 8)
}