import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { MEMBER, signInAs } from './mock-supabase';

const BOARD = [
  { member_id: 'x1', name: 'Lyktenissen', portrait: 'lyktenissen-2', points: 90, rank: 1 },
  { member_id: 'm1', name: 'Grøtnissen', portrait: 'grotnissa-3', points: 60, rank: 2 },
  { member_id: 'x3', name: 'Fjøsnissen', portrait: null, points: 30, rank: 3 },
  { member_id: 'x4', name: 'Snønissa', portrait: 'fjoskatten', points: 10, rank: 4 },
];

const ACHIEVEMENTS = [
  ['first_spoon', 'Første grøtskje', 'Fullfør ditt første oppdrag.', 10],
  ['full_barn', 'Full låve', 'Fullfør alle fem oppdrag i én uke.', 20],
  ['lantern', 'Lanternebærer', 'Tre uker på rad med minst tre fullførte oppdrag.', 30],
].map(([code, name, description, sort]) => ({
  code,
  name_nb: name,
  name_en: name,
  description_nb: description,
  description_en: description,
  bonus_points: 5,
  is_secret: false,
  sort,
}));

const SIZES = [
  { width: 390, height: 844 },
  { width: 1280, height: 900 },
] as const;

for (const story of ['gaarden', 'laaven'] as const) {
  for (const size of SIZES) {
    test(`leaderboard, badges and profile in ${story} at ${String(size.width)} px`, async ({
      page,
    }) => {
      await page.setViewportSize(size);
      await page.addInitScript((value) => {
        window.localStorage.setItem('nisse-theme', value);
      }, story);
      await signInAs(page, {
        me: { ...MEMBER, story, portrait: 'grotnissa-3' },
        rpc: { leaderboard: () => ({ body: BOARD }) },
        tables: {
          achievements: ACHIEVEMENTS,
          member_achievements: [
            { achievement_code: 'first_spoon', unlocked_at: '2026-12-01T10:00:00Z' },
          ],
        },
      });
      for (const [path, heading] of [
        ['/toppliste', 'Toppnissene'],
        ['/merker', 'Merker'],
        ['/meg', MEMBER.name],
      ] as const) {
        await page.goto(path);
        await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        await page.screenshot({
          path: `screenshots/${path.slice(1)}-${story}-${String(size.width)}.png`,
          fullPage: true,
        });
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow).toBeLessThanOrEqual(0);
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();
        expect(results.violations.map((v) => `${path}: ${v.id}`)).toEqual([]);
      }
    });
  }
}

test('the leaderboard toggles between week and season', async ({ page }) => {
  const scopes: string[] = [];
  await signInAs(page, {
    me: MEMBER,
    rpc: {
      leaderboard: (args) => {
        scopes.push(String(args['p_scope']));
        return { body: BOARD };
      },
    },
  });
  await page.goto('/toppliste');
  await expect(page.getByRole('list', { name: 'Pallen' })).toBeVisible();
  await page.getByRole('button', { name: 'Denne uken' }).click();
  await expect.poll(() => scopes).toContain('week');
});

test('delete me removes the account and leaves for the sign-in page', async ({ page }) => {
  let deleted = false;
  await signInAs(page, {
    me: MEMBER,
    functions: {
      'delete-account': () => {
        deleted = true;
        return { status: 200, body: {} };
      },
    },
  });
  await page.goto('/meg');
  await page.getByRole('button', { name: 'Slett meg' }).click();
  const confirm = page.getByRole('button', { name: 'Slett alt' });
  await expect(confirm).toBeDisabled();
  await page.getByLabel('Skriv SLETT for å bekrefte').fill('SLETT');
  await confirm.click();
  await expect(page).toHaveURL(/\/logg-inn$/);
  await expect(page.getByText('Kontoen din er slettet')).toBeVisible();
  expect(deleted).toBe(true);
});

test('the privacy page is public', async ({ page }) => {
  await page.goto('/personvern');
  await expect(page.getByRole('heading', { name: 'Personvern', level: 1 })).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

for (const [story, size] of [
  ['gaarden', { width: 390, height: 844 }],
  ['laaven', { width: 390, height: 844 }],
  ['gaarden', { width: 1280, height: 900 }],
] as const) {
  test(`the portrait picker in ${story} at ${String(size.width)} px`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.addInitScript((value) => {
      window.localStorage.setItem('nisse-theme', value);
    }, story);
    const sent: unknown[] = [];
    await signInAs(page, {
      me: { ...MEMBER, story, portrait: 'musa' },
      rpc: {
        set_portrait: (args) => {
          sent.push(args);
          return { body: null };
        },
      },
    });
    await page.goto('/meg');
    await page.getByRole('button', { name: 'Bytt portrett' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('radio', { name: 'Låvemusa', exact: true })).toBeChecked();
    await dialog.getByRole('radio', { name: 'Fjøskatten', exact: true }).check();
    await expect(dialog.locator('.n-portrait-preview')).toHaveText('Fjøskatten');
    // the chosen portrait is shown large, not as a thumbnail
    const preview = await dialog.locator('.n-portrait-preview .n-avatar').boundingBox();
    expect(preview?.width).toBeGreaterThanOrEqual(200);
    // every portrait has its image
    const broken = await page.evaluate(async () => {
      const urls = [...document.querySelectorAll('dialog image')].map(
        (el) => el.getAttribute('href') ?? '',
      );
      const codes = await Promise.all(urls.map((url) => fetch(url).then((r) => r.status)));
      return urls.filter((_, i) => codes[i] !== 200);
    });
    expect(broken).toEqual([]);
    await page.waitForTimeout(300);
    await page.screenshot({
      path: `screenshots/portraits-${story}-${String(size.width)}.png`,
      fullPage: true,
    });
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(results.violations.map((v) => v.id)).toEqual([]);
    await dialog.getByRole('button', { name: 'Bruk dette' }).click();
    await expect.poll(() => sent).toEqual([{ p_portrait: 'fjoskatten' }]);
  });
}
