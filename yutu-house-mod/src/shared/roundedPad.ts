import * as THREE from 'three'

/** Floor patch — simplified from meadow/pen.ts roundedPad */
export function roundedPadGeometry(size: number, radius: number) {
  const s = size / 2
  const r = Math.min(radius, s - 0.001)
  const shape = new THREE.Shape()
  shape.moveTo(-s + r, -s)
  shape.lineTo(s - r, -s)
  shape.absarc(s - r, -s + r, r, -Math.PI / 2, 0, false)
  shape.lineTo(s, s - r)
  shape.absarc(s - r, s - r, r, 0, Math.PI / 2, false)
  shape.lineTo(-s + r, s)
  shape.absarc(-s + r, s - r, r, Math.PI / 2, Math.PI, false)
  shape.lineTo(-s, -s + r)
  shape.absarc(-s + r, -s + r, r, Math.PI, Math.PI * 1.5, false)
  return new THREE.ShapeGeometry(shape)
}