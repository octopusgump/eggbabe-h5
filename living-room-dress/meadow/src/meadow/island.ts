import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { ISLAND_HALF } from './constants'
import {
  bankHeight,
  FORDS,
  groundHeight,
  inFord,
  RIVER,
  riverClosest,
  type LevelId,
} from './levels'
import { clay, felt, iceRink, oakWood, snowTrim } from './materials'
import { GATE_HALF_W, GATE_MOUTH_Z } from './bounds'
import { ribbonMesh } from './ribbon'

const ICE_BASE = 0xc3e4ec
const ICE_TINT = 0xa6d2df
const SOIL_WARM = 0xb18355
const OAK_TRIM = 0xc39666

/** Full enclosed snow-oak perimeter bumper walls (North, West, East, and South flanks around the single South-Center gate) */
function addPerimeterBumpers(island: THREE.Group, level: LevelId) {
  const half = ISLAND_HALF
  const snowMat = snowTrim(0xfbf9f3, 0xe9f0f2, 2)
  const woodCapMat = oakWood(0xc89e6f, 2)
  const fullSpan = half * 2 - 0.5
  const southFlankLen = half - GATE_HALF_W - 0.25
  const southFlankCenter = GATE_HALF_W + southFlankLen / 2 + 0.08
  const rimY = 0.24

  const addSeg = (x: number, z: number, sx: number, sz: number) => {
    const y = level !== 1 ? groundHeight(level, x, z) : 0
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

  // Continuous North wall (complete enclosure!)
  addSeg(0, -half + 0.22, fullSpan, 0.58)

  // Two symmetrical South flank walls framing the single wide South-Center gate
  addSeg(-southFlankCenter, half - 0.22, southFlankLen, 0.58)
  addSeg(southFlankCenter, half - 0.22, southFlankLen, 0.58)

  // East & West walls (split cleanly around the stream on Levels 2 & 3)
  for (const sideX of [-half + 0.22, half - 0.22]) {
    if (level !== 1) {
      for (const [zMid, zLen] of [[-4.1, 6.2], [4.5, 5.4]] as const) {
        addSeg(sideX, zMid, 0.58, zLen)
      }
    } else {
      addSeg(sideX, 0, 0.58, fullSpan)
    }
  }

  // Cheerful miniature clay snowman perched on the east snowbank (loving Penguin Pushers nod!)
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

  // Cozy EggBabe sage knit scarf
  const scarf = new THREE.Mesh(
    new THREE.TorusGeometry(0.18, 0.052, 8, 16),
    felt(0x9db65b, 0x86a149, 1, 0.02),
  )
  scarf.rotation.x = Math.PI / 2
  scarf.position.y = 0.49
  g.add(scarf)

  // Tiny warm orange clay carrot nose & cocoa button eyes
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

  const y = level !== 1 ? groundHeight(level, x, z) : 0
  g.position.set(x, y + 0.38, z)
  island.add(g)
}

/** Bold warm-gold double chevrons on the ice pointing straight into the single South-Center gate */
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
    const y = (level !== 1 ? groundHeight(level, 0, mz) : 0) + 0.03
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

/** Subtle warm cream center rink medallion (cozy tabletop ice rink detail) */
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

function createSlopeIsland(level: LevelId) {
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

  addWater(island)
  addPerimeterBumpers(island, level)
  addPenChevrons(island, level)
  return island
}

export function createIsland(level: LevelId = 1): THREE.Group {
  if (level !== 1) return createSlopeIsland(level)
  const island = new THREE.Group()
  const w = ISLAND_HALF * 2
  const d = ISLAND_HALF * 2

  // Thick warm oak diorama base slab echoing EggBabe oak furniture
  const baseSlab = new THREE.Mesh(
    new RoundedBoxGeometry(w - 0.08, 1.38, d - 0.08, 8, 0.56),
    oakWood(SOIL_WARM, 3),
  )
  baseSlab.position.y = -0.82
  baseSlab.castShadow = true
  baseSlab.receiveShadow = true
  island.add(baseSlab)

  // Warm oak bottom tray lip
  const trayLip = new THREE.Mesh(
    new RoundedBoxGeometry(w + 0.12, 0.28, d + 0.12, 6, 0.2),
    oakWood(OAK_TRIM, 3),
  )
  trayLip.position.y = -1.46
  trayLip.castShadow = true
  trayLip.receiveShadow = true
  island.add(trayLip)

  // Soft snow-cushion rim collar right under the ice sheet
  const snowCollar = new THREE.Mesh(
    new RoundedBoxGeometry(w + 0.22, 0.34, d + 0.22, 8, 0.22),
    snowTrim(0xfbf9f3, 0xe8eff2, 3),
  )
  snowCollar.position.y = -0.2
  snowCollar.castShadow = true
  snowCollar.receiveShadow = true
  island.add(snowCollar)

  // Gleaming sunlit frosted ice rink surface (with subtle skate scratch texture & specular glint)
  const iceTop = new THREE.Mesh(
    new RoundedBoxGeometry(w - 0.3, 0.14, d - 0.3, 6, 0.08),
    iceRink(ICE_BASE, ICE_TINT, 2),
  )
  iceTop.position.y = -0.05
  iceTop.receiveShadow = true
  island.add(iceTop)

  addCenterIceRing(island)
  addPerimeterBumpers(island, 1)
  addPenChevrons(island, 1)
  return island
}