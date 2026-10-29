import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App';
import { fakeClient } from '../test-auth';
import { renderWithProviders } from '../test-utils';

const SIGNED_IN = { session: true } as const;

describe('making a game', () => {
  afterEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  it('asks for a game name, a story and a name, then makes the game and opens the office', async () => {
    const user = userEvent.setup();
    const { client, calls } = fakeClient(SIGNED_IN);
    renderWithProviders(<App />, { client, route: '/lag-spill' });

    await user.type(await screen.findByLabelText('Navn på spillet'), '  Nissene AS ');
    await user.click(screen.getByRole('button', { name: 'Neste' }));
    await user.click(await screen.findByRole('radio', { name: /Full låve/ }));
    await user.click(screen.getByRole('button', { name: 'Neste' }));
    const name = await screen.findByLabelText('Nissenavn');
    await user.clear(name);
    await user.type(name, 'Lykteta');
    await user.click(screen.getByRole('button', { name: 'Bli med' }));

    expect(calls.rpc).toHaveBeenCalledWith('create_workplace', {
      p_game_name: 'Nissene AS',
      p_story: 'gaarden',
      p_member_name: 'Lykteta',
    });
    // No list of taken names is fetched for a game that does not exist yet.
    expect(calls.rpc).not.toHaveBeenCalledWith('taken_names', expect.anything());
    expect(window.sessionStorage.getItem('nisse-intent')).toBeNull();
  });

  it('refuses a game name that is too short before asking the server', async () => {
    const user = userEvent.setup();
    const { client, calls } = fakeClient(SIGNED_IN);
    renderWithProviders(<App />, { client, route: '/lag-spill' });
    await user.type(await screen.findByLabelText('Navn på spillet'), 'x');
    await user.click(screen.getByRole('button', { name: 'Neste' }));
    expect(await screen.findByText(/må være mellom 2 og 60 tegn/)).toBeInTheDocument();
    expect(calls.rpc).not.toHaveBeenCalledWith('create_workplace', expect.anything());
  });

  it('says that more places open later when all of them are taken', async () => {
    const user = userEvent.setup();
    const { client } = fakeClient({ ...SIGNED_IN, canCreate: 'full' });
    renderWithProviders(<App />, { client, route: '/lag-spill' });
    expect(
      await screen.findByRole('heading', { name: 'Alle plassene er tatt' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Flere plasser åpner senere/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Navn på spillet')).not.toBeInTheDocument();
    // Joining with a code still works.
    await user.click(screen.getByRole('button', { name: 'Jeg har en kode' }));
    expect(
      await screen.findByRole('heading', { name: 'Hvilken gruppe skal du bli med i?' }),
    ).toBeInTheDocument();
  });

  it('tells a creator at the limit, without showing the form', async () => {
    const { client } = fakeClient({ ...SIGNED_IN, canCreate: 'limit' });
    renderWithProviders(<App />, { client, route: '/lag-spill' });
    expect(
      await screen.findByRole('heading', { name: 'Du har laget nok spill' }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Navn på spillet')).not.toBeInTheDocument();
  });

  it.each([
    ['capacity_reached', /Alle plassene er tatt akkurat nå/],
    ['creator_limit', /høyeste antallet spill/],
  ])('shows the server answer %s if the room ran out meanwhile', async (message, copy) => {
    const user = userEvent.setup();
    const { client } = fakeClient({ ...SIGNED_IN, createError: { message } });
    renderWithProviders(<App />, { client, route: '/lag-spill' });
    await user.type(await screen.findByLabelText('Navn på spillet'), 'Nissene AS');
    await user.click(screen.getByRole('button', { name: 'Neste' }));
    await user.click(await screen.findByRole('radio', { name: /Full låve/ }));
    await user.click(screen.getByRole('button', { name: 'Neste' }));
    await user.click(await screen.findByRole('button', { name: 'Bli med' }));
    expect(await screen.findByText(copy)).toBeInTheDocument();
  });

  it('still opens the form when the room check itself fails; the database decides', async () => {
    const { client } = fakeClient({
      ...SIGNED_IN,
      rpc: { can_create_game: () => ({ data: null, error: { message: 'Failed to fetch' } }) },
    });
    renderWithProviders(<App />, { client, route: '/lag-spill' });
    expect(await screen.findByLabelText('Navn på spillet')).toBeInTheDocument();
  });
});
