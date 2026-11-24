import * as THREE from 'three'
import type { RoomModule } from '../modules/RoomModule'

export async function bakeRoomModule(
  mod: RoomModule,
  width: number,
  height: number,
): Promise<string> {
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true,
  })
  renderer.setPixelRatio(1)
  renderer.setClearColor(0x000000, 0)

  try {
    mod.renderTo(renderer, width, height)
    const canvas = renderer.domElement
    return canvas.toDataURL('image/webp', 0.88)
  } finally {
    renderer.dispose()
  }
}