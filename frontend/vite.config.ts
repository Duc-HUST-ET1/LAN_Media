import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    root: 'frontend',
    envDir: '..',
    plugins: [react()],
    build: {
      outDir: 'dist',
      emptyOutDir: false,
    },
    server: {
      host: '0.0.0.0',
      port: Number(env.FRONTEND_PORT ?? 5173),
      proxy: {
        '/api': {
          target: `http://127.0.0.1:${env.PORT ?? 3000}`,
          changeOrigin: true,
          configure: (proxy) => proxy.on('proxyReq', (proxyRequest) => proxyRequest.removeHeader('origin')),
        },
        '/ws': {
          target: `ws://127.0.0.1:${env.PORT ?? 3000}`,
          ws: true,
          configure: (proxy) => proxy.on('proxyReqWs', (proxyRequest) => proxyRequest.removeHeader('origin')),
        },
      },
    },
    preview: { host: '0.0.0.0' },
  };
});
