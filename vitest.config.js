// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true, // Allows using globals like `describe`, `it`, etc., without importing
    environment: 'node', // Use 'jsdom' if you need a browser-like environment
    coverage: {
      provider: 'istanbul', // Coverage provider
      reporter: ['text', 'html', 'lcov'] // Coverage reports
    },
    dir: './test/unit'
  }
})
