// playwright.config.ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './test',
  timeout: 30000,
  expect: {
    timeout: 10000,
  },
  webServer: {
    command: 'npx vite', // Command to start the server
    port: 3000,
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI, // Reuse server in development
  },
  use: {
    trace: 'on-first-retry',
  },
})
