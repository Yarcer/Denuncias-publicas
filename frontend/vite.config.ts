import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')

  if (mode === 'production') {
    if (!env.VITE_API_URL) {
      throw new Error('VITE_API_URL must be configured for production builds')
    }

    const apiUrl = new URL(env.VITE_API_URL)
    if (apiUrl.protocol !== 'https:' || apiUrl.pathname.replace(/\/+$/, '') !== '/api') {
      throw new Error('VITE_API_URL must use HTTPS and end with /api')
    }
  }

  return {
    plugins: [react()],
  }
})
