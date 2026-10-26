import { expect, test } from '@playwright/test';
import type { APIRequestContext, Page } from '@playwright/test';
import { checkSupabaseEnv } from '../src/lib/supabaseEnv';

// Runs against a deployed site, not the local stack. It catches what the local tests cannot:
// wrong VITE_SUPABASE_* values in the host's settings, a project that does not allow e-mail
// sign-in, a CSP that blocks Supabase, or deployment protection in front of the site.

const site = process.env['SMOKE_URL'];
const expectedRef = process.env['EXPECTED_SUPABASE_REF'];
const bypass = process.env['VERCEL_AUTOMATION_BYPASS_SECRET'];

test.skip(!site, 'set SMOKE_URL to the deployment to check');

interface Settings {
  status: number;
  body: { external?: { email?: boolean } };
  error?: string;
}

interface BundleConfig {
  url: string;
  key: string;
}

// Lets the browser context and the API client through Vercel deployment protection.
async function passProtection(request: APIRequestContext) {
  if (!bypass) return;
  await request.get(
    `/?x-vercel-protection-bypass=${encodeURIComponent(bypass)}&x-vercel-set-bypass-cookie=true`,
  );
}

// The config is baked into the bundle, so read it the way the browser would get it.
async function readBundleConfig(request: APIRequestContext): Promise<BundleConfig> {
  const html = await (await request.get('/')).text();
  const scripts = [...html.matchAll(/<script[^>]+src="([^"]+\.js)"/g)].map((m) => m[1] ?? '');
  expect(scripts.length, 'index.html references no script').toBeGreaterThan(0);
  for (const src of scripts) {
    const js = await (await request.get(src)).text();
    const url = /https?:\/\/[a-z0-9-]+\.supabase\.co/.exec(js)?.[0];
    const key =
      /sb_publishable_[A-Za-z0-9_-]+|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.exec(
        js,
      )?.[0];
    if (url && key) return { url, key };
  }
  throw new Error('The deployed bundle contains no Supabase URL and key (env vars missing?)');
}

test.beforeEach(async ({ page }) => {
  await passProtection(page.request);
});

test('the login page loads cleanly', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('requestfailed', (r) => errors.push(`${r.url()} ${r.failure()?.errorText ?? ''}`));
  const response = await page.goto('/');
  expect(response?.status(), 'is Vercel deployment protection on?').toBeLessThan(400);
  await expect(page).toHaveURL(/\/logg-inn$/);
  await expect(page.getByRole('heading', { name: 'Logg inn' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('the deployment is wired to a working Supabase project', async ({ page }) => {
  const config = await readBundleConfig(page.request);
  expect(checkSupabaseEnv(config)).toEqual([]);
  if (expectedRef) {
    expect(new URL(config.url).hostname).toBe(`${expectedRef}.supabase.co`);
  }

  // From the page itself, so CORS and the site's Content-Security-Policy are exercised too.
  await page.goto('/');
  const settings = await page.evaluate<Settings, BundleConfig>(async ({ url, key }) => {
    try {
      const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } });
      return { status: res.status, body: (await res.json()) as { external?: { email?: boolean } } };
    } catch (error) {
      // A thrown fetch means DNS, CORS or the site's Content-Security-Policy got in the way.
      return { status: 0, body: {}, error: String(error) };
    }
  }, config);
  expect(
    settings.status,
    `Supabase unreachable or rejected the URL/key pair ${JSON.stringify(settings)}`,
  ).toBe(200);
  expect(settings.body.external?.email, 'e-mail sign-in is off in Supabase').toBe(true);
});

test('asking for a sign-in code reaches Supabase with the deployed key', async ({ page }) => {
  const config = await readBundleConfig(page.request);
  let seen: { url: string; apikey: string | undefined } | undefined;
  // Answered here so the smoke test never sends a real e-mail.
  await page.route('**/auth/v1/otp**', async (route) => {
    seen = { url: route.request().url(), apikey: route.request().headers()['apikey'] };
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await fillAndSend(page);
  await expect(page.getByLabel('Kode')).toBeVisible();
  expect(seen?.url.startsWith(config.url)).toBe(true);
  expect(seen?.apikey).toBe(config.key);
});

async function fillAndSend(page: Page) {
  await page.goto('/logg-inn');
  await page.getByLabel('E-post').fill('smoke@example.com');
  await page.getByRole('button', { name: 'Send kode' }).click();
}
