import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('signed-out visitors land on the login page without console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('/');
  await expect(page).toHaveURL(/\/logg-inn$/);
  await expect(page.getByRole('heading', { name: 'Logg inn' })).toBeVisible();
  expect(errors).toEqual([]);

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
