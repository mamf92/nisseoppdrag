import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App';
import { MEMBER_ME, fakeClient } from '../test-auth';
import { renderWithProviders } from '../test-utils';

const BOARD = [
  { member_id: 'x1', name: 'Lyktenissen', portrait: 'fjoskatten', points: 90, rank: 1 },
  { member_id: 'm1', name: 'Grøtnissen', portrait: null, points: 60, rank: 2 },
  { member_id: 'x3', name: 'Fjøsnissen', portrait: 'not-a-portrait', points: 30, rank: 3 },
  { member_id: 'x4', name: 'Snønissa', portrait: null, points: 0, rank: 4 },
];

describe('leaderboard page', () => {
  it('shows the podium, marks the player and switches period', async () => {
    const rpc = vi.fn(() => ({ data: BOARD, error: null }));
    const { client, calls } = fakeClient({
      session: true,
      me: MEMBER_ME,
      rpc: { leaderboard: rpc },
    });
    const user = userEvent.setup();
    renderWithProviders(<App />, { client, route: '/toppliste' });

    const podium = await screen.findByRole('list', { name: 'Pallen' });
    expect(within(podium).getAllByRole('listitem')).toHaveLength(3);
    expect(within(podium).getByText('Grøtnissen (deg)')).toBeInTheDocument();
    // a chosen portrait is painted; an unknown id falls back to the drawn nisse
    const avatars = podium.querySelectorAll('.n-avatar');
    expect(avatars[0]).toHaveAttribute('data-portrait', 'fjoskatten');
    expect(avatars[0]?.querySelector('image')).toHaveAttribute(
      'href',
      '/art/portraits/fjoskatten-128.webp',
    );
    expect(avatars[2]).not.toHaveAttribute('data-portrait');
    expect(calls.rpc).toHaveBeenCalledWith('leaderboard', { p_scope: 'season' });

    await user.click(screen.getByRole('button', { name: 'Denne uken' }));
    await waitFor(() => {
      expect(calls.rpc).toHaveBeenCalledWith('leaderboard', { p_scope: 'week' });
    });
  });

  it('invites the first mission when nobody has scored', async () => {
    const { client } = fakeClient({
      session: true,
      me: MEMBER_ME,
      rpc: {
        leaderboard: () => ({
          data: [{ member_id: 'm1', name: 'Grøtnissen', points: 0, rank: 1 }],
          error: null,
        }),
      },
    });
    renderWithProviders(<App />, { client, route: '/toppliste' });
    expect(await screen.findByText(/Ingen har fått poeng ennå/)).toBeInTheDocument();
  });
});

describe('badges page', () => {
  it('lists unlocked and locked badges and a secret one as a question mark', async () => {
    const { client } = fakeClient({
      session: true,
      me: MEMBER_ME,
      tables: {
        achievements: [
          {
            code: 'first_spoon',
            name_nb: 'Første grøtskje',
            name_en: 'First spoonful',
            description_nb: 'Fullfør ditt første oppdrag.',
            description_en: 'Complete your first mission.',
            bonus_points: 5,
            is_secret: false,
            sort: 10,
          },
          {
            code: 'full_barn',
            name_nb: 'Full låve',
            name_en: 'Full barn',
            description_nb: 'Fullfør alle fem oppdrag i én uke.',
            description_en: 'Complete all five missions in one week.',
            bonus_points: 10,
            is_secret: false,
            sort: 20,
          },
        ],
        member_achievements: [
          { achievement_code: 'first_spoon', unlocked_at: '2026-12-01T10:00:00Z' },
        ],
      },
    });
    renderWithProviders(<App />, { client, route: '/merker' });
    expect(await screen.findByText('1 av 2 låst opp')).toBeInTheDocument();
    expect(screen.getByText('Første grøtskje')).toBeInTheDocument();
    expect(screen.getByText('Full låve')).toBeInTheDocument();
    expect(screen.getByText('(Låst)')).toBeInTheDocument();
    expect(screen.getByText('Hemmelig')).toBeInTheDocument();
  });
});

describe('profile page', () => {
  it('switches to a story the player already has a name in', async () => {
    const me = { ...MEMBER_ME, farmer_name: 'Ola Haugen' };
    const { client, calls } = fakeClient({ session: true, me });
    const user = userEvent.setup();
    renderWithProviders(<App />, { client, route: '/meg' });
    await user.click(await screen.findByRole('button', { name: 'Grøt til nissen' }));
    await waitFor(() => {
      expect(calls.rpc).toHaveBeenCalledWith('update_profile', { p_story: 'laaven' });
    });
  });

  it('asks for a name when the other story has none, then sends it', async () => {
    const { client, calls } = fakeClient({ session: true, me: MEMBER_ME });
    const user = userEvent.setup();
    renderWithProviders(<App />, { client, route: '/meg' });
    await user.click(await screen.findByRole('button', { name: 'Grøt til nissen' }));
    expect(await screen.findByText('Ditt navn')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Bytt historie' }));
    await waitFor(() => {
      expect(calls.rpc).toHaveBeenCalledWith(
        'update_profile',
        expect.objectContaining({
          p_story: 'laaven',
          p_name: expect.stringMatching(/\S+ \S+/) as unknown,
        }),
      );
    });
  });

  it('shows the portrait and saves a new one from the picker', async () => {
    const { client, calls } = fakeClient({
      session: true,
      me: { ...MEMBER_ME, portrait: 'musa' },
    });
    const user = userEvent.setup();
    renderWithProviders(<App />, { client, route: '/meg' });
    const open = await screen.findByRole('button', { name: 'Bytt portrett' });
    expect(open.querySelector('.n-avatar')).toHaveAttribute('data-portrait', 'musa');
    await user.click(open);
    const use = screen.getByRole('button', { name: 'Bruk dette' });
    expect(screen.getByRole('radio', { name: 'Låvemusa' })).toBeChecked();
    expect(use).toBeDisabled();
    await user.click(screen.getByRole('radio', { name: 'Grøtnissa blunker' }));
    await user.click(use);
    await waitFor(() => {
      expect(calls.rpc).toHaveBeenCalledWith('set_portrait', { p_portrait: 'grotnissa-3' });
    });
    expect(await screen.findByText('Portrettet er byttet.')).toBeInTheDocument();
  });

  it('hides the picker until the database knows portraits', async () => {
    const { client } = fakeClient({ session: true, me: MEMBER_ME });
    renderWithProviders(<App />, { client, route: '/meg' });
    expect(await screen.findByRole('heading', { name: 'Grøtnissen' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Bytt portrett' })).not.toBeInTheDocument();
  });

  it('can go back to the drawn nisse', async () => {
    const { client, calls } = fakeClient({
      session: true,
      me: { ...MEMBER_ME, portrait: 'musa' },
    });
    const user = userEvent.setup();
    renderWithProviders(<App />, { client, route: '/meg' });
    await user.click(await screen.findByRole('button', { name: 'Bytt portrett' }));
    await user.click(screen.getByRole('radio', { name: 'Den tegnede nissen' }));
    await user.click(screen.getByRole('button', { name: 'Bruk dette' }));
    await waitFor(() => {
      expect(calls.rpc).toHaveBeenCalledWith('set_portrait', {});
    });
  });

  it('deletes the account only after the word is typed', async () => {
    const { client, calls } = fakeClient({ session: true, me: MEMBER_ME });
    const user = userEvent.setup();
    renderWithProviders(<App />, { client, route: '/meg' });
    await user.click(await screen.findByRole('button', { name: 'Slett meg' }));
    const confirm = screen.getByRole('button', { name: 'Slett alt' });
    expect(confirm).toBeDisabled();
    await user.type(screen.getByLabelText('Skriv SLETT for å bekrefte'), 'slett');
    expect(confirm).toBeEnabled();
    await user.click(confirm);
    await waitFor(() => {
      expect(calls.invoke).toHaveBeenCalledWith('delete-account', { method: 'POST' });
    });
    expect(await screen.findByRole('heading', { name: 'Logg inn' })).toBeInTheDocument();
    expect(screen.getByText('Kontoen din er slettet. Takk for at du var med!')).toBeInTheDocument();
  });
});

describe('privacy page', () => {
  it('is public and available in English', async () => {
    renderWithProviders(<App />, { client: fakeClient().client, route: '/personvern', lang: 'en' });
    expect(await screen.findByRole('heading', { name: 'Privacy' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tracking' })).toBeInTheDocument();
  });
});
