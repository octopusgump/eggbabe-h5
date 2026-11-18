import * as THREE from 'three'

/** Floor pad — rectangular with rounded corners + slight thickness. */
export function roundedPadGeometry(sx: number, sz: number, radius: number, thickness = 0.06) {
  const hx = sx / 2
  const hz = sz / 2
  const r = Math.min(radius, hx - 0.001, hz - 0.001)
  const shape = new THREE.Shape()
  shape.moveTo(-hx + r, -hz)
  shape.lineTo(hx - r, -hz)
  shape.absarc(hx - r, -hz + r, r, -Math.PI / 2, 0, false)
  shape.lineTo(hx, hz - r)
  shape.absarc(hx - r, hz - r, r, 0, Math.PI / 2, false)
  shape.lineTo(-hx + r, hz)
  shape.absarc(-hx + r, hz - r, r, Math.PI / 2, Math.PI, false)
  shape.lineTo(-hx, -hz + r)
  shape.absarc(-hx + r, -hz + r, r, Math.PI, Math.PI * 1.5, false)
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
    curveSegments: 6,
  })
  // Extrude goes along +Z; rotate so thickness is +Y and pad lies on XZ
  geo.rotateX(-Math.PI / 2)
  geo.translate(0, thickness / 2, 0)
  return geo
}
