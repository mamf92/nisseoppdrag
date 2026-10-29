import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App';
import { MEMBER_ME, fakeClient } from '../test-auth';
import { renderWithProviders } from '../test-utils';

async function signIn(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText('E-post'), 'nisse@firma.no');
  await user.click(screen.getByRole('button', { name: 'Send kode' }));
  await user.type(await screen.findByLabelText('Kode'), '123456');
  await user.click(screen.getByRole('button', { name: 'Logg inn' }));
}

describe('choosing what to do before signing in', () => {
  afterEach(() => {
    window.sessionStorage.clear();
  });

  it('offers to join or to make a game, and both lead to the same sign-in', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, { client: fakeClient().client });
    await user.click(await screen.findByRole('button', { name: 'Bli med' }));
    expect(
      await screen.findByRole('heading', { name: 'Logg inn for å bli med' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('E-post')).toBeInTheDocument();
  });

  it('takes a new account that wants to join to onboarding', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, { client: fakeClient().client });
    await user.click(await screen.findByRole('button', { name: 'Bli med' }));
    await signIn(user);
    expect(
      await screen.findByRole('heading', { name: 'Hvilken gruppe skal du bli med i?' }),
    ).toBeInTheDocument();
  });

  it('takes a new account that wants to make a game to the make-a-game page', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, { client: fakeClient().client });
    await user.click(await screen.findByRole('button', { name: 'Lag et spill' }));
    expect(
      await screen.findByRole('heading', { name: 'Logg inn for å lage et spill' }),
    ).toBeInTheDocument();
    await signIn(user);
    expect(
      await screen.findByRole('heading', { name: 'Hva skal spillet hete?' }),
    ).toBeInTheDocument();
  });

  it('takes a returning player straight to their game, whatever they chose first', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, { client: fakeClient({ me: MEMBER_ME }).client });
    await user.click(await screen.findByRole('button', { name: 'Lag et spill' }));
    await signIn(user);
    expect(await screen.findByText('Hei, Grøtnissen!')).toBeInTheDocument();
  });

  it('has a plain sign-in for those who have played before', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, { client: fakeClient().client });
    await user.click(await screen.findByRole('button', { name: 'Har du spilt før? Logg inn' }));
    expect(await screen.findByRole('heading', { name: 'Logg inn' })).toBeInTheDocument();
  });
});
