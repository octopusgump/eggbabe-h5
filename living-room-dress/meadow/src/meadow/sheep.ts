import * as THREE from 'three'
import {
  groundHeight,
  hitsWater,
  penLift,
  pushOutOfWater,
  resolveCircleObstacles,
  sampleBoostPad,
  slopeDrift,
  type LevelId,
} from './levels'
import { blobShadow, clay, felt } from './materials'
import { assignSinglePenSpot, herdTarget, hitsFence, penIndexAt } from './pen'
import { bounceInArena } from './physics'

export type SheepMode = 'waddle' | 'slide' | 'penned'

export type SheepState = {
  group: THREE.Group
  bodyPivot: THREE.Group
  headPivot: THREE.Group
  legsPivot: THREE.Group
  mode: SheepMode
  velocity: THREE.Vector2
  timer: number
  phaseOffset: number
  penIndex: number
  homeX: number
  homeZ: number
  bumpCooldown: number
  slideCarry: number
  sliding: boolean
  isGolden: boolean
  penHopT: number
  penStartX: number
  penStartZ: number
  penTargetX: number
  penTargetZ: number
  bounceSquash: number
}

export type SheepEvent = {
  kind: 'fence' | 'penned' | 'slideStart' | 'bumper' | 'wallBounce'
  x: number
  z: number
  nx: number
  nz: number
  penIndex: number
  bumperIndex: number
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

  if (isGolden) {
    const crownMat = new THREE.MeshStandardMaterial({
      color: 0xffd75e,
      roughness: 0.3,
      metalness: 0.24,
      emissive: 0xebb020,
      emissiveIntensity: 0.18,
    })
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.074, 0.064, 0.062, 10), crownMat)
    band.position.set(0.075, 0.155, 0)
    headPivot.add(band)
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.026, 0.068, 6), crownMat)
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

  // Dedicated legs pivot so legs visibly kick backwards during Penguin belly-slides!
  const legsPivot = new THREE.Group()
  legsPivot.position.set(0, 0.18, 0)
  bodyPivot.add(legsPivot)

  const legMat = clay(COCOA_FACE, 0.88)
  for (const [x, z] of [
    [-0.1, -0.09],
    [0.1, -0.09],
    [-0.08, 0.09],
    [0.08, 0.09],
  ] as const) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.036, 0.12, 4, 8), legMat)
    leg.position.set(x, -0.08, z)
    leg.castShadow = true
    legsPivot.add(leg)
  }

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

  return {
    group,
    bodyPivot,
    headPivot,
    legsPivot,
    mode: 'waddle',
    velocity: new THREE.Vector2(),
    timer: 0.2 + Math.random() * 0.6,
    phaseOffset: Math.random() * Math.PI * 2,
    penIndex: -1,
    homeX: 0,
    homeZ: 0,
    bumpCooldown: 0,
    slideCarry: 0,
    sliding: false,
    isGolden,
    penHopT: 1,
    penStartX: 0,
    penStartZ: 0,
    penTargetX: 0,
    penTargetZ: 0,
    bounceSquash: 0,
  }
}

/** Pick an energetic direction aiming toward open perimeter walls (playfully avoiding walking straight into the South gate). */
function pickAutonomousSlideDirection(x: number, z: number): [number, number] {
  // Aim toward one of the 4 edges (biased away from the South-Center gate mouth)
  for (let tries = 0; tries < 5; tries++) {
    const angle = Math.random() * Math.PI * 2
    const dx = Math.cos(angle)
    const dz = Math.sin(angle)
    // Avoid self-scoring straight down the center into the gate
    if (dz > 0.55 && Math.abs(x + dx * 2.5) < 2.6) continue
    // If already hugging a wall, steer somewhat inward/sideways rather than dead into it
    if (x > 5.4 && dx > 0.35) continue
    if (x < -5.4 && dx < -0.35) continue
    if (z < -5.4 && dz < -0.35) continue
    if (z > 4.2 && dz > 0.35) continue
    return [dx, dz]
  }
  const fallback = Math.atan2(-z + (Math.random() - 0.5) * 4, -x + (Math.random() - 0.5) * 4)
  return [Math.cos(fallback), Math.sin(fallback)]
}

export function launchAutonomousSlide(s: SheepState, boostMul = 1) {
  const [dx, dz] = pickAutonomousSlideDirection(s.group.position.x, s.group.position.z)
  const baseSpd = s.isGolden ? 5.3 + Math.random() * 1.15 : 4.2 + Math.random() * 1.05
  const speed = baseSpd * boostMul
  s.velocity.set(dx * speed, dz * speed)
  s.mode = 'slide'
  s.sliding = true
  s.slideCarry = 1.05 + Math.random() * 0.55
  s.timer = 1.35 + Math.random() * 0.75
}

export function resetSheep(s: SheepState, level: LevelId = 1) {
  s.penIndex = -1
  s.bumpCooldown = 0
  s.bounceSquash = 0
  s.penHopT = 1
  s.bodyPivot.rotation.set(0, 0, 0)
  s.bodyPivot.position.set(0, 0, 0)
  s.bodyPivot.scale.set(1, 1, 1)
  s.legsPivot.rotation.set(0, 0, 0)
  s.group.visible = true
  s.group.position.set(s.homeX, groundHeight(level, s.homeX, s.homeZ), s.homeZ)

  // Half the flock immediately kicks off sliding outward across the ice, half waddles briefly then slides!
  if (Math.random() > 0.4) {
    launchAutonomousSlide(s, 0.92)
    s.group.rotation.y = Math.atan2(-s.velocity.y, s.velocity.x)
  } else {
    s.mode = 'waddle'
    s.sliding = false
    s.slideCarry = 0
    const [dx, dz] = pickAutonomousSlideDirection(s.homeX, s.homeZ)
    s.velocity.set(dx * 1.1, dz * 1.1)
    s.group.rotation.y = Math.atan2(-dz, dx)
    s.timer = 0.25 + Math.random() * 0.55
  }
  s.headPivot.rotation.x = -0.06
}

const BOUND = 7.02
export const SHEEP_FEAR = 4.2
const FEAR = SHEEP_FEAR
const CAPTURE = 1.1
const ICE_SLIDE_DRAG = 0.68
const WADDLE_DRAG = 1.8

/**
 * Authentic Penguin-Pushers autonomous 4-way belly-sliding sheep physics:
 * - Zero passive grazing: alternates between quick waddle wind-ups and long low-friction
 *   belly slides gliding across half the rink & bouncing off perimeter snow-oak walls!
 * - Reacts strongly to herder proximity, shoves, snow bumpers, pine trees, and boost pads.
 */
export function stepSheep(
  s: SheepState,
  dt: number,
  t: number,
  herderX: number,
  herderZ: number,
  level: LevelId = 1,
  penSlotCounter?: (penIndex: number) => number,
): SheepEvent | null {
  s.bumpCooldown = Math.max(0, s.bumpCooldown - dt)
  s.slideCarry = Math.max(0, s.slideCarry - dt)
  s.bounceSquash = Math.max(0, s.bounceSquash - dt * 4.5)

  // Penned sheep stay visible & cheerfully hop into their cozy straw spot!
  if (s.mode === 'penned' && s.penIndex >= 0) {
    s.group.visible = true
    s.sliding = false
    const baseY = penLift(level, s.penIndex) + 0.04
    if (s.penHopT < 1) {
      s.penHopT = Math.min(1, s.penHopT + dt / 0.36)
      const u = s.penHopT
      const ease = 1 - (1 - u) * (1 - u)
      s.group.position.x = s.penStartX + (s.penTargetX - s.penStartX) * ease
      s.group.position.z = s.penStartZ + (s.penTargetZ - s.penStartZ) * ease
      const arc = Math.sin(u * Math.PI) * 0.96
      s.group.position.y = baseY + arc
      s.bodyPivot.rotation.set(0, 0, Math.sin(u * Math.PI) * 0.25)
      s.bodyPivot.position.y = 0
      s.bodyPivot.scale.set(1.06, 0.94, 1.06)
      s.legsPivot.rotation.z = 0
    } else {
      const happyBob = Math.abs(Math.sin(t * 4.0 + s.phaseOffset)) * 0.055
      s.group.position.set(s.penTargetX, baseY + happyBob, s.penTargetZ)
      s.bodyPivot.rotation.set(0, 0, 0)
      s.bodyPivot.position.y = 0
      s.bodyPivot.scale.set(1, 1, 1)
      s.legsPivot.rotation.z = 0
      s.headPivot.rotation.x = -0.16 + Math.sin(t * 2.5 + s.phaseOffset) * 0.14
    }
    return null
  }

  const px0 = s.group.position.x
  const pz0 = s.group.position.z
  const dx = px0 - herderX
  const dz = pz0 - herderZ
  const dist = Math.hypot(dx, dz)
  const afraid = dist < FEAR && dist > 0.001
  const wasSliding = s.sliding
  let emittedEvent: SheepEvent | null = null

  if (afraid) {
    // Panic push away from herder, steering smoothly toward the South gate when pushed from behind
    const awayX = dx / dist
    const awayZ = dz / dist
    const goal = herdTarget(px0, pz0, awayX, awayZ)
    const gx = goal.x - px0
    const gz = goal.z - pz0
    const gd = Math.hypot(gx, gz) || 1
    let tx = awayX * (1 - goal.weight * 0.65) + (gx / gd) * (goal.weight * 0.65)
    let tz = awayZ * (1 - goal.weight * 0.65) + (gz / gd) * (goal.weight * 0.65)
    const tlen = Math.hypot(tx, tz) || 1
    tx /= tlen
    tz /= tlen

    const closeness = Math.max(0, 1 - dist / FEAR)
    const targetSpd = (s.isGolden ? 4.4 : 3.45) + closeness * 2.1
    // Blend gently so high-speed bump trajectories stay faithful to physics!
    const steer = Math.min(1, dt * 3.8)
    s.velocity.x += (tx * targetSpd - s.velocity.x) * steer
    s.velocity.y += (tz * targetSpd - s.velocity.y) * steer
    s.mode = 'slide'
    s.slideCarry = Math.max(s.slideCarry, 0.75)
  } else if (s.mode === 'slide') {
    // Ultra-slick Penguin belly-slide glide across the ice!
    const drag = Math.exp(-ICE_SLIDE_DRAG * dt)
    s.velocity.multiplyScalar(drag)
    s.timer -= dt
    const spd = s.velocity.length()
    if (spd < 1.15 && s.slideCarry <= 0 && s.timer <= 0) {
      s.mode = 'waddle'
      s.timer = 0.36 + Math.random() * 0.55
      const [wx, wz] = pickAutonomousSlideDirection(px0, pz0)
      s.velocity.set(wx * 1.15, wz * 1.15)
    }
  } else {
    // Brief cute waddle wind-up -> kick off into a brand-new long belly slide toward the 4 sides!
    const drag = Math.exp(-WADDLE_DRAG * dt)
    s.velocity.multiplyScalar(drag)
    s.timer -= dt
    if (s.timer <= 0) {
      launchAutonomousSlide(s)
      emittedEvent = {
        kind: 'slideStart',
        x: px0,
        z: pz0,
        nx: 0,
        nz: 0,
        penIndex: -1,
        bumperIndex: -1,
        isGolden: s.isGolden,
      }
    }
  }

  // Apply Level 5/6 warm-gold starlight boost pads!
  const boost = sampleBoostPad(level, px0, pz0)
  if (boost.active) {
    s.velocity.x += boost.fx * dt
    s.velocity.y += boost.fz * dt
    s.mode = 'slide'
    s.slideCarry = Math.max(s.slideCarry, 0.85)
  }

  // Apply Level 4 north ice slope gravity acceleration
  let drift = slopeDrift(level, px0, pz0) * 1.9
  if (drift > 0 && hitsWater(level, px0, pz0 + 0.08, 0.26)) drift = 0
  s.velocity.y += drift * dt * 2.2

  // Cap max runaway speed
  const curSpd = s.velocity.length()
  const maxSpd = s.isGolden ? 9.8 : 8.6
  if (curSpd > maxSpd) {
    s.velocity.multiplyScalar(maxSpd / curSpd)
  }

  s.sliding = s.mode === 'slide' && (curSpd > 1.75 || s.slideCarry > 0.08)
  if (!wasSliding && s.sliding && curSpd > 2.4 && !emittedEvent) {
    emittedEvent = {
      kind: 'slideStart',
      x: px0,
      z: pz0,
      nx: 0,
      nz: 0,
      penIndex: -1,
      bumperIndex: -1,
      isGolden: s.isGolden,
    }
  }

  const prevX = px0
  const prevZ = pz0
  let nx = prevX + s.velocity.x * dt
  let nz = prevZ + s.velocity.y * dt

  // High-elastic bouncy snow-oak perimeter wall rebound!
  const arenaBounce = bounceInArena(nx, nz, s.velocity.x, s.velocity.y, BOUND, 0.85)
  nx = arenaBounce.x
  nz = arenaBounce.z
  s.velocity.set(arenaBounce.vx, arenaBounce.vz)
  if (arenaBounce.bounced && curSpd > 1.8) {
    s.bounceSquash = 1
    if (!emittedEvent) {
      emittedEvent = {
        kind: 'wallBounce',
        x: nx,
        z: nz,
        nx: arenaBounce.nx,
        nz: arenaBounce.nz,
        penIndex: -1,
        bumperIndex: -1,
        isGolden: s.isGolden,
      }
    }
  }

  // Solid collision against Level 2/6 snow bumpers & Level 3 pine trees
  const obs = resolveCircleObstacles(level, nx, nz, s.velocity.x, s.velocity.y, 0.34)
  nx = obs.x
  nz = obs.z
  s.velocity.set(obs.vx, obs.vz)
  if (obs.hitKind === 'bumper') {
    s.mode = 'slide'
    s.slideCarry = Math.max(s.slideCarry, 0.9)
    s.bounceSquash = 1
    emittedEvent = {
      kind: 'bumper',
      x: nx,
      z: nz,
      nx: obs.nx,
      nz: obs.nz,
      penIndex: -1,
      bumperIndex: obs.bumperIndex,
      isGolden: s.isGolden,
    }
  }

  if (hitsWater(level, nx, nz, 0.26)) {
    const dry = pushOutOfWater(level, nx, nz, 0.26)
    nx = clamp(dry.x, -BOUND, BOUND)
    nz = clamp(dry.z, -BOUND, BOUND)
  }

  // Check single South-Center gate capture!
  const enteredEarly = penIndexAt(nx, nz, CAPTURE)
  if (enteredEarly >= 0) {
    return enterPen(s, nx, nz, enteredEarly, penSlotCounter)
  }

  if (hitsFence(nx, nz, 0.28)) {
    const goal = herdTarget(prevX, prevZ, s.velocity.x, s.velocity.y)
    const slideX = prevX + (goal.x - prevX) * 0.24
    const slideZ = prevZ + (goal.z - prevZ) * 0.24
    const slipped = penIndexAt(slideX, slideZ, CAPTURE + 0.3)
    if (slipped >= 0) return enterPen(s, slideX, slideZ, slipped, penSlotCounter)
    if (!hitsFence(slideX, slideZ, 0.22)) {
      nx = slideX
      nz = slideZ
    } else {
      const vx = s.velocity.x
      const vz = s.velocity.y
      s.velocity.multiplyScalar(-0.8)
      nx = prevX
      nz = prevZ
      s.bounceSquash = 0.85
      emittedEvent = {
        kind: 'fence',
        x: prevX,
        z: prevZ,
        nx: -vx,
        nz: -vz,
        penIndex: -1,
        bumperIndex: -1,
        isGolden: s.isGolden,
      }
    }
  }

  s.group.position.x = nx
  s.group.position.z = nz

  const entered = penIndexAt(nx, nz, CAPTURE)
  if (entered >= 0) return enterPen(s, nx, nz, entered, penSlotCounter)

  if (s.velocity.lengthSq() > 0.02) {
    const facing = Math.atan2(-s.velocity.y, s.velocity.x)
    s.group.rotation.y = dampAngle(s.group.rotation.y, facing, dt)
  }

  // Unmistakable Penguin belly-slide pose vs cute bouncy waddle!
  const squashBump = Math.sin(s.bounceSquash * Math.PI) * 0.16
  if (s.sliding) {
    const wobble = Math.sin(t * 17 + s.phaseOffset) * 0.11
    s.bodyPivot.rotation.z += (-0.28 - s.bodyPivot.rotation.z) * Math.min(1, dt * 15)
    s.bodyPivot.rotation.x += (wobble - s.bodyPivot.rotation.x) * Math.min(1, dt * 15)
    s.bodyPivot.position.y += (-0.11 - s.bodyPivot.position.y) * Math.min(1, dt * 15)
    s.bodyPivot.scale.set(1.26 - squashBump, 0.74 + squashBump, 1.06 + squashBump * 0.5)
    // Stubby little legs kick backwards playfully while gliding on belly!
    s.legsPivot.rotation.z = -1.05 + Math.sin(t * 26 + s.phaseOffset) * 0.24
    s.group.position.y = groundHeight(level, nx, nz)
    s.headPivot.rotation.x = 0.26
  } else {
    s.bodyPivot.rotation.z += (0 - s.bodyPivot.rotation.z) * Math.min(1, dt * 12)
    s.bodyPivot.rotation.x += (Math.sin(t * 14 + s.phaseOffset) * 0.12 - s.bodyPivot.rotation.x) * Math.min(1, dt * 12)
    s.bodyPivot.position.y += (0 - s.bodyPivot.position.y) * Math.min(1, dt * 12)
    s.bodyPivot.scale.set(1 - squashBump, 1 + squashBump, 1)
    s.legsPivot.rotation.z += (Math.sin(t * 16 + s.phaseOffset) * 0.25 - s.legsPivot.rotation.z) * Math.min(1, dt * 12)
    const bob = Math.abs(Math.sin(t * 10 + s.phaseOffset)) * 0.055
    s.group.position.y = groundHeight(level, nx, nz) + bob
    s.headPivot.rotation.x = -0.06
  }

  return emittedEvent
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
  const [tx, tz] = assignSinglePenSpot(slotIdx)
  s.penTargetX = tx
  s.penTargetZ = tz
  s.penHopT = 0
  s.group.visible = true
  return {
    kind: 'penned',
    x,
    z,
    nx: 0,
    nz: -1,
    penIndex: index,
    bumperIndex: -1,
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
  return current + d * Math.min(1, dt * 9)
}