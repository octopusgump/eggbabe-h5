import { defineConfig } from 'vite'
import path from 'node:path'

const base = '/eggbabe-h5/yutu-house-mod/site/'

export default defineConfig({
  base,
  publicDir: 'public',
  resolve: {
    alias: {
      '@house-assets': path.resolve(__dirname, '../yutu-house/src'),
    },
  },
  server: {
    fs: { allow: ['..'] },
  },
  build: {
    outDir: 'site',
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'app.html'),
    },
  },
})