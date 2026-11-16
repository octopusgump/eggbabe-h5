import * as THREE from 'three'

const cache = new Map<number, THREE.MeshLambertMaterial>()

/** Smooth clay lambert — from danbaobao-meadow/materials.ts */
export function clay(color: number) {
  let mat = cache.get(color)
  if (!mat) {
    mat = new THREE.MeshLambertMaterial({ color })
    cache.set(color, mat)
  }
  return mat
}