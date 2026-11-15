import * as THREE from 'three'

const cache = new Map<number, THREE.MeshLambertMaterial>()

/** Smooth clay lambert — no flat facets. */
export function clay(color: number) {
  let mat = cache.get(color)
  if (!mat) {
    mat = new THREE.MeshLambertMaterial({ color })
    cache.set(color, mat)
  }
  return mat
}

let shadowTex: THREE.CanvasTexture | null = null
let rangeTex: THREE.CanvasTexture | null = null

/** A pale pool, lighter than a foot shadow, fading out at the rim. */
export function rangeShadowTexture() {
  if (rangeTex) return rangeTex
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 256
  const g = c.getContext('2d')
  if (!g) throw new Error('canvas')
  const grd = g.createRadialGradient(128, 128, 4, 128, 128, 126)
  grd.addColorStop(0, 'rgba(62, 96, 42, 0.22)')
  grd.addColorStop(0.72, 'rgba(62, 96, 42, 0.12)')
  grd.addColorStop(0.92, 'rgba(62, 96, 42, 0.05)')
  grd.addColorStop(1, 'rgba(62, 96, 42, 0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 256, 256)
  rangeTex = new THREE.CanvasTexture(c)
  rangeTex.colorSpace = THREE.SRGBColorSpace
  return rangeTex
}

export function softShadowTexture() {
  if (shadowTex) return shadowTex
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 128
  const g = c.getContext('2d')
  if (!g) throw new Error('canvas')
  const grd = g.createRadialGradient(64, 64, 6, 64, 64, 62)
  grd.addColorStop(0, 'rgba(55, 90, 40, 0.42)')
  grd.addColorStop(0.55, 'rgba(55, 90, 40, 0.16)')
  grd.addColorStop(1, 'rgba(55, 90, 40, 0)')
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
  mesh.position.y = 0.025
  return mesh
}