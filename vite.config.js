import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy all requests starting with /s3-api to the Floci emulator on port 4566.
      // This solves the CORS error because the browser thinks it's talking to the React server.
      '/s3-api': {
        target: 'http://localhost:4566',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/s3-api/, '')
      }
    }
  }
})
