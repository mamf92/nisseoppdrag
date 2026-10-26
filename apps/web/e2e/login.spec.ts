import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

// Login behaviour that does not need a real mailbox: Supabase's auth endpoints are answered by the
// test, so these run anywhere the app was built with VITE_SUPABASE_* set (CI does). The full
// round trip with a real code lives in auth.spec.ts.
test.skip(
  !process.env['VITE_SUPABASE_URL'],
  'the build needs VITE_SUPABASE_URL for the sign-in form to talk to anything',
);

const json = (status: number, body: object) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body),
});

async function askForCode(page: Page, email = 'nisse@example.com') {
  await page.goto('/logg-inn');
  await page.getByLabel('E-post').fill(email);
  await page.getByRole('button', { name: 'Send kode' }).click();
}

test('an address without a valid shape is refused before anything is sent', async ({ page }) => {
  let requests = 0;
  await page.route('**/auth/v1/otp**', async (route) => {
    requests++;
    await route.fulfill(json(200, {}));
  });
  await askForCode(page, 'ikke-en-adresse');
  await expect(page.getByText('Skriv inn en gyldig e-postadresse.')).toBeVisible();
  expect(requests).toBe(0);
});

test('a code request moves on to the code step and can be taken back', async ({ page }) => {
  await page.route('**/auth/v1/otp**', (route) => route.fulfill(json(200, {})));
  await askForCode(page);
  await expect(page.getByRole('heading', { name: 'Skriv inn koden' })).toBeVisible();
  await expect(page.getByText('nisse@example.com')).toBeVisible();
  await page.getByRole('button', { name: 'Bruk en annen e-postadresse' }).click();
  await expect(page.getByLabel('E-post')).toBeVisible();
});

test('the code field takes digits only and enables the button at six', async ({ page }) => {
  await page.route('**/auth/v1/otp**', (route) => route.fulfill(json(200, {})));
  await askForCode(page);
  const code = page.getByLabel('Kode');
  const submit = page.getByRole('button', { name: 'Logg inn' });
  await code.pressSequentially('12a34');
  await expect(code).toHaveValue('1234');
  await expect(submit).toBeDisabled();
  await code.pressSequentially('56');
  await expect(code).toHaveValue('123456');
  await expect(submit).toBeEnabled();
});

test('a wrong code explains itself and stays on the code step', async ({ page }) => {
  await page.route('**/auth/v1/otp**', (route) => route.fulfill(json(200, {})));
  await page.route('**/auth/v1/verify**', (route) =>
    route.fulfill(
      json(403, { code: 403, error_code: 'otp_expired', msg: 'Token has expired or is invalid' }),
    ),
  );
  await askForCode(page);
  await page.getByLabel('Kode').fill('000000');
  await page.getByRole('button', { name: 'Logg inn' }).click();
  await expect(page.getByText('Koden stemmer ikke eller har gått ut.')).toBeVisible();
  await expect(page).toHaveURL(/\/logg-inn$/);
});

test('rate limiting is reported in plain words', async ({ page }) => {
  await page.route('**/auth/v1/otp**', (route) =>
    route.fulfill(
      json(429, {
        code: 429,
        error_code: 'over_email_send_rate_limit',
        msg: 'email rate limit exceeded',
      }),
    ),
  );
  await askForCode(page);
  await expect(page.getByText('Du har bedt om mange koder.')).toBeVisible();
});

test('an unreachable Supabase does not leave the form stuck', async ({ page }) => {
  await page.route('**/auth/v1/otp**', (route) => route.abort('failed'));
  await askForCode(page);
  await expect(page.getByRole('button', { name: 'Send kode' })).toBeEnabled();
  await expect(page.getByText('Noe gikk galt. Prøv igjen om litt.')).toBeVisible();
});
