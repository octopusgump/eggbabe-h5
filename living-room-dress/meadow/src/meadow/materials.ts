import * as THREE from 'three'

const stdCache = new Map<string, THREE.MeshStandardMaterial>()
const texCache = new Map<string, { map: THREE.CanvasTexture; bump: THREE.CanvasTexture }>()

function seeded(seed: number) {
  let a = seed | 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hexToRgb(hex: number): [number, number, number] {
  return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255]
}

function clampByte(v: number) {
  return Math.max(0, Math.min(255, Math.round(v)))
}

function makeCanvas(size = 256) {
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const g = c.getContext('2d')
  if (!g) throw new Error('2d canvas unavailable')
  return { c, g, size }
}

function finalizeTexture(canvas: HTMLCanvasElement, repeat = 2, isColor = true) {
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(repeat, repeat)
  if (isColor) tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

/** Procedural wool-felt / plush fleece micro-texture + fiber bump map */
function getFeltTextures(baseHex: number, accentHex: number, repeat: number) {
  const key = `felt:${baseHex}:${accentHex}:${repeat}`
  const hit = texCache.get(key)
  if (hit) return hit

  const size = 256
  const col = makeCanvas(size)
  const bmp = makeCanvas(size)
  const rng = seeded(baseHex ^ (accentHex << 3) ^ 0x51a7)
  const [r0, g0, b0] = hexToRgb(baseHex)
  const [r1, g1, b1] = hexToRgb(accentHex)

  col.g.fillStyle = `rgb(${r0},${g0},${b0})`
  col.g.fillRect(0, 0, size, size)
  bmp.g.fillStyle = '#808080'
  bmp.g.fillRect(0, 0, size, size)

  // Soft tonal clouds for handmade dyed wool warmth
  for (let i = 0; i < 42; i++) {
    const x = rng() * size
    const y = rng() * size
    const rad = 18 + rng() * 38
    const useAccent = rng() > 0.45
    const grd = col.g.createRadialGradient(x, y, 2, x, y, rad)
    const rr = useAccent ? r1 : clampByte(r0 + 10)
    const gg = useAccent ? g1 : clampByte(g0 + 10)
    const bb = useAccent ? b1 : clampByte(b0 + 8)
    grd.addColorStop(0, `rgba(${rr},${gg},${bb},0.16)`)
    grd.addColorStop(1, `rgba(${rr},${gg},${bb},0)`)
    col.g.fillStyle = grd
    col.g.fillRect(x - rad, y - rad, rad * 2, rad * 2)
  }

  // Fine tactile felt fibers
  for (let i = 0; i < 1600; i++) {
    const x = rng() * size
    const y = rng() * size
    const len = 3 + rng() * 6
    const ang = rng() * Math.PI * 2
    const dx = Math.cos(ang) * len
    const dy = Math.sin(ang) * len
    const light = rng() > 0.5
    const delta = light ? 14 : -13
    col.g.strokeStyle = `rgba(${clampByte(r0 + delta)},${clampByte(g0 + delta)},${clampByte(b0 + delta)},0.22)`
    col.g.lineWidth = 0.8 + rng() * 0.7
    col.g.beginPath()
    col.g.moveTo(x, y)
    col.g.lineTo(x + dx, y + dy)
    col.g.stroke()

    const bv = light ? 168 : 96
    bmp.g.strokeStyle = `rgba(${bv},${bv},${bv},0.32)`
    bmp.g.lineWidth = 1
    bmp.g.beginPath()
    bmp.g.moveTo(x, y)
    bmp.g.lineTo(x + dx, y + dy)
    bmp.g.stroke()
  }

  const pair = {
    map: finalizeTexture(col.c, repeat, true),
    bump: finalizeTexture(bmp.c, repeat, false),
  }
  texCache.set(key, pair)
  return pair
}

/** Procedural warm oak wood grain matching EggBabe living-room furniture */
function getOakTextures(baseHex: number, repeat: number) {
  const key = `oak:${baseHex}:${repeat}`
  const hit = texCache.get(key)
  if (hit) return hit

  const size = 256
  const col = makeCanvas(size)
  const bmp = makeCanvas(size)
  const rng = seeded(baseHex ^ 0x37c9)
  const [r0, g0, b0] = hexToRgb(baseHex)

  col.g.fillStyle = `rgb(${r0},${g0},${b0})`
  col.g.fillRect(0, 0, size, size)
  bmp.g.fillStyle = '#808080'
  bmp.g.fillRect(0, 0, size, size)

  // Horizontal warm wood grain bands
  for (let y = 0; y < size; y += 2) {
    const wave = Math.sin((y / size) * Math.PI * 10) * 6 + (rng() - 0.5) * 9
    col.g.fillStyle = `rgba(${clampByte(r0 + wave)},${clampByte(g0 + wave * 0.85)},${clampByte(b0 + wave * 0.65)},0.34)`
    col.g.fillRect(0, y, size, 2)
    const bv = clampByte(128 + wave * 2.2)
    bmp.g.fillStyle = `rgb(${bv},${bv},${bv})`
    bmp.g.fillRect(0, y, size, 2)
  }

  for (let i = 0; i < 180; i++) {
    const y = rng() * size
    const x = rng() * size
    const w = 24 + rng() * 90
    const dark = rng() > 0.38
    const d = dark ? -18 : 14
    col.g.fillStyle = `rgba(${clampByte(r0 + d)},${clampByte(g0 + d * 0.9)},${clampByte(b0 + d * 0.75)},0.24)`
    col.g.fillRect(x, y, w, 1.3)
  }

  const pair = {
    map: finalizeTexture(col.c, repeat, true),
    bump: finalizeTexture(bmp.c, repeat, false),
  }
  texCache.set(key, pair)
  return pair
}

/** Procedural woven warm straw cushion texture for corner sheep pens */
function getStrawTextures(baseHex: number, repeat: number) {
  const key = `straw:${baseHex}:${repeat}`
  const hit = texCache.get(key)
  if (hit) return hit

  const size = 256
  const col = makeCanvas(size)
  const bmp = makeCanvas(size)
  const rng = seeded(baseHex ^ 0x9123)
  const [r0, g0, b0] = hexToRgb(baseHex)

  col.g.fillStyle = `rgb(${r0},${g0},${b0})`
  col.g.fillRect(0, 0, size, size)
  bmp.g.fillStyle = '#808080'
  bmp.g.fillRect(0, 0, size, size)

  for (let i = 0; i < 420; i++) {
    const x = rng() * size
    const y = rng() * size
    const len = 10 + rng() * 18
    const ang = rng() * Math.PI * 2
    const d = (rng() - 0.5) * 28
    col.g.strokeStyle = `rgba(${clampByte(r0 + d)},${clampByte(g0 + d * 0.9)},${clampByte(b0 + d * 0.65)},0.45)`
    col.g.lineWidth = 1.6 + rng() * 1.1
    col.g.lineCap = 'round'
    col.g.beginPath()
    col.g.moveTo(x, y)
    col.g.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len)
    col.g.stroke()

    const bv = clampByte(128 + d * 2)
    bmp.g.strokeStyle = `rgba(${bv},${bv},${bv},0.48)`
    bmp.g.lineWidth = 1.8
    bmp.g.beginPath()
    bmp.g.moveTo(x, y)
    bmp.g.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len)
    bmp.g.stroke()
  }

  const pair = {
    map: finalizeTexture(col.c, repeat, true),
    bump: finalizeTexture(bmp.c, repeat, false),
  }
  texCache.set(key, pair)
  return pair
}

/** Tactile matte polymer clay / ceramic PBR material */
export function clay(color: number, roughness = 0.88) {
  const key = `clay:${color}:${roughness.toFixed(2)}`
  let mat = stdCache.get(key)
  if (!mat) {
    mat = new THREE.MeshStandardMaterial({
      color,
      roughness,
      metalness: 0,
    })
    stdCache.set(key, mat)
  }
  return mat
}

/** Handmade wool-felt PBR material with micro-fiber texture & bump */
export function felt(color: number, accent = color, repeat = 2, bumpScale = 0.035) {
  const key = `felt:${color}:${accent}:${repeat}:${bumpScale.toFixed(3)}`
  let mat = stdCache.get(key)
  if (!mat) {
    const { map, bump } = getFeltTextures(color, accent, repeat)
    mat = new THREE.MeshStandardMaterial({
      map,
      bumpMap: bump,
      bumpScale,
      roughness: 0.94,
      metalness: 0,
    })
    stdCache.set(key, mat)
  }
  return mat
}

/** Warm EggBabe oak wood PBR material */
export function oakWood(color: number, repeat = 2) {
  const key = `oak:${color}:${repeat}`
  let mat = stdCache.get(key)
  if (!mat) {
    const { map, bump } = getOakTextures(color, repeat)
    mat = new THREE.MeshStandardMaterial({
      map,
      bumpMap: bump,
      bumpScale: 0.028,
      roughness: 0.78,
      metalness: 0,
    })
    stdCache.set(key, mat)
  }
  return mat
}

/** Soft woven straw cushion PBR material */
export function strawPad(color = 0xf2e6c8, repeat = 2) {
  const key = `straw:${color}:${repeat}`
  let mat = stdCache.get(key)
  if (!mat) {
    const { map, bump } = getStrawTextures(color, repeat)
    mat = new THREE.MeshStandardMaterial({
      map,
      bumpMap: bump,
      bumpScale: 0.04,
      roughness: 0.95,
      metalness: 0,
    })
    stdCache.set(key, mat)
  }
  return mat
}

/** Sunlit glazed ceramic / clear water material */
export function ceramic(color: number, roughness = 0.34) {
  return clay(color, roughness)
}

let shadowTex: THREE.CanvasTexture | null = null

export function softShadowTexture() {
  if (shadowTex) return shadowTex
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 128
  const g = c.getContext('2d')
  if (!g) throw new Error('canvas')
  const grd = g.createRadialGradient(64, 64, 6, 64, 64, 62)
  grd.addColorStop(0, 'rgba(74, 52, 30, 0.38)')
  grd.addColorStop(0.55, 'rgba(74, 52, 30, 0.14)')
  grd.addColorStop(1, 'rgba(74, 52, 30, 0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 128, 128)
  shadowTex = new THREE.CanvasTexture(c)
  shadowTex.colorSpace = THREE.SRGBColorSpace
  return shadowTex
}

export function blobShadow(rx: number, rz: number, opacity = 1) {
  const mesh = new THREE.Mesh(
    new THREE.CircleGeometry(1, 24),
    new THREE.MeshBasicMaterial({
      map: softShadowTexture(),
      transparent: true,
      depthWrite: false,
      opacity,
    }),
  )
  mesh.rotation.x = -Math.PI / 2
  mesh.scale.set(rx, rz, 1)
  mesh.position.y = 0.028
  return mesh
}