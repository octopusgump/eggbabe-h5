/**
 * Pure 2D ice-rink physics inspired by Super Mario Party — Penguin Pushers.
 * Kept Three.js-free so Node unit tests can directly verify inertia,
 * high-friction Mario skidding, dash boosts, elastic bumps, and soft wall bounces.
 */

export type Vec2 = { x: number; z: number }

export type SkaterState = {
  vx: number
  vz: number
  skidIntensity: number
  skidding: boolean
  dashTimer: number
  dashCooldown: number
  pivotBoost: number
}

export type SkaterParams = {
  accel: number
  maxSpeed: number
  glideDrag: number
  turnAssist: number
  skidBrake: number
  skidMinSpeed: number
  dashSpeed: number
  dashDuration: number
  dashCooldown: number
}

export const DEFAULT_SKATER_PARAMS: SkaterParams = {
  accel: 12.2,
  maxSpeed: 5.8,
  glideDrag: 1.48,
  turnAssist: 6.2,
  skidBrake: 22.5,
  skidMinSpeed: 1.75,
  dashSpeed: 8.8,
  dashDuration: 0.3,
  dashCooldown: 1.35,
}

export function createSkaterState(): SkaterState {
  return {
    vx: 0,
    vz: 0,
    skidIntensity: 0,
    skidding: false,
    dashTimer: 0,
    dashCooldown: 0,
    pivotBoost: 0,
  }
}

export function triggerSkaterDash(
  state: SkaterState,
  dirX: number,
  dirZ: number,
  params: SkaterParams = DEFAULT_SKATER_PARAMS,
): boolean {
  if (state.dashCooldown > 0) return false
  let dx = dirX
  let dz = dirZ
  let len = Math.hypot(dx, dz)
  if (len < 0.05) {
    dx = state.vx
    dz = state.vz
    len = Math.hypot(dx, dz)
  }
  if (len < 0.05) {
    dx = 0
    dz = 1
    len = 1
  }
  dx /= len
  dz /= len
  state.vx = dx * params.dashSpeed
  state.vz = dz * params.dashSpeed
  state.dashTimer = params.dashDuration
  state.dashCooldown = params.dashCooldown
  state.skidding = false
  state.skidIntensity = 0
  return true
}

export type SkaterStepResult = {
  speed: number
  skidding: boolean
  skidIntensity: number
  skidDirX: number
  skidDirZ: number
  dashing: boolean
  justPivoted: boolean
}

/**
 * Integrates Mario-style ice inertia & high-friction reverse skidding.
 * - Releasing input glides smoothly on low-drag ice instead of hard-stopping.
 * - Pushing input sharply opposite to current velocity triggers intense
 *   high-friction skidding (skidBrake >> glideDrag) + pivot boost once braked.
 */
export function stepSkaterVelocity(
  state: SkaterState,
  inputWorldX: number,
  inputWorldZ: number,
  dt: number,
  params: SkaterParams = DEFAULT_SKATER_PARAMS,
): SkaterStepResult {
  state.dashTimer = Math.max(0, state.dashTimer - dt)
  state.dashCooldown = Math.max(0, state.dashCooldown - dt)
  state.pivotBoost = Math.max(0, state.pivotBoost - dt)

  const inputMag = Math.min(1, Math.hypot(inputWorldX, inputWorldZ))
  const speed0 = Math.hypot(state.vx, state.vz)
  const wasSkidding = state.skidding
  let skidding = false
  let skidIntensity = 0
  let skidDirX = speed0 > 1e-4 ? state.vx / speed0 : 0
  let skidDirZ = speed0 > 1e-4 ? state.vz / speed0 : 0
  let justPivoted = false

  if (state.dashTimer > 0) {
    // During dash, maintain high forward momentum with subtle steering
    const drag = Math.exp(-params.glideDrag * 0.72 * dt)
    state.vx *= drag
    state.vz *= drag
    if (inputMag > 0.15) {
      const ix = inputWorldX / inputMag
      const iz = inputWorldZ / inputMag
      state.vx += ix * params.turnAssist * 0.6 * dt
      state.vz += iz * params.turnAssist * 0.6 * dt
    }
  } else if (inputMag > 0.12) {
    const ix = inputWorldX / inputMag
    const iz = inputWorldZ / inputMag
    const dot = speed0 > 0.05 ? (state.vx * ix + state.vz * iz) / speed0 : 1

    if (speed0 >= params.skidMinSpeed && dot < -0.22) {
      // High-friction Mario ice brake! Digging heels against momentum
      skidding = true
      const opp = Math.min(1, (-dot - 0.22) / 0.78)
      const spdFactor = Math.min(1, (speed0 - params.skidMinSpeed * 0.5) / params.maxSpeed)
      skidIntensity = Math.min(1, 0.35 + opp * 0.45 + spdFactor * 0.35)

      const brake = params.skidBrake * (0.72 + opp * 0.45) * inputMag
      state.vx += ix * brake * dt
      state.vz += iz * brake * dt
      // Extra parallel friction opposing current slide vector
      const damp = Math.max(0, 1 - (params.glideDrag * 2.9 * dt))
      state.vx *= damp
      state.vz *= damp
    } else {
      if (wasSkidding && dot > 0.25) {
        state.pivotBoost = 0.24
        justPivoted = true
      }
      const boostMul = state.pivotBoost > 0 ? 1.24 : 1
      const ax = ix * params.accel * inputMag * boostMul
      const az = iz * params.accel * inputMag * boostMul
      state.vx += ax * dt
      state.vz += az * dt

      // Subtle ice carve steering so wide arcs still feel responsive
      if (speed0 > 0.4 && dot < 0.85) {
        const proj = state.vx * ix + state.vz * iz
        const latX = state.vx - ix * proj
        const latZ = state.vz - iz * proj
        const carve = Math.min(1, params.turnAssist * dt * 0.48)
        state.vx -= latX * carve
        state.vz -= latZ * carve
      }

      // Mild ice drag & max speed cap
      const drag = Math.exp(-params.glideDrag * 0.38 * dt)
      state.vx *= drag
      state.vz *= drag
      const curSpd = Math.hypot(state.vx, state.vz)
      const cap = params.maxSpeed * (state.pivotBoost > 0 ? 1.12 : 1)
      if (curSpd > cap) {
        const k = cap / curSpd
        state.vx *= k
        state.vz *= k
      }
    }
  } else {
    // Low-friction ice glide when input is released
    const glide = Math.exp(-params.glideDrag * dt)
    state.vx *= glide
    state.vz *= glide
    if (Math.hypot(state.vx, state.vz) < 0.06) {
      state.vx = 0
      state.vz = 0
    }
  }

  state.skidding = skidding
  state.skidIntensity = skidding
    ? skidIntensity
    : Math.max(0, state.skidIntensity - dt * 5.5)

  const speed = Math.hypot(state.vx, state.vz)
  return {
    speed,
    skidding,
    skidIntensity: state.skidIntensity,
    skidDirX,
    skidDirZ,
    dashing: state.dashTimer > 0,
    justPivoted,
  }
}

export type BumpResult = {
  collided: boolean
  nx: number
  nz: number
  impactSpeed: number
  aPos: Vec2
  bPos: Vec2
  aVel: Vec2
  bVel: Vec2
}

/**
 * Elastic impulse collision between two circles on the ice rink.
 * Used for both Herder->Sheep shoves and Sheep<->Sheep chain bowling!
 */
export function resolveElasticBump(
  ax: number,
  az: number,
  avx: number,
  avz: number,
  bx: number,
  bz: number,
  bvx: number,
  bvz: number,
  minDist: number,
  massA: number,
  massB: number,
  restitution = 0.85,
  extraPush = 0,
): BumpResult {
  const dx = bx - ax
  const dz = bz - az
  const dist = Math.hypot(dx, dz)
  if (dist >= minDist || dist < 1e-5) {
    return {
      collided: false,
      nx: 0,
      nz: 0,
      impactSpeed: 0,
      aPos: { x: ax, z: az },
      bPos: { x: bx, z: bz },
      aVel: { x: avx, z: avz },
      bVel: { x: bvx, z: bvz },
    }
  }

  const nx = dx / dist
  const nz = dz / dist
  const overlap = minDist - dist + 0.02
  const invA = massA <= 0 ? 0 : 1 / massA
  const invB = massB <= 0 ? 0 : 1 / massB
  const invSum = invA + invB || 1

  const aPos = { x: ax - nx * overlap * (invA / invSum), z: az - nz * overlap * (invA / invSum) }
  const bPos = { x: bx + nx * overlap * (invB / invSum), z: bz + nz * overlap * (invB / invSum) }

  const rvx = bvx - avx
  const rvz = bvz - avz
  const velAlongNormal = rvx * nx + rvz * nz
  const aVel = { x: avx, z: avz }
  const bVel = { x: bvx, z: bvz }
  let impactSpeed = Math.max(0, -velAlongNormal)

  if (velAlongNormal < 0) {
    const j = (-(1 + restitution) * velAlongNormal) / invSum
    aVel.x -= j * invA * nx
    aVel.z -= j * invA * nz
    bVel.x += j * invB * nx
    bVel.z += j * invB * nz
  }

  if (extraPush > 0) {
    bVel.x += nx * extraPush
    bVel.z += nz * extraPush
    impactSpeed = Math.max(impactSpeed, extraPush)
  }

  return {
    collided: true,
    nx,
    nz,
    impactSpeed,
    aPos,
    bPos,
    aVel,
    bVel,
  }
}

/** Soft bouncy snow-oak perimeter wall containment (replaces instant cliff death) */
export function bounceInArena(
  x: number,
  z: number,
  vx: number,
  vz: number,
  limit: number,
  restitution = 0.52,
): { x: number; z: number; vx: number; vz: number; bounced: boolean; nx: number; nz: number } {
  let px = x
  let pz = z
  let nvx = vx
  let nvz = vz
  let bounced = false
  let nx = 0
  let nz = 0

  if (px > limit) {
    px = limit
    if (nvx > 0) nvx = -nvx * restitution
    bounced = true
    nx = -1
  } else if (px < -limit) {
    px = -limit
    if (nvx < 0) nvx = -nvx * restitution
    bounced = true
    nx = 1
  }

  if (pz > limit) {
    pz = limit
    if (nvz > 0) nvz = -nvz * restitution
    bounced = true
    nz = -1
  } else if (pz < -limit) {
    pz = -limit
    if (nvz < 0) nvz = -nvz * restitution
    bounced = true
    nz = 1
  }

  return { x: px, z: pz, vx: nvx, vz: nvz, bounced, nx, nz }
}
