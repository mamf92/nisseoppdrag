import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { MEMBER, raise, signInAs } from './mock-supabase';

const CATEGORIES = ['social', 'kindness', 'learning', 'collaboration', 'holiday_fun'];

function slot(n: number, status = 'open') {
  return {
    assignment_id: `a${String(n)}`,
    slot: n,
    status,
    points_awarded: status === 'completed' ? 10 : 0,
    category: CATEGORIES[n - 1],
    title_nb: `Oppdrag ${String(n)}`,
    title_en: `Mission ${String(n)}`,
    body_nb: 'Gjør noe hyggelig for en kollega.',
    body_en: 'Do something nice for a colleague.',
    points: 10,
    difficulty: 1 + (n % 3),
  };
}

const WEEK = {
  state: 'open',
  week_start: '2026-12-07',
  closes_at: '2099-12-13T22:59:00Z',
  skip_left: true,
  reroll_left: true,
  slots: [1, 2, 3, 4, 5].map((n) => slot(n)),
};

const SIZES = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'desktop', width: 1280, height: 900 },
] as const;

for (const story of ['gaarden', 'laaven'] as const) {
  for (const size of SIZES) {
    test(`player home in ${story} at ${String(size.width)} px`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.addInitScript((value) => {
        window.localStorage.setItem('nisse-theme', value);
      }, story);
      await signInAs(page, {
        me: { ...MEMBER, story },
        rpc: { ensure_my_week: () => ({ body: WEEK }) },
      });
      await page.goto('/');
      await expect(page.getByRole('heading', { name: 'Oppdrag 1' })).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({
        path: `screenshots/home-${story}-${String(size.width)}.png`,
        fullPage: true,
      });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(results.violations.map((v) => v.id)).toEqual([]);
    });
  }
}

test('complete (with undo), skip and the error toast', async ({ page }) => {
  const calls: string[] = [];
  await signInAs(page, {
    me: MEMBER,
    rpc: {
      ensure_my_week: () => ({ body: WEEK }),
      complete_assignment: (args) => {
        calls.push(`complete:${String(args['p_assignment'])}`);
        return { body: { points: 10, new_achievements: [] } };
      },
      skip_assignment: () => raise('skip_used'),
    },
  });
  await page.goto('/');
  const card = (n: number) => page.getByRole('article', { name: `Oppdrag ${String(n)}` });

  // Undo inside the window: nothing is sent.
  await card(1).getByRole('button', { name: 'Fullført!' }).click();
  await expect(page.getByText('1 av 5 fullført')).toBeVisible();
  await page.getByRole('button', { name: 'Angre' }).click();
  await expect(page.getByText('0 av 5 fullført')).toBeVisible();

  // Left alone, it is sent after four seconds.
  await card(2).getByRole('button', { name: 'Fullført!' }).click();
  await expect.poll(() => calls, { timeout: 8000 }).toEqual(['complete:a2']);
  await expect(card(2).getByText('Fullført', { exact: true })).toBeVisible();

  // The database refuses the skip: the card comes back and a toast says why.
  await card(3).getByRole('button', { name: 'Hopp over' }).click();
  await page.getByRole('button', { name: 'Ja, hopp over' }).click();
  await expect(page.getByText('Du har allerede hoppet over et oppdrag denne uken.')).toBeVisible();
  await expect(card(3).getByRole('button', { name: 'Fullført!' })).toBeVisible();
});
