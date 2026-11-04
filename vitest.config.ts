import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@ael/engine': fileURLToPath(new URL('./packages/learning-engine/src/index.ts', import.meta.url)),
      '@ael/contracts': fileURLToPath(new URL('./packages/contracts/src/index.ts', import.meta.url)),
      '@ael/utils': fileURLToPath(new URL('./packages/utils/priority-calculations.ts', import.meta.url)),
    },
  },
  test: {
    include: [
      'packages/*/tests/**/*.test.ts',
      'apps/*/tests/**/*.test.ts',
      'src/tests/**/*.test.ts',
    ],
    environment: 'node',
  },
});
