import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    exclude: ['tests/e2e/**'],
    setupFiles: ['tests/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**', 'src/stores/**', 'src/hooks/**'],
      exclude: ['src/mock/**'],
      reporter: ['text', 'html', 'lcov'],
    },
    benchmark: { include: ['tests/bench/**/*.bench.ts'] },
  },
});
