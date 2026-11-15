import { defineConfig } from 'vitest/config'

// Tes logika murni (tanpa browser). Jalankan: pnpm test:unit
export default defineConfig({
  test: { environment: 'node', include: ['shared/**/*.test.ts', 'worker/**/*.test.ts'] },
})
