import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App';
import { fakeClient } from '../test-auth';
import { renderWithProviders } from '../test-utils';

describe('sign in', () => {
  it('sends a code, then verifies it', async () => {
    const user = userEvent.setup();
    const { client, calls } = fakeClient();
    renderWithProviders(<App />, { client, route: '/logg-inn' });

    await user.type(await screen.findByLabelText('E-post'), 'nisse@firma.no');
    await user.click(screen.getByRole('button', { name: 'Send kode' }));
    expect(calls.signInWithOtp).toHaveBeenCalledWith({
      email: 'nisse@firma.no',
      options: { shouldCreateUser: true },
    });

    expect(await screen.findByText(/nisse@firma\.no/)).toBeInTheDocument();
    const submit = screen.getByRole('button', { name: 'Logg inn' });
    expect(submit).toBeDisabled();
    await user.type(screen.getByLabelText('Kode'), '12a3456');
    expect(screen.getByLabelText('Kode')).toHaveValue('123456');
    await user.click(submit);
    expect(calls.verifyOtp).toHaveBeenCalledWith({
      email: 'nisse@firma.no',
      token: '123456',
      type: 'email',
    });
    // Signed in without a workplace: onboarding is next.
    expect(await screen.findByRole('heading', { name: 'Velg nissenavn' })).toBeInTheDocument();
  });

  it('rejects an address that is not an e-mail address without calling the server', async () => {
    const user = userEvent.setup();
    const { client, calls } = fakeClient();
    renderWithProviders(<App />, { client, route: '/logg-inn' });
    await user.type(await screen.findByLabelText('E-post'), 'nisse');
    await user.click(screen.getByRole('button', { name: 'Send kode' }));
    expect(await screen.findByText('Skriv inn en gyldig e-postadresse.')).toBeInTheDocument();
    expect(calls.signInWithOtp).not.toHaveBeenCalled();
  });

  it('explains a wrong code and lets the user go back', async () => {
    const user = userEvent.setup();
    const { client } = fakeClient({
      verifyError: { message: 'Token has expired or is invalid', status: 403 },
    });
    renderWithProviders(<App />, { client, route: '/logg-inn' });
    await user.type(await screen.findByLabelText('E-post'), 'nisse@firma.no');
    await user.click(screen.getByRole('button', { name: 'Send kode' }));
    await user.type(await screen.findByLabelText('Kode'), '123456');
    await user.click(screen.getByRole('button', { name: 'Logg inn' }));
    expect(await screen.findByText(/Koden stemmer ikke eller har gått ut/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Bruk en annen e-postadresse' }));
    expect(screen.getByLabelText('E-post')).toBeInTheDocument();
  });

  it('shows the rate-limit message', async () => {
    const user = userEvent.setup();
    const { client } = fakeClient({ otpError: { message: 'rate limit', status: 429 } });
    renderWithProviders(<App />, { client, route: '/logg-inn' });
    await user.type(await screen.findByLabelText('E-post'), 'nisse@firma.no');
    await user.click(screen.getByRole('button', { name: 'Send kode' }));
    expect(await screen.findByText(/Du har bedt om mange koder/)).toBeInTheDocument();
  });
});
