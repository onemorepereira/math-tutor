import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // The dev-proxy target is read from the (gitignored) .env so no environment-specific
  // endpoint is committed. Set VITE_DEV_PROXY_TARGET=<api-base-url> in frontend/.env
  // for local development. Services call `${API_URL}/api/...` with API_URL=/api in dev,
  // so the proxy strips the leading /api before forwarding (routes are /api/... on the stage).
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget = env.VITE_DEV_PROXY_TARGET

  return {
    plugins: [vue()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    },
    server: {
      port: 3000,
      proxy: proxyTarget
        ? {
            '/api': {
              target: proxyTarget,
              changeOrigin: true,
              rewrite: (path) => path.replace(/^\/api/, ''),
              secure: true
            }
          }
        : undefined
    }
  }
})
