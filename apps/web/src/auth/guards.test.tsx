import { screen } from '@testing-library/react';
import { RequireAdmin } from './guards';
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
    expect(await screen.findByText('Du har ikke tilgang til denne siden.')).toBeInTheDocument();
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
