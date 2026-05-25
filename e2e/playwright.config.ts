import { defineConfig } from '@playwright/test';
import path from 'path';

// Default Brave install locations per platform. Override with BRAVE_PATH env var.
const DEFAULT_BRAVE_PATHS: Record<string, string> = {
  darwin: '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  linux: '/usr/bin/brave-browser',
  win32: 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
};
const resolvedBrave = process.env.BRAVE_PATH || DEFAULT_BRAVE_PATHS[process.platform];

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
    {
      // Run with: npx playwright test --project=brave
      // Override binary with: BRAVE_PATH=/path/to/brave npx playwright test --project=brave
      // The fixture reads metadata.executablePath via testInfo at launch time.
      name: 'brave',
      use: {},
      metadata: { executablePath: resolvedBrave },
    },
  ],
});
