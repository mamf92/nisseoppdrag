import { createHash, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';

// Runs against a local Supabase stack (`supabase start`). CI sets E2E_SUPABASE_URL and
// E2E_SUPABASE_SERVICE_KEY from `supabase status -o env`; locally the test is skipped without them.
const url = process.env['E2E_SUPABASE_URL'];
const serviceKey = process.env['E2E_SUPABASE_SERVICE_KEY'];
const inbucket = process.env['E2E_INBUCKET_URL'] ?? 'http://127.0.0.1:54324';

test.skip(!url || !serviceKey, 'needs a local Supabase stack');

interface Message {
  id: string;
}

async function readCode(mailbox: string): Promise<string> {
  for (let attempt = 0; attempt < 30; attempt++) {
    const list = await fetch(`${inbucket}/api/v1/mailbox/${mailbox}`);
    if (list.ok) {
      const messages = (await list.json()) as Message[];
      const last = messages[messages.length - 1];
      if (last) {
        const body = (await (
          await fetch(`${inbucket}/api/v1/mailbox/${mailbox}/${last.id}`)
        ).json()) as {
          body: { text: string };
        };
        const match = /\b(\d{6})\b/.exec(body.body.text);
        if (match?.[1]) return match[1];
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('no sign-in e-mail arrived');
}

test('a new colleague signs in with a code and joins through an invite', async ({ page }) => {
  const admin = createClient(url ?? '', serviceKey ?? '');
  const slug = `e2e-${randomUUID().slice(0, 8)}`;
  const code = randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase();
  const workplace = await admin
    .from('workplaces')
    .insert({ name: 'E2E-verkstedet', slug })
    .select('id')
    .single();
  expect(workplace.error).toBeNull();
  const invite = await admin.from('invites').insert({
    workplace_id: workplace.data?.id ?? '',
    code_hash: `\\x${createHash('sha256').update(code).digest('hex')}`,
    expires_at: new Date(Date.now() + 86_400_000).toISOString(),
  });
  expect(invite.error).toBeNull();

  const mailbox = `nisse${randomUUID().slice(0, 8)}`;
  await page.goto(`/bli-med/${code}`);
  await expect(page).toHaveURL(/\/logg-inn$/);
  await page.getByLabel('E-post').fill(`${mailbox}@example.com`);
  await page.getByRole('button', { name: 'Send kode' }).click();
  await page.getByLabel('Kode').fill(await readCode(mailbox));
  await page.getByRole('button', { name: 'Logg inn' }).click();

  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByLabel('Nissenavn')).toHaveValue(/(nissen|nissa|tufsen)$/);
  await page.getByRole('button', { name: 'Bli med' }).click();
  await expect(page.getByText('E2E-verkstedet')).toBeVisible();

  await page.reload();
  await expect(page.getByText('E2E-verkstedet')).toBeVisible();
});
