import * as THREE from 'three'
import type { RoomModule } from '../modules/RoomModule'
import { multiplyTint } from '../shared/tint'

export async function bakeRoomModule(
  mod: RoomModule,
  tintCss?: string,
): Promise<{ url: string; cssW: number; cssH: number }> {
  const { canvasW, canvasH, cssW, cssH } = mod.getCanvasSize()
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true,
  })
  renderer.setPixelRatio(1)
  renderer.setClearColor(0x000000, 0)
  renderer.outputColorSpace = THREE.SRGBColorSpace

  try {
    mod.renderTo(renderer, canvasW, canvasH)
    let canvas: HTMLCanvasElement = renderer.domElement
    if (tintCss) {
      canvas = multiplyTint(canvas, tintCss)
    }
    // Downscale + soft radial feather so hard bake rects don't read as stickers
    {
      const out = document.createElement('canvas')
      out.width = cssW
      out.height = cssH
      const ctx = out.getContext('2d')!
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(canvas, 0, 0, cssW, cssH)
      ctx.globalCompositeOperation = 'destination-in'
      const r = Math.hypot(cssW, cssH) * 0.5
      const g = ctx.createRadialGradient(cssW / 2, cssH / 2, r * 0.55, cssW / 2, cssH / 2, r * 0.92)
      g.addColorStop(0, 'rgba(0,0,0,1)')
      g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, cssW, cssH)
      ctx.globalCompositeOperation = 'source-over'
      canvas = out
    }
    return { url: canvas.toDataURL('image/webp', 0.9), cssW, cssH }
  } finally {
    renderer.dispose()
    renderer.forceContextLoss?.()
  }
}
