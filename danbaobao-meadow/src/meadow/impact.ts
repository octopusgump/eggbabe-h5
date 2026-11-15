import * as THREE from 'three'

type Hit = THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial> & {
  lifetime: number
  maxLifetime: number
  maxScale: number
}

const hits: Hit[] = []
const forward = new THREE.Vector3(0, 0, 1)
const normal = new THREE.Vector3()

/** Cream shockwave. Stands at the contact and faces the hit normal. */
export function spawnImpact(
  scene: THREE.Scene,
  x: number,
  z: number,
  nx: number,
  nz: number,
  scale = 0.85,
) {
  const len = Math.hypot(nx, nz)
  if (len < 0.001) {
    nx = 1
    nz = 0
  } else {
    nx /= len
    nz /= len
  }

  const mesh = new THREE.Mesh(
    new THREE.RingGeometry(0.55, 1, 28),
    new THREE.MeshBasicMaterial({
      color: 0xfff4d2,
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
      opacity: 1,
    }),
  ) as Hit
  mesh.lifetime = 0
  mesh.maxLifetime = 0.4
  mesh.maxScale = scale
  mesh.position.set(x, 0.42, z)
  normal.set(nx, 0.28, nz).normalize()
  mesh.quaternion.setFromUnitVectors(forward, normal)
  scene.add(mesh)
  hits.push(mesh)
}

export function stepImpacts(dt: number) {
  for (let i = hits.length - 1; i >= 0; i--) {
    const hit = hits[i]
    hit.lifetime += dt
    const ratio = hit.lifetime / hit.maxLifetime
    let scale = Math.sin((ratio * 4.5 * Math.PI) / 4)
    scale = 1 - (1 - scale) ** 2
    hit.scale.setScalar(Math.max(0, scale) * hit.maxScale)
    hit.material.opacity = 1 - Math.sin((ratio * 2 * Math.PI) / 4)
    if (ratio >= 1) {
      hits.splice(i, 1)
      hit.parent?.remove(hit)
      hit.geometry.dispose()
      hit.material.dispose()
    }
  }
}

export function clearImpacts() {
  for (const hit of hits) {
    hit.parent?.remove(hit)
    hit.geometry.dispose()
    hit.material.dispose()
  }
  hits.length = 0
}
