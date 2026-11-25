import { defineConfig } from 'vite'

/** Relative base works identically on GitHub Pages, local dev, and #activity-player iframe */
export default defineConfig({
  base: './',
  build: {
    outDir: 'site',
    emptyOutDir: true,
  },
})