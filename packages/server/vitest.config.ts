import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@doublt/shared': path.resolve(__dirname, '../shared/src/index.ts'),
    },
  },
  test: {
    name: 'server',
    pool: 'forks',
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/__tests__/**',
        'src/websocket/**',
        'src/notification/**',
        'src/terminal/**',
        'src/api/**',
      ],
    },
  },
});
