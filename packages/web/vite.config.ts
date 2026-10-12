import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: '0.0.0.0',
    proxy: {
      '/api/mumbai': {
        target: 'http://127.0.0.1:4001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/mumbai/, '')
      },
      '/api/delhi': {
        target: 'http://127.0.0.1:4002',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/delhi/, '')
      },
      '/api/bengaluru': {
        target: 'http://127.0.0.1:4003',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/bengaluru/, '')
      }
    }
  }
});
