import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { GATE_HALF_W, GATE_MOUTH_Z } from './bounds'
import { ISLAND_HALF } from './constants'
import {
  bankHeight,
  FORDS,
  groundHeight,
  hasRiver,
  hasTerrainRelief,
  inFord,
  levelConfig,
  RIVER,
  riverClosest,
  type LevelId,
} from './levels'
import { clay, felt, iceRink, oakWood, snowTrim } from './materials'
import { ribbonMesh } from './ribbon'

const ICE_BASE = 0xc3e4ec
const ICE_TINT = 0xa6d2df
const SOIL_WARM = 0xb18355
const OAK_TRIM = 0xc39666

export type IslandRig = {
  root: THREE.Group
  bumpers: THREE.Group[]
  bumperSquash: number[]
  boostChevrons: { mesh: THREE.Mesh; baseOffset: number; dirX: number; dirZ: number }[]
}

/** Full enclosed snow-oak perimeter bumper walls (North, West, East, and South flanks around the single South-Center gate) */
function addPerimeterBumpers(island: THREE.Group, level: LevelId) {
  const half = ISLAND_HALF
  const snowMat = snowTrim(0xfbf9f3, 0xe9f0f2, 2)
  const woodCapMat = oakWood(0xc89e6f, 2)
  const fullSpan = half * 2 - 0.5
  const southFlankLen = half - GATE_HALF_W - 0.25
  const southFlankCenter = GATE_HALF_W + southFlankLen / 2 + 0.08
  const rimY = 0.24
  const river = hasRiver(level)

  const addSeg = (x: number, z: number, sx: number, sz: number) => {
    const y = hasTerrainRelief(level) ? groundHeight(level, x, z) : 0
    const bank = new THREE.Mesh(
      new RoundedBoxGeometry(sx, 0.46, sz, 5, 0.2),
      snowMat,
    )
    bank.position.set(x, y + rimY, z)
    bank.castShadow = true
    bank.receiveShadow = true
    island.add(bank)

    const rail = new THREE.Mesh(
      new RoundedBoxGeometry(
        sx > sz ? Math.max(0.3, sx - 0.36) : 0.24,
        0.11,
        sz > sx ? Math.max(0.3, sz - 0.36) : 0.24,
        4,
        0.05,
      ),
      woodCapMat,
    )
    rail.position.set(x, y + rimY + 0.23, z)
    rail.castShadow = true
    island.add(rail)
  }

  addSeg(0, -half + 0.22, fullSpan, 0.58)
  addSeg(-southFlankCenter, half - 0.22, southFlankLen, 0.58)
  addSeg(southFlankCenter, half - 0.22, southFlankLen, 0.58)

  for (const sideX of [-half + 0.22, half - 0.22]) {
    if (river) {
      for (const [zMid, zLen] of [[-4.1, 6.2], [4.5, 5.4]] as const) {
        addSeg(sideX, zMid, 0.58, zLen)
      }
    } else {
      addSeg(sideX, 0, 0.58, fullSpan)
    }
  }

  addSnowman(island, half - 0.26, 2.2, level)
}

function addSnowman(island: THREE.Group, x: number, z: number, level: LevelId) {
  const g = new THREE.Group()
  const snow = snowTrim(0xfffdf8, 0xeef3f5, 1)
  const base = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 12), snow)
  base.position.y = 0.26
  base.castShadow = true
  g.add(base)

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 12), snow)
  head.position.y = 0.66
  head.castShadow = true
  g.add(head)

  const scarf = new THREE.Mesh(
    new THREE.TorusGeometry(0.18, 0.052, 8, 16),
    felt(0x9db65b, 0x86a149, 1, 0.02),
  )
  scarf.rotation.x = Math.PI / 2
  scarf.position.y = 0.49
  g.add(scarf)

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.038, 0.14, 8), clay(0xe38b52, 0.8))
  nose.rotation.z = Math.PI / 2
  nose.position.set(-0.24, 0.66, 0)
  g.add(nose)

  const eyeMat = clay(0x3a2a20, 0.35)
  for (const ez of [-0.065, 0.065]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 6), eyeMat)
    eye.position.set(-0.2, 0.72, ez)
    g.add(eye)
  }

  const y = hasTerrainRelief(level) ? groundHeight(level, x, z) : 0
  g.position.set(x, y + 0.38, z)
  island.add(g)
}

/** Pinball-like plump snow-oak bumper posts for Levels 2 & 6 */
function addSnowBumpers(island: THREE.Group, level: LevelId): THREE.Group[] {
  const cfg = levelConfig(level)
  const groups: THREE.Group[] = []
  const snowMat = snowTrim(0xfffdf8, 0xe8f2f5, 1)
  const bandMat = new THREE.MeshStandardMaterial({
    color: 0xf6cf5c,
    emissive: 0xeab738,
    emissiveIntensity: 0.22,
    roughness: 0.4,
    metalness: 0.08,
  })
  const capMat = oakWood(0xc69868, 1)

  for (const b of cfg.bumpers) {
    const g = new THREE.Group()
    const r = b.radius
    const base = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.92, r * 1.02, 0.56, 18), snowMat)
    base.position.y = 0.28
    base.castShadow = true
    base.receiveShadow = true
    g.add(base)

    const band = new THREE.Mesh(new THREE.TorusGeometry(r * 0.94, 0.11, 10, 22), bandMat)
    band.rotation.x = Math.PI / 2
    band.position.y = 0.32
    band.castShadow = true
    g.add(band)

    const cap = new THREE.Mesh(new THREE.SphereGeometry(r * 0.72, 16, 12), capMat)
    cap.scale.set(1, 0.5, 1)
    cap.position.y = 0.6
    cap.castShadow = true
    g.add(cap)

    const y = groundHeight(level, b.x, b.z)
    g.position.set(b.x, y, b.z)
    island.add(g)
    groups.push(g)
  }
  return groups
}

/** Glowing warm-gold starlight boost strips for Levels 5 & 6 */
function addBoostPads(
  island: THREE.Group,
  level: LevelId,
): { mesh: THREE.Mesh; baseOffset: number; dirX: number; dirZ: number }[] {
  const cfg = levelConfig(level)
  const animated: { mesh: THREE.Mesh; baseOffset: number; dirX: number; dirZ: number }[] = []

  const stripMat = new THREE.MeshBasicMaterial({
    color: 0xf7cf5c,
    transparent: true,
    opacity: 0.52,
    depthWrite: false,
  })
  const railMat = new THREE.MeshBasicMaterial({
    color: 0xdca024,
    transparent: true,
    opacity: 0.78,
    depthWrite: false,
  })
  const arrowMat = new THREE.MeshBasicMaterial({
    color: 0xe39414,
    transparent: true,
    opacity: 0.94,
    depthWrite: false,
  })

  for (const pad of cfg.boostPads) {
    const padGroup = new THREE.Group()
    const y = groundHeight(level, pad.x, pad.z) + 0.034
    const angle = Math.atan2(pad.dirX, pad.dirZ)

    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(pad.halfW * 2, pad.halfD * 2),
      stripMat,
    )
    plate.rotation.x = -Math.PI / 2
    padGroup.add(plate)

    // Left & right golden edge rails so the boost lane pops crisply on ice
    const railGeo = new THREE.PlaneGeometry(0.11, pad.halfD * 2)
    railGeo.rotateX(-Math.PI / 2)
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(railGeo, railMat)
      rail.position.set(side * (pad.halfW - 0.055), 0.004, 0)
      padGroup.add(rail)
    }

    // Bold forward-pointing amber chevrons sliding along +Z (pad direction)
    const count = Math.max(2, Math.round(pad.halfD * 1.45))
    const armW = Math.min(0.68, pad.halfW * 0.78)
    const armGeo = new THREE.PlaneGeometry(armW, 0.16)
    armGeo.rotateX(-Math.PI / 2)
    for (let i = 0; i < count; i++) {
      const chevMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.01, 0.01),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
      )
      const leftArm = new THREE.Mesh(armGeo, arrowMat)
      leftArm.position.set(-armW * 0.32, 0, 0)
      leftArm.rotation.y = -Math.PI / 4
      const rightArm = new THREE.Mesh(armGeo, arrowMat)
      rightArm.position.set(armW * 0.32, 0, 0)
      rightArm.rotation.y = Math.PI / 4
      chevMesh.add(leftArm, rightArm)
      chevMesh.position.set(0, 0.012, -pad.halfD * 0.68 + (i / Math.max(1, count - 1)) * pad.halfD * 1.36)
      padGroup.add(chevMesh)
      animated.push({ mesh: chevMesh, baseOffset: i / count, dirX: pad.dirX, dirZ: pad.dirZ })
    }

    padGroup.position.set(pad.x, y, pad.z)
    padGroup.rotation.y = angle
    island.add(padGroup)
  }

  return animated
}

/** Bold warm-gold double chevrons on the ice pointing straight South (+Z) into the single gate */
function addPenChevrons(island: THREE.Group, level: LevelId) {
  const mat = new THREE.MeshBasicMaterial({
    color: 0xf6cf5c,
    transparent: true,
    opacity: 0.86,
    depthWrite: false,
  })

  const armGeo = new THREE.PlaneGeometry(0.86, 0.18)
  armGeo.rotateX(-Math.PI / 2)

  for (const offsetZ of [1.25, 2.05]) {
    const mz = GATE_MOUTH_Z - offsetZ
    const y = (hasTerrainRelief(level) ? groundHeight(level, 0, mz) : 0) + 0.03
    const chev = new THREE.Group()
    const left = new THREE.Mesh(armGeo, mat)
    left.position.set(-0.26, 0, 0)
    left.rotation.y = -Math.PI / 4
    const right = new THREE.Mesh(armGeo, mat)
    right.position.set(0.26, 0, 0)
    right.rotation.y = Math.PI / 4
    chev.add(left, right)
    chev.position.set(0, y, mz)
    island.add(chev)
  }
}

function addCenterIceRing(island: THREE.Group) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.15, 2.32, 48),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  )
  ring.rotation.x = -Math.PI / 2
  ring.position.y = 0.026
  island.add(ring)
}

function addWater(island: THREE.Group) {
  const samples: [number, number][] = []
  for (let i = 0; i < RIVER.length - 1; i++) {
    const [x1, z1] = RIVER[i]
    const [x2, z2] = RIVER[i + 1]
    const len = Math.hypot(x2 - x1, z2 - z1)
    const steps = Math.max(1, Math.round(len / 0.32))
    for (let s = 0; s < steps; s++) {
      const t = s / steps
      samples.push([x1 + (x2 - x1) * t, z1 + (z2 - z1) * t])
    }
  }
  const last = RIVER[RIVER.length - 1]
  samples.push([last[0], last[1]])

  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x7ebbc4,
    roughness: 0.16,
    metalness: 0.08,
    transparent: true,
    opacity: 0.9,
  })

  let run: [number, number][] = []
  const flush = () => {
    if (run.length < 2) {
      run = []
      return
    }
    const mesh = ribbonMesh(run, 1.56, 0x7ebbc4, 0)
    mesh.material = waterMat
    const pos = mesh.geometry.getAttribute('position')
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, bankHeight(pos.getZ(i)) - 0.08)
    }
    pos.needsUpdate = true
    mesh.geometry.computeVertexNormals()
    island.add(mesh)
    run = []
  }
  for (const [x, z] of samples) {
    if (inFord(x)) flush()
    else run.push([x, z])
  }
  flush()

  for (const ford of FORDS) {
    for (const ox of [-0.58, 0, 0.58]) {
      const hit = riverClosest(ford.x + ox, 0.5)
      const stone = new THREE.Mesh(
        new THREE.CylinderGeometry(0.26, 0.3, 0.1, 12),
        clay(0xebe2d0, 0.86),
      )
      stone.position.set(hit.x, bankHeight(hit.z) + 0.045, hit.z)
      stone.castShadow = true
      stone.receiveShadow = true
      island.add(stone)
    }
  }
}

function createReliefIsland(level: LevelId): IslandRig {
  const island = new THREE.Group()
  const seg = 64
  const half = ISLAND_HALF
  const n = seg + 1
  const baseY = -1.65
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  const point = (i: number, j: number) => {
    const x = -half + (i / seg) * half * 2
    const z = -half + (j / seg) * half * 2
    return { x, z, y: groundHeight(level, x, z) }
  }
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const p = point(i, j)
      positions.push(p.x, p.y, p.z)
      uvs.push(i / seg, j / seg)
    }
  }
  const vert = (i: number, j: number) => j * n + i
  for (let j = 0; j < seg; j++) {
    for (let i = 0; i < seg; i++) {
      const a = vert(i, j)
      const b = vert(i + 1, j)
      const c = vert(i, j + 1)
      const d = vert(i + 1, j + 1)
      indices.push(a, c, b, c, d, b)
    }
  }
  const topGeo = new THREE.BufferGeometry()
  topGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  topGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  topGeo.setIndex(indices)
  topGeo.computeVertexNormals()
  const top = new THREE.Mesh(topGeo, iceRink(ICE_BASE, ICE_TINT, 2))
  top.receiveShadow = true
  island.add(top)

  const edge: [number, number][] = []
  for (let i = 0; i < n; i++) edge.push([i, 0])
  for (let j = 1; j < n; j++) edge.push([seg, j])
  for (let i = seg - 1; i >= 0; i--) edge.push([i, seg])
  for (let j = seg - 1; j >= 1; j--) edge.push([0, j])
  const skirtPos: number[] = []
  const skirtUv: number[] = []
  for (let idx = 0; idx < edge.length; idx++) {
    const [i, j] = edge[idx]
    const p = point(i, j)
    skirtPos.push(p.x, p.y, p.z, p.x, baseY, p.z)
    const u = idx / edge.length
    skirtUv.push(u * 4, 1, u * 4, 0)
  }
  const skirtIdx: number[] = []
  for (let e = 0; e < edge.length; e++) {
    const e2 = (e + 1) % edge.length
    const a = e * 2
    const b = a + 1
    const c = e2 * 2
    const d = c + 1
    skirtIdx.push(a, b, c, c, b, d)
  }
  const skirtGeo = new THREE.BufferGeometry()
  skirtGeo.setAttribute('position', new THREE.Float32BufferAttribute(skirtPos, 3))
  skirtGeo.setAttribute('uv', new THREE.Float32BufferAttribute(skirtUv, 2))
  skirtGeo.setIndex(skirtIdx)
  skirtGeo.computeVertexNormals()
  const skirt = new THREE.Mesh(skirtGeo, oakWood(SOIL_WARM, 3))
  skirt.castShadow = true
  skirt.receiveShadow = true
  island.add(skirt)

  const plinth = new THREE.Mesh(
    new RoundedBoxGeometry(half * 2 + 0.14, 0.36, half * 2 + 0.14, 6, 0.22),
    oakWood(OAK_TRIM, 3),
  )
  plinth.position.y = baseY - 0.12
  plinth.castShadow = true
  plinth.receiveShadow = true
  island.add(plinth)

  if (hasRiver(level)) addWater(island)
  addPerimeterBumpers(island, level)
  addPenChevrons(island, level)
  const bumpers = addSnowBumpers(island, level)
  const boostChevrons = addBoostPads(island, level)
  return {
    root: island,
    bumpers,
    bumperSquash: bumpers.map(() => 0),
    boostChevrons,
  }
}

export function createIsland(level: LevelId = 1): IslandRig {
  if (hasTerrainRelief(level)) return createReliefIsland(level)
  const island = new THREE.Group()
  const w = ISLAND_HALF * 2
  const d = ISLAND_HALF * 2

  const baseSlab = new THREE.Mesh(
    new RoundedBoxGeometry(w - 0.08, 1.38, d - 0.08, 8, 0.56),
    oakWood(SOIL_WARM, 3),
  )
  baseSlab.position.y = -0.82
  baseSlab.castShadow = true
  baseSlab.receiveShadow = true
  island.add(baseSlab)

  const trayLip = new THREE.Mesh(
    new RoundedBoxGeometry(w + 0.12, 0.28, d + 0.12, 6, 0.2),
    oakWood(OAK_TRIM, 3),
  )
  trayLip.position.y = -1.46
  trayLip.castShadow = true
  trayLip.receiveShadow = true
  island.add(trayLip)

  const snowCollar = new THREE.Mesh(
    new RoundedBoxGeometry(w + 0.22, 0.34, d + 0.22, 8, 0.22),
    snowTrim(0xfbf9f3, 0xe8eff2, 3),
  )
  snowCollar.position.y = -0.2
  snowCollar.castShadow = true
  snowCollar.receiveShadow = true
  island.add(snowCollar)

  const iceTop = new THREE.Mesh(
    new RoundedBoxGeometry(w - 0.3, 0.14, d - 0.3, 6, 0.08),
    iceRink(ICE_BASE, ICE_TINT, 2),
  )
  iceTop.position.y = -0.05
  iceTop.receiveShadow = true
  island.add(iceTop)

  addCenterIceRing(island)
  addPerimeterBumpers(island, level)
  addPenChevrons(island, level)
  const bumpers = addSnowBumpers(island, level)
  const boostChevrons = addBoostPads(island, level)
  return {
    root: island,
    bumpers,
    bumperSquash: bumpers.map(() => 0),
    boostChevrons,
  }
}

export function kickBumper(rig: IslandRig | null, index: number) {
  if (!rig || index < 0 || index >= rig.bumperSquash.length) return
  rig.bumperSquash[index] = 1
}

export function stepIsland(rig: IslandRig | null, dt: number, t: number) {
  if (!rig) return
  for (let i = 0; i < rig.bumpers.length; i++) {
    if (rig.bumperSquash[i] > 0.001) {
      rig.bumperSquash[i] = Math.max(0, rig.bumperSquash[i] - dt * 5.2)
      const wobble = Math.sin(rig.bumperSquash[i] * Math.PI * 2.5) * 0.22 * rig.bumperSquash[i]
      rig.bumpers[i].scale.set(1 + wobble, 1 - wobble * 0.7, 1 + wobble)
    } else {
      rig.bumpers[i].scale.set(1, 1, 1)
    }
  }
  for (const ch of rig.boostChevrons) {
    const pulse = 0.55 + 0.45 * Math.sin(t * 5.2 - ch.baseOffset * Math.PI * 2)
    ch.mesh.scale.setScalar(0.85 + pulse * 0.3)
  }
}