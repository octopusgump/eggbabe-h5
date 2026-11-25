import * as THREE from 'three'
import { groundHeight, hitsWater, resolveCircleObstacles, type LevelId } from './levels'
import { clay, oakWood } from './materials'

export type BellPowerupRig = {
  group: THREE.Group
  bellMesh: THREE.Group
  halo: THREE.Mesh
  haloMat: THREE.MeshBasicMaterial
  active: boolean
  x: number
  z: number
  ttl: number
  maxTtl: number
  phase: number
}

const BELL_LIFETIME = 6.8
const BELL_PICKUP_DIST = 1.25

/**
 * Floating golden herder bell power-up:
 * - Spawns mid-round in open rink space with a warm pulsing halo
 * - Picking it up triggers 4.5s Golden Bell Fever (wider influence ring + halved dash cooldown)
 */
export function createBellPowerup(): BellPowerupRig {
  const group = new THREE.Group()
  group.name = 'golden_bell_powerup'
  group.visible = false

  const bellMesh = new THREE.Group()
  group.add(bellMesh)

  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xffd75e,
    emissive: 0xe6a11c,
    emissiveIntensity: 0.42,
    roughness: 0.28,
    metalness: 0.48,
  })
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xffe896,
    emissive: 0xf4b628,
    emissiveIntensity: 0.35,
    roughness: 0.25,
    metalness: 0.55,
  })

  // Sculpted bell dome + flared lip
  const dome = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.34, 0.44, 18), goldMat)
  dome.position.y = 0.26
  dome.castShadow = true
  bellMesh.add(dome)

  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 10), goldMat)
  cap.position.y = 0.47
  cap.castShadow = true
  bellMesh.add(cap)

  const flare = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.055, 10, 22), rimMat)
  flare.rotation.x = Math.PI / 2
  flare.position.y = 0.06
  bellMesh.add(flare)

  // Warm oak top handle & golden clapper bead underneath
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.2, 10), oakWood(0xb28252, 1))
  handle.position.y = 0.66
  handle.castShadow = true
  bellMesh.add(handle)

  const clapper = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), clay(0xfff5cc, 0.45))
  clapper.position.y = -0.02
  bellMesh.add(clapper)

  // Ground warm-gold pulsing ring halo so players spot the power-up immediately
  const haloMat = new THREE.MeshBasicMaterial({
    color: 0xf6c43c,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  const halo = new THREE.Mesh(new THREE.RingGeometry(0.54, 0.72, 32), haloMat)
  halo.rotation.x = -Math.PI / 2
  halo.position.y = 0.045
  group.add(halo)

  return {
    group,
    bellMesh,
    halo,
    haloMat,
    active: false,
    x: 0,
    z: 0,
    ttl: 0,
    maxTtl: BELL_LIFETIME,
    phase: 0,
  }
}

/** Picks a safe open spot on the rink (avoiding water, trees, bumpers, and too close to herder). */
export function spawnBell(
  rig: BellPowerupRig,
  level: LevelId,
  herderX: number,
  herderZ: number,
) {
  let sx = 0
  let sz = -1.2
  for (let tries = 0; tries < 18; tries++) {
    const cx = (Math.random() - 0.5) * 9.2
    const cz = -3.8 + Math.random() * 6.4
    if (Math.hypot(cx - herderX, cz - herderZ) < 2.6) continue
    if (hitsWater(level, cx, cz, 0.75)) continue
    const obs = resolveCircleObstacles(level, cx, cz, 0, 0, 0.85)
    if (obs.hitKind !== 'none') continue
    sx = cx
    sz = cz
    break
  }

  rig.x = sx
  rig.z = sz
  rig.ttl = BELL_LIFETIME
  rig.maxTtl = BELL_LIFETIME
  rig.phase = 0
  rig.active = true
  rig.group.position.set(sx, groundHeight(level, sx, sz), sz)
  rig.group.visible = true
}

export function hideBell(rig: BellPowerupRig) {
  rig.active = false
  rig.ttl = 0
  rig.group.visible = false
}

export function stepBell(rig: BellPowerupRig, dt: number): boolean {
  if (!rig.active) return false
  rig.ttl -= dt
  rig.phase += dt
  if (rig.ttl <= 0) {
    hideBell(rig)
    return false
  }

  const bob = Math.sin(rig.phase * 4.4) * 0.14
  rig.bellMesh.position.y = 0.42 + bob
  rig.bellMesh.rotation.y = rig.phase * 2.1
  rig.bellMesh.rotation.z = Math.sin(rig.phase * 6.8) * 0.18

  const pulse = 0.88 + Math.sin(rig.phase * 5.2) * 0.16
  rig.halo.scale.set(pulse, pulse, 1)
  // Blink gently in final 1.6s before despawning
  const warnBlink = rig.ttl < 1.6 ? (Math.sin(rig.phase * 18) > 0 ? 0.85 : 0.25) : 0.75
  rig.haloMat.opacity = warnBlink
  return true
}

export function checkBellPickup(rig: BellPowerupRig, herderX: number, herderZ: number): boolean {
  if (!rig.active) return false
  if (Math.hypot(herderX - rig.x, herderZ - rig.z) <= BELL_PICKUP_DIST) {
    hideBell(rig)
    return true
  }
  return false
}
