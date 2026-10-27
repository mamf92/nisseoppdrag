import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { MEMBER, signInAs } from './mock-supabase';

const ACHIEVEMENTS = [
  ['first_spoon', 'Første grøtskje', 'Fullfør ditt første oppdrag.', 10],
  ['full_barn', 'Full låve', 'Fullfør alle fem oppdrag i én uke.', 20],
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

async function openBadges(page: Page, story: 'gaarden' | 'laaven') {
  await page.addInitScript((value) => {
    window.localStorage.setItem('nisse-theme', value);
  }, story);
  await signInAs(page, {
    me: { ...MEMBER, story },
    tables: {
      achievements: ACHIEVEMENTS,
      member_achievements: [
        { achievement_code: 'first_spoon', unlocked_at: '2026-12-01T10:00:00Z' },
      ],
    },
  });
  await page.goto('/merker');
}

for (const story of ['gaarden', 'laaven'] as const) {
  test(`a badge opens in full view and spins on a phone in ${story}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openBadges(page, story);
    await page.getByRole('button', { name: 'Se Første grøtskje nærmere' }).click();
    const dialog = page.getByRole('dialog', { name: 'Første grøtskje' });
    await expect(dialog).toBeVisible();
    const coin = dialog.getByRole('img', { name: 'Første grøtskje', exact: true });
    await expect(coin).toBeVisible();
    // Let the entrance spin settle, then flick the coin to the left.
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `screenshots/badge-viewer-${story}-front.png` });
    const box = await coin.boundingBox();
    if (!box) throw new Error('no coin');
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width * 0.8, y);
    await page.mouse.down();
    for (let i = 1; i <= 6; i++) await page.mouse.move(box.x + box.width * (0.8 - i * 0.1), y);
    await page.mouse.up();
    await page.waitForTimeout(150);
    await page.screenshot({ path: `screenshots/badge-viewer-${story}-spinning.png` });
    // A tap always lands on a face; tapping until the back shows the date.
    await expect(async () => {
      await dialog.getByRole('button', { name: 'Snu merket' }).click();
      await expect(dialog.getByRole('img', { name: /Låst opp 1\. desember 2026/ })).toBeVisible({
        timeout: 1500,
      });
    }).toPass({ timeout: 10_000 });
    await page.waitForTimeout(900);
    await page.screenshot({ path: `screenshots/badge-viewer-${story}-back.png` });
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(results.violations.map((v) => v.id)).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });
}

test('with reduced motion the coin turns over at once', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1280, height: 900 });
  await openBadges(page, 'gaarden');
  await page.getByRole('button', { name: 'Se Full låve nærmere' }).click();
  const dialog = page.getByRole('dialog', { name: 'Full låve' });
  await dialog.getByRole('button', { name: 'Snu merket' }).click();
  await expect(dialog.getByRole('img', { name: 'Full låve. Ikke låst opp ennå' })).toBeVisible();
  await page.screenshot({ path: 'screenshots/badge-viewer-locked-back-desktop.png' });
});

const WEEK = {
  state: 'open',
  week_start: '2026-12-07',
  closes_at: '2099-12-13T22:59:00Z',
  skip_left: true,
  reroll_left: true,
  slots: ['social', 'kindness', 'learning', 'collaboration', 'holiday_fun'].map((category, i) => ({
    assignment_id: `a${String(i + 1)}`,
    slot: i + 1,
    status: i < 2 ? 'completed' : 'open',
    points_awarded: i < 2 ? 10 : 0,
    category,
    title_nb: `Oppdrag ${String(i + 1)}`,
    title_en: `Mission ${String(i + 1)}`,
    body_nb: 'Gjør noe hyggelig for en kollega.',
    body_en: 'Do something nice for a colleague.',
    points: 10,
    difficulty: 1,
  })),
};

for (const story of ['gaarden', 'laaven'] as const) {
  test(`three quick taps on the lantern let it snow in ${story}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript((value) => {
      window.localStorage.setItem('nisse-theme', value);
    }, story);
    await signInAs(page, {
      me: { ...MEMBER, story },
      rpc: { ensure_my_week: () => ({ body: WEEK }) },
    });
    await page.goto('/');
    const lantern = page.getByRole('img', { name: '2 av 5 fullført' });
    await expect(lantern).toBeVisible();
    // A hatch reacts to a tap without becoming a control.
    await page.getByRole('listitem', { name: /Luke 1/ }).click();
    await expect(page.locator('.n-snow')).toHaveCount(0);
    for (let i = 0; i < 3; i++) await lantern.click();
    await expect(page.locator('.n-snow')).toBeVisible();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `screenshots/snow-${story}.png` });
  });
}

test('no snow with reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await signInAs(page, { me: MEMBER, rpc: { ensure_my_week: () => ({ body: WEEK }) } });
  await page.goto('/');
  const lantern = page.getByRole('img', { name: '2 av 5 fullført' });
  for (let i = 0; i < 3; i++) await lantern.click();
  await page.waitForTimeout(300);
  await expect(page.locator('.n-snow')).toHaveCount(0);
});
