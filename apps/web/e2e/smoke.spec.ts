import { expect, test } from '@playwright/test';

test('hello page renders without console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Nisseoppdrag' })).toBeVisible();
  expect(errors).toEqual([]);
});
