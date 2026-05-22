import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['packages/*'],
    coverage: {
      include: ['packages/*/src/**/*.ts'],
      exclude: ['**/types.ts'],
      reporter: ['text', 'html'],
    },
  },
});
