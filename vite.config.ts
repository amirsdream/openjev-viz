import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/lab': {
        target: 'http://192.168.1.20:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/lab/, ''),
      },
    },
  },
})
