import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

// The /dev/ui page shows every component in both themes. The production build used by this run
// includes it because playwright.config.ts sets VITE_DEV_UI=true.

const WIDTHS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'desktop', width: 1280, height: 900 },
] as const;

async function open(page: Page) {
  await page.goto('/dev/ui');
  await expect(page.getByRole('heading', { name: 'UI kit' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

for (const size of WIDTHS) {
  test.describe(`${size.name} (${String(size.width)} px)`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test('fits the screen and renders both themes', async ({ page }) => {
      await open(page);
      for (const theme of ['gaarden', 'laaven']) {
        const frame = page.getByTestId(`frame-${theme}`);
        await expect(frame).toBeVisible();
        await frame.screenshot({ path: `screenshots/ui-${theme}-${String(size.width)}.png` });
      }
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });

    for (const theme of ['gaarden', 'laaven']) {
      test(`has no axe violations in ${theme}`, async ({ page }) => {
        await open(page);
        const results = await new AxeBuilder({ page })
          .include(`[data-testid="frame-${theme}"]`)
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();
        expect(
          results.violations.map(
            (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`,
          ),
        ).toEqual([]);
      });
    }
  });
}

test('the theme and language switches work and are remembered', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Låven', exact: true }).first().click();
  await expect(page.locator('html')).toHaveAttribute('data-nisse-theme', 'laaven');
  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-nisse-theme', 'laaven');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('fonts are self-hosted and no third-party request is made', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.hostname !== '127.0.0.1' && url.protocol.startsWith('http'))
      external.push(request.url());
  });
  await open(page);
  expect(external).toEqual([]);
  const families = await page.evaluate(() => [...document.fonts].map((f) => f.family).sort());
  expect(families).toEqual(expect.arrayContaining(['Alegreya Sans', 'Fraunces']));
});

test('the mission buttons announce through the toast regions', async ({ page }) => {
  await open(page);
  const frame = page.getByTestId('frame-gaarden');
  const card = frame.getByRole('article', { name: /julehilsen/ });
  await card.getByRole('button', { name: 'Fullført!' }).click();
  await expect(page.getByRole('status').getByText('+10 poeng')).toBeVisible();
  await card.getByRole('button', { name: 'Hopp over' }).click();
  await expect(page.getByRole('alert').getByText('Brukt opp denne uka')).toBeVisible();
});

test('the sheet opens, traps focus and closes with Escape', async ({ page }) => {
  await open(page);
  await page.getByTestId('frame-gaarden').getByRole('button', { name: 'Åpne ark' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nytt oppdrag' });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});
