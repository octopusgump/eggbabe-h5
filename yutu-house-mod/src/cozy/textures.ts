import * as THREE from 'three'

function makeCanvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return { c, ctx: c.getContext('2d')! }
}

function finalizeTex(c: HTMLCanvasElement, repeatX = 1, repeatY = 1, srgb = true) {
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(repeatX, repeatY)
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

/** Warm cream-oatmeal vertical striped matte wallpaper matching IMG_4791. */
export function createWallpaperTexture() {
  const { c, ctx } = makeCanvas(512, 512)
  const stripes = 8
  const sw = 512 / stripes
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#ead7be' : '#dfcab0'
    ctx.fillRect(i * sw, 0, sw, 512)
  }
  // Subtle matte paper grain
  for (let i = 0; i < 6500; i++) {
    const x = Math.random() * 512
    const y = Math.random() * 512
    const v = Math.random() > 0.5 ? 255 : 165
    ctx.fillStyle = `rgba(${v},${v - 8},${v - 18},0.055)`
    ctx.fillRect(x, y, 2, 2)
  }
  return finalizeTex(c, 1.5, 1, true)
}

/** Light warm natural oak plank floor texture with soft wood grain. */
export function createOakFloorTexture() {
  const { c, ctx } = makeCanvas(512, 512)
  ctx.fillStyle = '#cfa06e'
  ctx.fillRect(0, 0, 512, 512)

  const planks = 6
  const ph = 512 / planks
  const tones = ['#d2a472', '#caa06c', '#d7aa77', '#c79966', '#d0a270', '#ce9e6b']

  for (let p = 0; p < planks; p++) {
    const y0 = p * ph
    ctx.fillStyle = tones[p % tones.length]
    ctx.fillRect(0, y0, 512, ph)

    // Fine wood grain fibers
    for (let k = 0; k < 28; k++) {
      const gy = y0 + Math.random() * ph
      ctx.strokeStyle = k % 3 === 0 ? 'rgba(148,98,52,0.12)' : 'rgba(248,224,188,0.1)'
      ctx.lineWidth = 1 + Math.random() * 1.4
      ctx.beginPath()
      ctx.moveTo(0, gy)
      ctx.bezierCurveTo(170, gy + (Math.random() - 0.5) * 6, 340, gy + (Math.random() - 0.5) * 6, 512, gy)
      ctx.stroke()
    }

    // Plank horizontal seam
    ctx.fillStyle = 'rgba(128,84,42,0.22)'
    ctx.fillRect(0, y0, 512, 1.5)

    // Staggered vertical plank joint
    const jx = ((p * 193 + 80) % 440) + 36
    ctx.fillRect(jx, y0, 1.5, ph)
  }
  return finalizeTex(c, 1.4, 1.4, true)
}

/** Fluffy bouclé / sherpa bump map for shell sofa and plush round rug. */
export function createBoucleBumpTexture() {
  const { c, ctx } = makeCanvas(256, 256)
  ctx.fillStyle = '#808080'
  ctx.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 4800; i++) {
    const x = Math.random() * 256
    const y = Math.random() * 256
    const r = 1.2 + Math.random() * 2.4
    const shade = 95 + Math.floor(Math.random() * 135)
    ctx.fillStyle = `rgb(${shade},${shade},${shade})`
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  return finalizeTex(c, 3.2, 3.2, false)
}

/** Soft gingham quilt texture for the bedroom bed. */
export function createGinghamTexture(colorA = '#f4eee2', colorB = '#b9c9a8') {
  const { c, ctx } = makeCanvas(256, 256)
  const step = 32
  ctx.fillStyle = colorA
  ctx.fillRect(0, 0, 256, 256)
  ctx.fillStyle = colorB
  ctx.globalAlpha = 0.45
  for (let x = 0; x < 256; x += step * 2) ctx.fillRect(x, 0, step, 256)
  for (let y = 0; y < 256; y += step * 2) ctx.fillRect(0, y, 256, step)
  ctx.globalAlpha = 1
  return finalizeTex(c, 2, 2, true)
}

/** Minimal botanical sketch art texture for the bedroom wall frame. */
export function createBotanicalArtTexture() {
  const { c, ctx } = makeCanvas(256, 320)
  ctx.fillStyle = '#f8f2e6'
  ctx.fillRect(0, 0, 256, 320)
  ctx.strokeStyle = '#8f7d69'
  ctx.lineWidth = 3.5
  ctx.lineCap = 'round'
  // Stem
  ctx.beginPath()
  ctx.moveTo(128, 265)
  ctx.quadraticCurveTo(122, 165, 134, 65)
  ctx.stroke()
  // Soft leaves
  const leaves: [number, number, number, number][] = [
    [126, 210, -48, -28],
    [128, 180, 50, -30],
    [127, 145, -44, -26],
    [131, 120, 44, -26],
    [133, 86, -24, -26],
  ]
  for (const [x, y, dx, dy] of leaves) {
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.quadraticCurveTo(x + dx * 0.6, y + dy * 1.1, x + dx, y + dy)
    ctx.quadraticCurveTo(x + dx * 0.4, y + dy * 0.1, x, y)
    ctx.stroke()
  }
  return finalizeTex(c, 1, 1, true)
}
