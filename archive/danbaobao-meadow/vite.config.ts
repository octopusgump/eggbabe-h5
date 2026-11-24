import { defineConfig } from 'vite'

/** GitHub Project Pages: https://octopusgump.github.io/eggbabe-h5/ */
const base = '/eggbabe-h5/danbaobao-meadow/site/'

export default defineConfig({
  base,
  build: {
    outDir: 'site',
    emptyOutDir: true,
  },
})