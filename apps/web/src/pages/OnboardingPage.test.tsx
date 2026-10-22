import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App';
import { fakeClient } from '../test-auth';
import { renderWithProviders } from '../test-utils';

const SIGNED_IN = { session: true } as const;

describe('onboarding', () => {
  afterEach(() => {
    window.sessionStorage.clear();
  });

  it('joins with the remembered invite code and the chosen look', async () => {
    window.sessionStorage.setItem('nisse-invite', 'ABC123');
    const user = userEvent.setup();
    const { client, calls } = fakeClient(SIGNED_IN);
    renderWithProviders(<App />, { client, route: '/onboarding' });

    const name = await screen.findByLabelText('Nissenavn');
    await user.clear(name);
    await user.type(name, 'Lykteta');
    await user.click(screen.getByRole('radio', { name: 'Blå' }));
    await user.click(screen.getByRole('radio', { name: 'Brun' }));
    await user.click(screen.getByRole('button', { name: 'Bli med' }));

    expect(calls.rpc).toHaveBeenCalledWith('redeem_invite', {
      p_code: 'ABC123',
      p_nisse_name: 'Lykteta',
      p_avatar: { cap: '#2b4a8a', beard: '#8a5a33' },
    });
    expect(await screen.findByText(/^Hei, /)).toBeInTheDocument();
    expect(window.sessionStorage.getItem('nisse-invite')).toBeNull();
  });

  it('suggests a generated name that has nothing to do with the e-mail', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, { client: fakeClient(SIGNED_IN).client, route: '/onboarding' });
    const name = await screen.findByLabelText('Nissenavn');
    expect((name as HTMLInputElement).value).toMatch(/(nissen|nissa|tufsen)$/);
    await user.click(screen.getByRole('button', { name: 'Nytt forslag' }));
    expect((name as HTMLInputElement).value).toMatch(/(nissen|nissa|tufsen)$/);
  });

  it('asks for the code when none was remembered', async () => {
    const user = userEvent.setup();
    const { client, calls } = fakeClient(SIGNED_IN);
    renderWithProviders(<App />, { client, route: '/onboarding' });
    await user.click(await screen.findByRole('button', { name: 'Bli med' }));
    expect(await screen.findByText(/Invitasjonskoden er ugyldig/)).toBeInTheDocument();
    expect(calls.rpc).not.toHaveBeenCalledWith('redeem_invite', expect.anything());
  });

  it('lets the user type a new code after the remembered one was refused', async () => {
    window.sessionStorage.setItem('nisse-invite', 'OLD');
    const user = userEvent.setup();
    const { client } = fakeClient({ ...SIGNED_IN, redeemError: { message: 'invite_invalid' } });
    renderWithProviders(<App />, { client, route: '/onboarding' });
    expect(screen.queryByLabelText('Invitasjonskode')).not.toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Bli med' }));
    expect(await screen.findByLabelText('Invitasjonskode')).toBeInTheDocument();
    expect(window.sessionStorage.getItem('nisse-invite')).toBeNull();
  });

  it.each([
    ['invite_invalid', /Invitasjonskoden er ugyldig/],
    ['domain_not_allowed', /E-postadressen din hører ikke til/],
    ['name_taken', /Det nissenavnet er tatt/],
    ['already_member', /Du er allerede med/],
    ['something_else', /Noe gikk galt/],
  ])('maps the server error %s to copy', async (message, copy) => {
    window.sessionStorage.setItem('nisse-invite', 'ABC123');
    const user = userEvent.setup();
    const { client } = fakeClient({ ...SIGNED_IN, redeemError: { message } });
    renderWithProviders(<App />, { client, route: '/onboarding' });
    await user.click(await screen.findByRole('button', { name: 'Bli med' }));
    expect(await screen.findByText(copy)).toBeInTheDocument();
  });

  it('validates the name before asking the server', async () => {
    window.sessionStorage.setItem('nisse-invite', 'ABC123');
    const user = userEvent.setup();
    const { client, calls } = fakeClient(SIGNED_IN);
    renderWithProviders(<App />, { client, route: '/onboarding' });
    const name = await screen.findByLabelText('Nissenavn');
    await user.clear(name);
    await user.type(name, 'a@b');
    await user.click(screen.getByRole('button', { name: 'Bli med' }));
    expect(await screen.findByText(/må være mellom 2 og 32 tegn/)).toBeInTheDocument();
    expect(calls.rpc).not.toHaveBeenCalledWith('redeem_invite', expect.anything());
  });
});
