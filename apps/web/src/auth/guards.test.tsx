import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RequireAdmin, RequireMember } from './guards';
import { MEMBER_ME, fakeClient } from '../test-auth';
import { renderWithProviders } from '../test-utils';

describe('RequireAdmin', () => {
  it('hides admin pages from players', async () => {
    const { client } = fakeClient({ session: true, me: MEMBER_ME });
    renderWithProviders(
      <RequireAdmin>
        <p>Nissefars kontor</p>
      </RequireAdmin>,
      { client },
    );
    // Players are sent back to their home; nothing of the admin page is rendered.
    await waitFor(() => {
      expect(screen.queryByText('Laster …')).not.toBeInTheDocument();
    });
    expect(screen.queryByText('Nissefars kontor')).not.toBeInTheDocument();
  });

  it('shows them to workplace admins', async () => {
    const { client } = fakeClient({ session: true, me: { ...MEMBER_ME, role: 'admin' } });
    renderWithProviders(
      <RequireAdmin>
        <p>Nissefars kontor</p>
      </RequireAdmin>,
      { client },
    );
    expect(await screen.findByText('Nissefars kontor')).toBeInTheDocument();
  });
});

describe('when the membership cannot be loaded', () => {
  it('offers a retry instead of sending a member to onboarding', async () => {
    const user = userEvent.setup();
    const { client, recover } = fakeClient({
      session: true,
      me: MEMBER_ME,
      meError: { message: 'Failed to fetch' },
    });
    renderWithProviders(
      <RequireMember>
        <p>Hjem</p>
      </RequireMember>,
      { client },
    );
    expect(await screen.findByText(/Kunne ikke laste kontoen din/)).toBeInTheDocument();
    recover();
    await user.click(screen.getByRole('button', { name: 'Prøv igjen' }));
    expect(await screen.findByText('Hjem')).toBeInTheDocument();
  });
});
