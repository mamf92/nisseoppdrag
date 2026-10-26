import { defineConfig, devices } from '@playwright/test';

// Post-deploy smoke test against a real deployment (see .github/workflows/smoke.yml):
//   SMOKE_URL=https://nisseoppdrag-git-staging-….vercel.app pnpm smoke
// Optional: EXPECTED_SUPABASE_REF (project the deployment must point at) and
// VERCEL_AUTOMATION_BYPASS_SECRET (when Vercel deployment protection is on).
const executablePath = process.env['PLAYWRIGHT_CHROMIUM_PATH'];

export default defineConfig({
  testDir: './smoke',
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: process.env['SMOKE_URL'] },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], launchOptions: { executablePath } },
    },
  ],
});
