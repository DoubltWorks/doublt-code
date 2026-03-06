import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'mobile',
    pool: 'forks',
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
  },
});
