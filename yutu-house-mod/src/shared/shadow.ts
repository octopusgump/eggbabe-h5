import * as THREE from 'three'

let shadowTex: THREE.CanvasTexture | null = null

/** Soft contact shadow texture — from danbaobao-meadow/materials.ts */
export function softShadowTexture() {
  if (shadowTex) return shadowTex
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 128
  const g = c.getContext('2d')
  if (!g) throw new Error('canvas')
  const grd = g.createRadialGradient(64, 64, 6, 64, 64, 62)
  grd.addColorStop(0, 'rgba(45, 28, 12, 0.45)')
  grd.addColorStop(0.55, 'rgba(45, 28, 12, 0.16)')
  grd.addColorStop(1, 'rgba(45, 28, 12, 0)')
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
  mesh.userData.shadow = true
  return mesh
}
