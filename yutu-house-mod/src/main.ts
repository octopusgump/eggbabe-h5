import './style.css'
import { CozyRoomApp } from './cozy/CozyRoomApp'

function main() {
  const stage = document.getElementById('stage')
  if (!stage) return
  const app = new CozyRoomApp(stage)
  app.mount()
  CozyRoomApp.fit()
  addEventListener('resize', () => CozyRoomApp.fit())
}

main()