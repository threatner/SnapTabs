import { defineConfig } from '@playwright/test';
import path from 'path';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  retries: 1,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    headless: false,
    viewport: { width: 400, height: 600 },
    actionTimeout: 5_000,
  },
  projects: [
    {
      name: 'chromium',
      use: {},
    },
  ],
});
