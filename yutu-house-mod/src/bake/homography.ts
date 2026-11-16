import type { Point } from '../types/geom'

/** Convex hull (Andrew's monotone chain). */
function hull(pts: Point[]): Point[] {
  const sorted = [...new Set(pts.map((p) => `${p[0]},${p[1]}`))]
    .map((s) => s.split(',').map(Number) as Point)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1])
  if (sorted.length <= 2) return sorted
  const cross = (o: Point, a: Point, b: Point) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const lower: Point[] = []
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0)
      lower.pop()
    lower.push(p)
  }
  const upper: Point[] = []
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i]
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0)
      upper.pop()
    upper.push(p)
  }
  lower.pop()
  upper.pop()
  return lower.concat(upper)
}

function quadArea(q: Point[]) {
  let s = 0
  for (let i = 0; i < 4; i++) {
    const a = q[i]
    const b = q[(i + 1) % 4]
    s += a[0] * b[1] - b[0] * a[1]
  }
  return Math.abs(s) / 2
}

function isConvexQuad(q: Point[]) {
  const cross = (o: Point, a: Point, b: Point) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const signs = [0, 1, 2, 3].map((i) => cross(q[i], q[(i + 1) % 4], q[(i + 2) % 4]))
  return signs.every((s) => s > 0) || signs.every((s) => s < 0)
}

/**
 * Pick the largest-area convex quad from a room polygon (5–7 pts with door notches).
 * Returns 4 points ordered by atan2 around centroid (CCW).
 */
export function pickFloorQuad(poly: Point[]): Point[] {
  const h = hull(poly)
  if (h.length === 4) return orderByAngle(h)
  if (h.length < 4) {
    // Degenerate — fall back to AABB corners
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const [x, y] of poly) {
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
    return orderByAngle([
      [minX, minY],
      [maxX, minY],
      [maxX, maxY],
      [minX, maxY],
    ])
  }
  let best: Point[] | null = null
  let bestA = -1
  const n = h.length
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      for (let k = j + 1; k < n; k++) {
        for (let l = k + 1; l < n; l++) {
          const q = [h[i], h[j], h[k], h[l]]
          if (!isConvexQuad(q)) continue
          const a = quadArea(q)
          if (a > bestA) {
            bestA = a
            best = q
          }
        }
      }
    }
  }
  return orderByAngle(best ?? h.slice(0, 4))
}

export function orderByAngle(pts: Point[]): Point[] {
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length
  const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length
  return [...pts].sort(
    (a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx),
  )
}

/** Solve 8-DOF homography mapping src[i] → dst[i] (4 point pairs). */
export function solveHomography(src: Point[], dst: Point[]): number[] {
  if (src.length !== 4 || dst.length !== 4) throw new Error('homography needs 4 pairs')
  // Ah = b, h = [h0..h7], h8 = 1
  const A: number[][] = []
  const b: number[] = []
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i]
    const [u, v] = dst[i]
    A.push([x, y, 1, 0, 0, 0, -x * u, -y * u])
    b.push(u)
    A.push([0, 0, 0, x, y, 1, -x * v, -y * v])
    b.push(v)
  }
  return gaussianSolve(A, b)
}

function gaussianSolve(A: number[][], b: number[]): number[] {
  const n = A.length
  const M = A.map((row, i) => [...row, b[i]])
  for (let i = 0; i < n; i++) {
    let piv = i
    for (let r = i + 1; r < n; r++) if (Math.abs(M[r][i]) > Math.abs(M[piv][i])) piv = r
    ;[M[i], M[piv]] = [M[piv], M[i]]
    const diag = M[i][i]
    if (Math.abs(diag) < 1e-12) throw new Error('singular homography')
    for (let c = i; c <= n; c++) M[i][c] /= diag
    for (let r = 0; r < n; r++) {
      if (r === i) continue
      const f = M[r][i]
      for (let c = i; c <= n; c++) M[r][c] -= f * M[i][c]
    }
  }
  return M.map((row) => row[n])
}

/**
 * CSS matrix3d from 8-DOF homography (column-major, 2D→3D embed).
 * Maps bake pixel (x,y,1) → art pixel.
 */
export function toMatrix3d(h: number[]): string {
  const [a, b, c, d, e, f, g, hh] = h
  // | a  b  0  c |
  // | d  e  0  f |
  // | 0  0  1  0 |
  // | g  hh 0  1 |
  return `matrix3d(${a},${d},0,${g},${b},${e},0,${hh},0,0,1,0,${c},${f},0,1)`
}

/**
 * Label a convex floor quad as [back, right, front, left] using screen Y/X.
 * Matches plate order from roomPlate: (-x,-z), (+x,-z), (+x,+z), (-x,+z)
 * under our az≈40° camera (far / far-right / near / near-left).
 */
export function labelFloorCorners(q: Point[]): Point[] {
  if (q.length !== 4) throw new Error('need 4 corners')
  const byY = [...q].sort((a, b) => a[1] - b[1] || a[0] - b[0])
  const back = byY[0]
  const front = byY[3]
  const mid = byY.slice(1, 3)
  const right = mid[0][0] >= mid[1][0] ? mid[0] : mid[1]
  const left = mid[0][0] >= mid[1][0] ? mid[1] : mid[0]
  return [back, right, front, left]
}

/** Least-squares affine: bake (x,y) → art (u,v). Stable outside the plate quad. */
export function solveAffine(src: Point[], dst: Point[]): number[] {
  // u = a*x + b*y + c ; v = d*x + e*y + f
  const n = src.length
  // Normal equations for [a,b,c]
  let sxx = 0
  let sxy = 0
  let sx = 0
  let syy = 0
  let sy = 0
  let su = 0
  let sv = 0
  let sxu = 0
  let syu = 0
  let sxv = 0
  let syv = 0
  for (let i = 0; i < n; i++) {
    const [x, y] = src[i]
    const [u, v] = dst[i]
    sxx += x * x
    sxy += x * y
    sx += x
    syy += y * y
    sy += y
    su += u
    sv += v
    sxu += x * u
    syu += y * u
    sxv += x * v
    syv += y * v
  }
  const A = [
    [sxx, sxy, sx],
    [sxy, syy, sy],
    [sx, sy, n],
  ]
  const [a, b, c] = gaussianSolve(
    A.map((row) => [...row]),
    [sxu, syu, su],
  )
  const [d, e, f] = gaussianSolve(
    A.map((row) => [...row]),
    [sxv, syv, sv],
  )
  return [a, b, c, d, e, f]
}

/** CSS matrix(a,b,c,d,e,f) — note CSS uses column order differently from our [a,b,c,d,e,f]. */
export function toCssMatrix(aff: number[]): string {
  const [a, b, c, d, e, f] = aff
  // CSS: u = a*x + c*y + e ; v = b*x + d*y + f
  return `matrix(${a},${d},${b},${e},${c},${f})`
}

/**
 * Align plateQuad (bake CSS px, fixed world order (-x-z,+x-z,+x+z,-x+z))
 * onto art floor quad labeled [back, right, front, left].
 * Affine only — stable when mapping image pixels outside the plate.
 */
export function plateToArtMatrix(plateQuad: Point[], artQuad: Point[]): string {
  if (plateQuad.length !== 4 || artQuad.length !== 4) throw new Error('need 4 pairs')
  // plateQuad may not be in visual top/right/bottom/left order after projection —
  // re-label BOTH sides the same way so correspondence is geometric, not index-based.
  const src = labelFloorCorners(plateQuad)
  const dst = labelFloorCorners(artQuad)
  const aff = solveAffine(src, dst)
  return toCssMatrix(aff)
}
