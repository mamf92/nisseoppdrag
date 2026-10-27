import { defineConfig, devices } from '@playwright/test';

// Locally a preinstalled Chromium can be used via PLAYWRIGHT_CHROMIUM_PATH;
// in CI `playwright install chromium` provides one.
const executablePath = process.env['PLAYWRIGHT_CHROMIUM_PATH'];

export default defineConfig({
  testDir: './e2e',
  forbidOnly: !!process.env['CI'],
  retries: 0,
  reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: 'http://127.0.0.1:4173' },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], launchOptions: { executablePath } },
    },
  ],
  webServer: {
    // Without Supabase variables the build gets a placeholder URL; the mocked specs answer it.
    command:
      'VITE_SUPABASE_URL=${VITE_SUPABASE_URL:-http://127.0.0.1:54321} VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY:-placeholder-key} VITE_DEV_UI=true pnpm build && pnpm preview --host 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
  },
});
