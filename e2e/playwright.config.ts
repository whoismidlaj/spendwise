import { defineConfig, devices } from '@playwright/test'

const port = Number(process.env.E2E_PORT || 3100)

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  globalTeardown: './teardown.ts',
  use: { baseURL: `http://localhost:${port}`, trace: 'retain-on-failure' },
  webServer: {
    command: `npm run dev -- --port ${port} --hostname 127.0.0.1`,
    cwd: process.env.E2E_APP_DIR || '..',
    url: `http://localhost:${port}/login`,
    reuseExistingServer: true,
    timeout: 120_000,
    env: { NEXTAUTH_URL: `http://127.0.0.1:${port}`, NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || 'e2e-secret-e2e-secret-e2e-secret-1234' },
  },
  projects: [{ name: 'phone-320', use: { ...devices['Pixel 5'], viewport: { width: 320, height: 640 } } }, { name: 'desktop', use: { ...devices['Desktop Chrome'] } }],
})
