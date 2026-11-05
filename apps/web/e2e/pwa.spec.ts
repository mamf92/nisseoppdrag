import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { MEMBER, signInAs } from './mock-supabase';

// The experimental PWA (on in this build, off on Vercel Production).

const IPHONE_26 =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';
const IPHONE_18 =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';

test('the manifest is linked and complete', async ({ page, request }) => {
  await page.goto('/velkommen');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBe('/manifest.webmanifest');
  const manifest = (await (await request.get('/manifest.webmanifest')).json()) as {
    name: string;
    display: string;
    icons: { src: string; purpose: string }[];
    shortcuts: unknown[];
  };
  expect(manifest.name).toBe('Nisseoppdrag');
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons.map((icon) => icon.purpose)).toEqual(
    expect.arrayContaining(['any', 'maskable']),
  );
  expect(manifest.shortcuts.length).toBeGreaterThan(0);
  for (const icon of manifest.icons) {
    expect((await request.get(icon.src)).status(), icon.src).toBe(200);
  }
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
});

test.describe('service worker', () => {
  test.use({ serviceWorkers: 'allow' });

  test('caches the shell so the app opens offline', async ({ page, context }) => {
    await page.goto('/velkommen');
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.reload();
    await expect
      .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
      .toBe(true);
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'frakoblet' })).toBeVisible();
    await context.setOffline(false);
  });
});

for (const [name, userAgent, firstStep] of [
  ['iOS 26', IPHONE_26, 'Trykk på ⋯ og så på Del'],
  ['iOS 18', IPHONE_18, 'Trykk på Del-knappen'],
] as const) {
  test(`first visit on an iPhone with ${name} opens the install guide`, async ({ browser }) => {
    const context = await browser.newContext({
      userAgent,
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    await page.goto('/velkommen');
    const guide = page.getByRole('dialog', { name: 'Hent nissen hjem' });
    await expect(guide).toBeVisible();
    await expect(guide.getByRole('heading', { name: firstStep })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const slug = name.replace(' ', '');
    await page.screenshot({ path: `screenshots/pwa-guide-${slug}-1.png`, animations: 'disabled' });
    const results = await new AxeBuilder({ page })
      .include('dialog')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(results.violations.map((v) => v.id)).toEqual([]);

    const steps = [
      'Velg «Legg til på Hjem-skjerm»',
      'Trykk «Legg til»',
      'Åpne Nisseoppdrag fra Hjem-skjermen',
      'Slå på varsler i appen',
    ];
    for (const [index, heading] of steps.entries()) {
      await guide.getByRole('button', { name: 'Neste' }).click();
      await expect(guide.getByRole('heading', { name: heading })).toBeVisible();
      await page.screenshot({
        path: `screenshots/pwa-guide-${slug}-${String(index + 2)}.png`,
        animations: 'disabled',
      });
    }
    await guide.getByRole('button', { name: 'Ferdig' }).click();
    await expect(guide).toBeHidden();

    // seen once is enough
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(guide).toBeHidden();
    await context.close();
  });
}

test('an in-app browser is sent to Safari first', async ({ browser }) => {
  const context = await browser.newContext({
    userAgent: `${IPHONE_18.replace(' Version/18.5', '').replace(' Safari/604.1', '')} Instagram 400.0.0`,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto('/velkommen');
  await expect(page.getByRole('heading', { name: 'Åpne siden i Safari først' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Kopier lenken' })).toBeVisible();
  await context.close();
});

test('a computer does not get the guide uninvited, but /installer has it', async ({ page }) => {
  await page.goto('/velkommen');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.goto('/installer');
  await expect(page.getByRole('heading', { name: 'Hent nissen hjem', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Installer fra adressefeltet' })).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
});

for (const story of ['gaarden', 'laaven'] as const) {
  test(`Meg has the notification switch in ${story}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript((value) => {
      window.localStorage.setItem('nisse-theme', value);
    }, story);
    await signInAs(page, { me: { ...MEMBER, story } });
    await page.goto('/meg');
    const section = page.getByRole('region', { name: 'Varsler' });
    await expect(section.getByRole('button', { name: 'Slå på varsler' })).toBeVisible();
    await expect(
      section.getByRole('link', { name: 'Installer appen og slå på varsler' }),
    ).toBeVisible();
    await section.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `screenshots/pwa-meg-${story}.png`, fullPage: true });
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(results.violations.map((v) => v.id)).toEqual([]);
  });
}

test('the home screen badge counts open missions', async ({ page }) => {
  await page.addInitScript(() => {
    const calls: unknown[] = [];
    (window as unknown as { badgeCalls: unknown[] }).badgeCalls = calls;
    Object.defineProperty(navigator, 'setAppBadge', {
      value: (n: number) => {
        calls.push(n);
        return Promise.resolve();
      },
    });
    Object.defineProperty(navigator, 'clearAppBadge', {
      value: () => {
        calls.push(0);
        return Promise.resolve();
      },
    });
  });
  const slot = (n: number, status: string) => ({
    assignment_id: `a${String(n)}`,
    slot: n,
    status,
    points_awarded: 0,
    category: 'social',
    title_nb: `Oppdrag ${String(n)}`,
    title_en: `Mission ${String(n)}`,
    body_nb: '',
    body_en: '',
    points: 10,
    difficulty: 1,
  });
  await signInAs(page, {
    me: MEMBER,
    rpc: {
      ensure_my_week: () => ({
        body: {
          state: 'open',
          week_start: '2026-12-07',
          closes_at: '2099-12-13T22:59:00Z',
          skip_left: true,
          reroll_left: true,
          slots: [1, 2, 3, 4, 5].map((n) => slot(n, n <= 2 ? 'completed' : 'open')),
        },
      }),
    },
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Oppdrag 1' })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { badgeCalls: unknown[] }).badgeCalls))
    .toContain(3);
});
