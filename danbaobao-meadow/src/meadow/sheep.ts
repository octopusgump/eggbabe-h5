import * as THREE from 'three'
import { blobShadow, clay } from './materials'
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
    penIndex: -1,
    homeX: 0,
    homeZ: 0,
    bumpCooldown: 0,
    fleeCarry: 0,
  }
}

export function resetSheep(s: SheepState) {
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
  s.group.position.set(s.homeX, 0, s.homeZ)
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

  if (s.mode === 'graze' && s.velocity.lengthSq() < 0.0001) {
    s.group.position.y = 0
    s.headPivot.rotation.x = -0.62 + Math.sin(t * 1.15 + s.phaseOffset) * 0.045
    return null
  }

  const prevX = s.group.position.x
  const prevZ = s.group.position.z
  let nx = clamp(prevX + s.velocity.x * dt, -BOUND, BOUND)
  let nz = clamp(prevZ + s.velocity.y * dt, -BOUND, BOUND)
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
  s.group.position.x = nx
  s.group.position.z = nz

  const entered = penIndexAt(nx, nz, CAPTURE)
  if (entered >= 0) return penned(s, nx, nz, entered)

  if (s.velocity.lengthSq() > 0.0001) {
    const facing = Math.atan2(-s.velocity.y, s.velocity.x)
    s.group.rotation.y = dampAngle(s.group.rotation.y, facing, dt)
  }
  s.group.position.y = Math.abs(Math.sin(t * 7 + s.phaseOffset)) * 0.035
  s.headPivot.rotation.x = -0.08
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