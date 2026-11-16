import * as THREE from 'three'
import type { RoomLayout } from '../modules/tierCatalog'
import { BAKE_AZ, BAKE_EL, FRUSTUM_PAD, PX_PER_UNIT, SUPER_SAMPLE } from './constants'
import type { Point } from '../types/geom'

export type PlateFit = {
  camera: THREE.OrthographicCamera
  /** CSS / logical bake size (before supersample) */
  cssW: number
  cssH: number
  /** Pixel size passed to renderer.setSize */
  canvasW: number
  canvasH: number
  /** Ground plate half-extents in world units */
  plateW: number
  plateD: number
  /**
   * Ground plate corners in bake CSS pixels, order:
   * (-x,-z), (+x,-z), (+x,+z), (-x,+z) then sorted by atan2 for homography.
   */
  plateQuad: Point[]
}

function deg(d: number) {
  return (d * Math.PI) / 180
}

/** Camera position on a sphere looking at origin. */
export function cameraPosition(az = BAKE_AZ, el = BAKE_EL, dist = 14) {
  const a = deg(az)
  const e = deg(el)
  return new THREE.Vector3(
    Math.sin(a) * Math.cos(e) * dist,
    Math.sin(e) * dist,
    Math.cos(a) * Math.cos(e) * dist,
  )
}

export function plateSize(layout: RoomLayout, pxPerUnit = PX_PER_UNIT) {
  const plateW = layout.aabb.w / pxPerUnit
  const plateD = layout.aabb.h / pxPerUnit
  return { plateW, plateD }
}

/** Four ground corners in world XZ, fixed order. */
export function worldPlateCorners(plateW: number, plateD: number): THREE.Vector3[] {
  const hx = plateW / 2
  const hz = plateD / 2
  return [
    new THREE.Vector3(-hx, 0, -hz),
    new THREE.Vector3(hx, 0, -hz),
    new THREE.Vector3(hx, 0, hz),
    new THREE.Vector3(-hx, 0, hz),
  ]
}

function projectToView(
  p: THREE.Vector3,
  cam: THREE.OrthographicCamera,
): { x: number; y: number } {
  const v = p.clone().project(cam)
  return { x: v.x, y: v.y }
}

/**
 * Build ortho camera + canvas size so the ground plate fills the bake
 * with FRUSTUM_PAD margin. All rooms share PX_PER_UNIT.
 */
export function fitCamera(
  layout: RoomLayout,
  opts?: { az?: number; el?: number; pxPerUnit?: number; superSample?: number },
): PlateFit {
  const az = opts?.az ?? BAKE_AZ
  const el = opts?.el ?? BAKE_EL
  const pxPerUnit = opts?.pxPerUnit ?? PX_PER_UNIT
  const ss = opts?.superSample ?? SUPER_SAMPLE

  const { plateW, plateD } = plateSize(layout, pxPerUnit)
  const corners = worldPlateCorners(plateW, plateD)

  // Provisional camera to measure projected extents
  const probe = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 80)
  probe.position.copy(cameraPosition(az, el))
  probe.lookAt(0, 0, 0)
  probe.updateMatrixWorld(true)
  probe.updateProjectionMatrix()

  // Project plate + a tall point so furniture tops stay in frame
  const samples = [...corners, new THREE.Vector3(0, 1.2, 0)]
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const p of samples) {
    // Manual view-space project without depending on frustum scale:
    // use camera matrix world inverse
    const local = p.clone().applyMatrix4(probe.matrixWorldInverse)
    minX = Math.min(minX, local.x)
    maxX = Math.max(maxX, local.x)
    minY = Math.min(minY, local.y)
    maxY = Math.max(maxY, local.y)
  }

  const spanX = maxX - minX
  const spanY = maxY - minY
  const padX = spanX * FRUSTUM_PAD
  const padY = spanY * FRUSTUM_PAD
  const left = minX - padX
  const right = maxX + padX
  const bottom = minY - padY
  const top = maxY + padY
  const halfW = (right - left) / 2
  const halfH = (top - bottom) / 2
  const midX = (left + right) / 2
  const midY = (bottom + top) / 2

  const camera = new THREE.OrthographicCamera(
    midX - halfW,
    midX + halfW,
    midY + halfH,
    midY - halfH,
    0.1,
    80,
  )
  camera.position.copy(probe.position)
  camera.lookAt(0, 0, 0)
  camera.updateMatrixWorld(true)
  camera.updateProjectionMatrix()

  // CSS size: map view units → art pixels at PX_PER_UNIT density
  // View span in world-ish units ≈ halfW*2; we want plate's art aabb as baseline.
  // Use projected NDC span of plate alone to size the canvas so 1 world unit ≈ pxPerUnit art px
  // after accounting for view scale.
  const viewSpanX = right - left
  const viewSpanY = top - bottom
  // Density: plateW world → roughly plateW/viewSpanX of the canvas width in "plate ratios"
  // Target: canvas CSS width such that plate projects to ~aabb.w pixels
  const plateNdc: { x: number; y: number }[] = []
  for (const p of corners) {
    plateNdc.push(projectToView(p, camera))
  }
  let pMinX = Infinity
  let pMaxX = -Infinity
  let pMinY = Infinity
  let pMaxY = -Infinity
  for (const n of plateNdc) {
    pMinX = Math.min(pMinX, n.x)
    pMaxX = Math.max(pMaxX, n.x)
    pMinY = Math.min(pMinY, n.y)
    pMaxY = Math.max(pMaxY, n.y)
  }
  const plateNdcW = pMaxX - pMinX
  const plateNdcH = pMaxY - pMinY
  // Full canvas covers NDC [-1,1]²; plate occupies plateNdcW of that 2-wide range
  // We want plate width in CSS ≈ layout.aabb.w
  const cssW = Math.max(64, Math.round(layout.aabb.w * (2 / Math.max(plateNdcW, 0.01))))
  const cssH = Math.max(64, Math.round(layout.aabb.h * (2 / Math.max(plateNdcH, 0.01))))
  // Keep aspect matching frustum so pixels aren't stretched
  const frustumAspect = viewSpanX / viewSpanY
  let outW = cssW
  let outH = cssH
  if (outW / outH > frustumAspect) {
    outW = Math.round(outH * frustumAspect)
  } else {
    outH = Math.round(outW / frustumAspect)
  }

  const canvasW = Math.max(64, Math.round(outW * ss))
  const canvasH = Math.max(64, Math.round(outH * ss))

  // plateQuad in CSS pixels (y down)
  const plateQuad: Point[] = plateNdc.map((n) => {
    const x = ((n.x + 1) / 2) * outW
    const y = ((1 - n.y) / 2) * outH
    return [x, y]
  })

  return {
    camera,
    cssW: outW,
    cssH: outH,
    canvasW,
    canvasH,
    plateW,
    plateD,
    plateQuad,
  }
}
