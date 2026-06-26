import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: '/',
  resolve: {
    alias: {
      '@vnu/web-shared': path.resolve(__dirname, '../../packages/web-shared/src'),
      '@vnu/shared-types': path.resolve(__dirname, '../../packages/shared-types/src'),
    },
  },
  server: {
    port: 5176,
    proxy: {
      '/api': 'http://localhost:3100',
      '/uploads': 'http://localhost:3100',
    },
  },
});
