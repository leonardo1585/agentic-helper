import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // Permite acesso externo (0.0.0.0)
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      'free-malamute-indirectly.ngrok-free.app',
      '.ngrok-free.app', // Qualquer subdomínio ngrok
      '.ngrok.io'
    ],
    proxy: {
      '/api': {
        target: 'http://localhost:8001',
        changeOrigin: true,
      }
    }
  }
})

