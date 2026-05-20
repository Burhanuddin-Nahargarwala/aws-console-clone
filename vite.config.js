import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Floci (AWS emulator) — S3, DynamoDB, Lambda API calls etc.
      '/s3-api': {
        target: 'http://localhost:4566',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/s3-api/, '')
      },
      // Custom backend — Lambda execution sandbox, EC2 containers, IAM enforcement
      '/backend-api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/backend-api/, '')
      }
    }
  }
})
