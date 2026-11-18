/** Camera + bake scale — single source for RoomModule and ModuleLayers */

/** Azimuth degrees (from +Z toward +X). Art reverse-solve ≈ 39–43. */
export const BAKE_AZ = 40

/** Elevation degrees. Art reverse-solve ≈ 35–40. */
export const BAKE_EL = 36

/**
 * World units ↔ art pixels.
 * Furniture in tierCatalog is authored in absolute world units;
 * room plate size = aabb / PX_PER_UNIT so all rooms share one scale.
 * Override at runtime with ?pxu=
 */
export let PX_PER_UNIT = 120

/** Bake canvas supersample vs CSS pixels. 1.5 ≈ 6MB for 4 rooms. */
export const SUPER_SAMPLE = 1.5

/** Extra frustum padding so tall pieces / AO rings stay inside the bake. */
export const FRUSTUM_PAD = 0.18

export function setPxPerUnit(v: number) {
  if (Number.isFinite(v) && v > 10 && v < 400) PX_PER_UNIT = v
}
