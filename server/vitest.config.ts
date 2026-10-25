import { defineConfig } from 'vitest/config';

// Database-backed tests talk to a remote cluster, so allow more than the default five seconds.
export default defineConfig({ test: { testTimeout: 20_000, hookTimeout: 30_000 } });
