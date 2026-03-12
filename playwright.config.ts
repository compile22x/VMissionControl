import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30000,
  retries: 1,
  use: { baseURL: 'http://localhost:4000', screenshot: 'only-on-failure' },
  webServer: {
    command: 'NEXT_PUBLIC_DEMO_MODE=true npm run dev',
    port: 4000,
    reuseExistingServer: true,
    timeout: 120000,
  },
  projects: [
    { name: 'demo', testMatch: /demo\..+/ },
    { name: 'sitl', testMatch: /sitl\..+/ },
  ],
});
