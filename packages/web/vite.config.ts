import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@doublt/shared': path.resolve(__dirname, '../shared/src'),
    },
  },
  server: {
    proxy: {
      '/ws': {
        target: 'ws://localhost:9800',
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
});
