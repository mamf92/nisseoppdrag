import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { MEMBER, raise, signInAs } from './mock-supabase';

const ADMIN = { ...MEMBER, role: 'admin' };

const CHALLENGE = {
  id: 'c1',
  workplace_id: 'w1',
  category: 'social',
  title_nb: 'Si hei til en kollega',
  title_en: 'Say hi to a colleague',
  body_nb: 'Ta en prat ved kaffemaskinen.',
  body_en: 'Have a chat by the coffee machine.',
  difficulty: 1,
  points: 10,
  is_active: true,
  archived_at: null,
  created_by: null,
  created_at: '2026-10-20T10:00:00Z',
  updated_at: '2026-10-20T10:00:00Z',
};

const MEMBERS = [
  {
    id: 'm1',
    nisse_name: 'Grøtnissen',
    farmer_name: null,
    story: 'gaarden',
    role: 'admin',
    joined_at: '2026-10-20T10:00:00Z',
  },
  {
    id: 'm2',
    nisse_name: 'Fjøsnissen',
    farmer_name: null,
    story: 'gaarden',
    role: 'player',
    joined_at: '2026-10-21T10:00:00Z',
  },
];

const STATS = {
  members: 2,
  active_this_week: 1,
  skips: 0,
  rerolls: 1,
  by_category: { social: 1 },
  catalog_low: ['learning'],
};

const SIZES = [
  { width: 390, height: 844 },
  { width: 1280, height: 900 },
] as const;

function mocks(writes?: { method: string; table: string; body: unknown }[]) {
  return {
    me: ADMIN,
    rpc: {
      admin_stats: () => ({ body: STATS }),
      admin_create_invite: () => ({ body: 'ABCDE12345' }),
      admin_upsert_season: () => ({ body: 's1' }),
      admin_adjust_points: () => raise('forbidden'),
    },
    tables: {
      challenges: [CHALLENGE],
      members: MEMBERS,
      seasons: [],
      invites: [],
      audit_log: [{ id: 1, action: 'points.adjust', target: 'm2:-10', at: '2026-10-25T09:00:00Z' }],
    },
    writes,
  };
}

for (const story of ['gaarden', 'laaven'] as const) {
  for (const size of SIZES) {
    test(`every office page fits and has no axe violations in ${story} at ${String(size.width)} px`, async ({
      page,
    }) => {
      await page.setViewportSize(size);
      await page.addInitScript((value) => {
        window.localStorage.setItem('nisse-theme', value);
      }, story);
      await signInAs(page, mocks());
      for (const [path, heading] of [
        ['/kontor', 'Nissefars kontor'],
        ['/kontor/oppdrag', 'Nissefars kontor'],
        ['/kontor/sesong', 'Nissefars kontor'],
        ['/kontor/nisser', 'Nissefars kontor'],
        ['/kontor/poeng', 'Nissefars kontor'],
        ['/kontor/logg', 'Nissefars kontor'],
      ] as const) {
        await page.goto(path);
        await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible();
        await expect(page.getByText('Laster …')).toHaveCount(0);
        await page.evaluate(() => document.fonts.ready);
        await page.screenshot({
          path: `screenshots/kontor${path.slice(7).replace('/', '-') || '-oversikt'}-${story}-${String(size.width)}.png`,
          fullPage: true,
        });
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, path).toBeLessThanOrEqual(0);
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();
        expect(results.violations.map((v) => `${path}: ${v.id}`)).toEqual([]);
      }
    });
  }
}

test('a player who opens the office is sent home', async ({ page }) => {
  await signInAs(page, {
    ...mocks(),
    me: MEMBER,
    rpc: { ensure_my_week: () => ({ body: { state: 'no_active_week' } }) },
  });
  await page.goto('/kontor');
  await expect(page).toHaveURL(/127\.0\.0\.1:4173\/$/);
  await expect(page.getByRole('heading', { name: 'Nissefars kontor' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Kontoret' })).toHaveCount(0);
});

test('a new mission: validation, live preview in both themes and languages, then saved', async ({
  page,
}) => {
  const writes: { method: string; table: string; body: unknown }[] = [];
  await signInAs(page, mocks(writes));
  await page.goto('/kontor/oppdrag');
  await page.getByRole('button', { name: 'Nytt oppdrag' }).click();

  const sheet = page.getByRole('dialog');
  await sheet.getByRole('button', { name: 'Lagre' }).click();
  await expect(sheet.getByText('Tittelen må være 3 til 80 tegn.').first()).toBeVisible();
  expect(writes).toEqual([]);

  await sheet.getByLabel('Tittel (norsk)').fill('Del en julesang');
  await sheet.getByLabel('Tittel (engelsk)').fill('Share a Christmas song');
  const gaarden = sheet.getByTestId('preview-gaarden');
  const laaven = sheet.getByTestId('preview-laaven');
  await expect(gaarden.getByText('Del en julesang')).toBeVisible();
  await expect(laaven.getByText('Del en julesang')).toBeVisible();
  await sheet.getByRole('button', { name: 'English' }).click();
  await expect(gaarden.getByText('Share a Christmas song')).toBeVisible();
  await expect(laaven.getByText('Share a Christmas song')).toBeVisible();

  await sheet.getByLabel('Vanskelighetsgrad', { exact: true }).selectOption('3');
  await expect(sheet.getByLabel('Poeng', { exact: true })).toHaveValue('30');
  await sheet.getByRole('button', { name: 'Lagre' }).click();
  await expect(page.getByText('Oppdraget er lagret.')).toBeVisible();
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({
    method: 'POST',
    table: 'challenges',
    body: {
      workplace_id: 'w1',
      category: 'social',
      title_nb: 'Del en julesang',
      title_en: 'Share a Christmas song',
      difficulty: 3,
      points: 30,
    },
  });
});

test('season dates must be a Monday and a Sunday', async ({ page }) => {
  await signInAs(page, mocks());
  await page.goto('/kontor/sesong');
  await page.getByRole('button', { name: 'Ny sesong' }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByLabel('Navn').fill('Jul 2026');
  await sheet.getByLabel('Første dag', { exact: false }).fill('2026-12-01');
  await sheet.getByRole('button', { name: 'Lagre' }).click();
  await expect(sheet.getByText('Første dag må være en mandag.')).toBeVisible();
  await sheet.getByLabel('Første dag', { exact: false }).fill('2026-11-30');
  await sheet.getByLabel('Siste dag', { exact: false }).fill('2026-12-27');
  await sheet.getByRole('button', { name: 'Lagre' }).click();
  await expect(page.getByText('Sesongen er lagret.')).toBeVisible();
});

test('an invite code is shown once, with copy buttons', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await signInAs(page, mocks());
  await page.goto('/kontor/nisser');
  await page.getByRole('button', { name: 'Lag kode' }).click();
  await expect(page.getByTestId('invite-code')).toHaveText('ABCDE12345');
  await page.getByRole('button', { name: 'Kopier lenke' }).click();
  await expect(page.getByText('Kopiert.')).toBeVisible();
  await page.getByRole('button', { name: 'Ferdig' }).click();
  await expect(page.getByTestId('invite-code')).toHaveCount(0);
});

test('a server refusal is shown even when the form passes', async ({ page }) => {
  await signInAs(page, mocks());
  await page.goto('/kontor/poeng');
  await page.getByLabel('Hvem').selectOption('m2');
  await page.getByLabel('Poeng (pluss eller minus)').fill('-10');
  await page.getByLabel('Begrunnelse').fill('Feil registrert');
  await page.getByRole('button', { name: 'Juster poeng' }).click();
  await expect(page.getByText('Du har ikke tilgang til dette.')).toBeVisible();
});

test('CSV import checks each row and adds only the good ones', async ({ page }) => {
  const writes: { method: string; table: string; body: unknown }[] = [];
  await signInAs(page, mocks(writes));
  await page.goto('/kontor/oppdrag');
  await page.getByRole('button', { name: 'Importer fra CSV' }).click();
  await page.getByLabel('CSV-fil').setInputFiles({
    name: 'oppdrag.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      [
        'category,title_nb,title_en,body_nb,body_en,difficulty,points',
        'social,Si hei,Say hi,,,1,10',
        'nonsense,Feil,Wrong,,,1,10',
        'learning,Lær noe nytt,Learn something new,,,2,',
      ].join('\n'),
    ),
  });
  await expect(page.getByText('2 rader er i orden, 1 har feil.')).toBeVisible();
  await expect(page.getByText('Linje 3')).toBeVisible();
  await page.getByRole('button', { name: 'Importer 2 oppdrag' }).click();
  await expect(page.getByText('2 oppdrag er lagt til.')).toBeVisible();
  const body = writes[0]?.body as { title_nb: string; points: number }[];
  expect(body.map((r) => [r.title_nb, r.points])).toEqual([
    ['Si hei', 10],
    ['Lær noe nytt', 20],
  ]);
});
