import * as THREE from 'three'
import { clay } from './materials'

/** Flat ribbon along a ground curve (river / path). */
export function ribbonMesh(
  points: [number, number][],
  width: number,
  color: number,
  y: number,
) {
  const curve = new THREE.CatmullRomCurve3(
    points.map(([x, z]) => new THREE.Vector3(x, y, z)),
    false,
    'catmullrom',
    0.35,
  )
  const n = 56
  const positions: number[] = []
  const indices: number[] = []

  for (let i = 0; i <= n; i++) {
    const u = i / n
    const p = curve.getPoint(u)
    const t = curve.getTangent(u)
    const side = new THREE.Vector3(-t.z, 0, t.x)
    if (side.lengthSq() < 1e-6) side.set(1, 0, 0)
    side.normalize().multiplyScalar(width * 0.5)
    positions.push(p.x + side.x, y, p.z + side.z)
    positions.push(p.x - side.x, y, p.z - side.z)
  }

  for (let i = 0; i < n; i++) {
    const a = i * 2
    indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setIndex(indices)
  geo.computeVertexNormals()

  const mesh = new THREE.Mesh(geo, clay(color))
  mesh.receiveShadow = true
  return mesh
}