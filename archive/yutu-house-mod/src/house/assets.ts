/** Vite must see static imports — dynamic occ${i}.webp breaks on GitHub Pages. */
import house from '../../../yutu-house/src/house.webp'
import houseS from '../../../yutu-house/src/house_s.webp'
import front from '../../../yutu-house/src/front.webp'
import closed from '../../../yutu-house/src/closed.webp'
import side from '../../../yutu-house/src/side.webp'
import occ0 from '../../../yutu-house/src/occ0.webp'
import occ1 from '../../../yutu-house/src/occ1.webp'
import occ2 from '../../../yutu-house/src/occ2.webp'
import occ3 from '../../../yutu-house/src/occ3.webp'
import occ4 from '../../../yutu-house/src/occ4.webp'
import occ5 from '../../../yutu-house/src/occ5.webp'
import occ6 from '../../../yutu-house/src/occ6.webp'

export const OCC_IMAGES = [occ0, occ1, occ2, occ3, occ4, occ5, occ6] as const

const map: Record<string, string> = {
  'house.webp': house,
  'house_s.webp': houseS,
  'front.webp': front,
  'closed.webp': closed,
  'side.webp': side,
}

export function houseAsset(name: string): string {
  const url = map[name]
  if (!url) throw new Error(`missing asset: ${name}`)
  return url
}