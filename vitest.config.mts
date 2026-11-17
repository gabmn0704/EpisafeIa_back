import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'test-secret-test-secret-test-secret-123',
      BCRYPT_ROUNDS: '4',
      LOG_LEVEL: 'silent',
    },
    coverage: { provider: 'v8', include: ['src/**/*.ts'], exclude: ['src/server.ts', 'src/repositories/pg/**'] },
  },
});
