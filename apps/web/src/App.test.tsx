import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import { MEMBER_ME, fakeClient } from './test-auth';
import { renderWithProviders } from './test-utils';

describe('routing and guards', () => {
  afterEach(() => {
    window.sessionStorage.clear();
  });

  it('sends a signed-out visitor to the sign-in page', async () => {
    renderWithProviders(<App />, { client: fakeClient().client });
    expect(await screen.findByRole('heading', { name: 'Logg inn' })).toBeInTheDocument();
  });

  it('shows the English copy when English is chosen', async () => {
    renderWithProviders(<App />, { client: fakeClient().client, lang: 'en' });
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('shows the home page to a member', async () => {
    const { client } = fakeClient({ session: true, me: MEMBER_ME });
    renderWithProviders(<App />, { client });
    expect(await screen.findByText('Hei, Grøtnissen!')).toBeInTheDocument();
    expect(screen.getByText('Firma AS')).toBeInTheDocument();
  });

  it('sends a signed-in user without a workplace to onboarding', async () => {
    const { client } = fakeClient({ session: true });
    renderWithProviders(<App />, { client });
    expect(await screen.findByRole('heading', { name: 'Velg nissenavn' })).toBeInTheDocument();
  });

  it('keeps a member out of onboarding', async () => {
    const { client } = fakeClient({ session: true, me: MEMBER_ME });
    renderWithProviders(<App />, { client, route: '/onboarding' });
    expect(await screen.findByText('Hei, Grøtnissen!')).toBeInTheDocument();
  });

  it('remembers the invite code from /bli-med and goes to sign-in', async () => {
    renderWithProviders(<App />, { client: fakeClient().client, route: '/bli-med/ABC123' });
    expect(await screen.findByRole('heading', { name: 'Logg inn' })).toBeInTheDocument();
    expect(window.sessionStorage.getItem('nisse-invite')).toBe('ABC123');
  });

  it('signs out from the home page', async () => {
    const user = userEvent.setup();
    const { client, calls } = fakeClient({ session: true, me: MEMBER_ME });
    renderWithProviders(<App />, { client });
    await user.click(await screen.findByRole('button', { name: 'Logg ut' }));
    expect(await screen.findByRole('heading', { name: 'Logg inn' })).toBeInTheDocument();
    expect(calls.signOut).toHaveBeenCalled();
  });
});
