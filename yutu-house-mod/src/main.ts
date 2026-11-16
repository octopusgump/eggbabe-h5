import './style.css'
import type { HouseGeom } from './types/geom'
import { HouseApp } from './HouseApp'

async function boot() {
  const res = await fetch(`${import.meta.env.BASE_URL}geom.json`)
  const geom = (await res.json()) as HouseGeom
  const stage = document.getElementById('stage')
  if (!stage) throw new Error('#stage missing')

  const app = new HouseApp(stage, geom)
  app.mount()
  HouseApp.fit()
  addEventListener('resize', () => HouseApp.fit())
}

boot()