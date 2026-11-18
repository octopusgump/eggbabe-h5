import type { HouseGeom, Point } from '../types/geom'

/** Sample geom lightmap (same as House2D). */
export function sampleLight(G: HouseGeom, x: number, y: number): number[] {
  const L = G.light
  const fx = Math.max(0, Math.min(L.w - 1.001, x / L.cell - 0.5))
  const fy = Math.max(0, Math.min(L.h - 1.001, y / L.cell - 0.5))
  const x0 = fx | 0
  const y0 = fy | 0
  const tx = fx - x0
  const ty = fy - y0
  const c = [0, 0, 0]
  for (let k = 0; k < 3; k++) {
    const a = L.rgb[y0][x0][k]
    const b = L.rgb[y0][x0 + 1][k]
    const c2 = L.rgb[y0 + 1][x0][k]
    const d = L.rgb[y0 + 1][x0 + 1][k]
    c[k] = (a * (1 - tx) + b * tx) * (1 - ty) + (c2 * (1 - tx) + d * tx) * ty
  }
  return c
}

const luma = (c: number[]) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]

export function lightRef(G: HouseGeom) {
  return (
    G.rooms.reduce((s, r) => s + luma(sampleLight(G, r.target[0], r.target[1] - 30)), 0) /
    G.rooms.length
  )
}

/** Same formula as House2D.tintAt — returns css rgb() string. */
export function tintAt(p: Point, G: HouseGeom, LREF: number) {
  const c = sampleLight(G, p[0], p[1] - 34)
  const l = luma(c)
  const k = Math.max(0.74, Math.min(1.0, 0.9 * Math.pow(l / LREF, 0.55)))
  const m = Math.max(c[0], c[1], c[2], 1e-6)
  const t = c.map((v) => Math.round(255 * k * (0.6 + (0.4 * v) / m)))
  return `rgb(${t[0]},${t[1]},${t[2]})`
}

/**
 * Soft multiply-tint: mix room light into clay without muddying hue.
 * strength 0 = none, 1 = full multiply (too gray on pastel clay).
 */
export function multiplyTint(
  src: HTMLCanvasElement,
  tint: string,
  strength = 0.35,
): HTMLCanvasElement {
  const out = document.createElement('canvas')
  out.width = src.width
  out.height = src.height
  const ctx = out.getContext('2d')!
  ctx.drawImage(src, 0, 0)
  if (strength <= 0) return out
  ctx.save()
  ctx.globalAlpha = strength
  ctx.globalCompositeOperation = 'multiply'
  ctx.fillStyle = tint
  ctx.fillRect(0, 0, out.width, out.height)
  ctx.restore()
  ctx.globalCompositeOperation = 'destination-in'
  ctx.drawImage(src, 0, 0)
  ctx.globalCompositeOperation = 'source-over'
  return out
}
