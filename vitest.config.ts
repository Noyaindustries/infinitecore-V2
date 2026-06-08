import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    include: ['tests/unit/**/*.vitest.ts', 'tests/security/**/*.vitest.ts'],
    environment: 'node',
    reporters: ['default'],
  },
});
