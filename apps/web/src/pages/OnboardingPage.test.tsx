import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UserEvent } from '@testing-library/user-event';
import { App } from '../App';
import { fakeClient } from '../test-auth';
import { renderWithProviders } from '../test-utils';

const SIGNED_IN = { session: true } as const;

// The link `/bli-med/:code` has already stored the code, so the flow starts at the story.
async function toNameStep(user: UserEvent) {
  await user.click(await screen.findByRole('button', { name: 'Neste' }));
  return screen.findByRole('button', { name: 'Bli med' });
}

describe('onboarding', () => {
  afterEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  it('joins with the remembered invite code, the story and a chosen name', async () => {
    window.sessionStorage.setItem('nisse-invite', 'ABC123');
    const user = userEvent.setup();
    const { client, calls } = fakeClient(SIGNED_IN);
    renderWithProviders(<App />, { client, route: '/onboarding' });

    expect(await screen.findByRole('heading', { name: 'Velg din historie' })).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: /Full låve/ }));
    await toNameStep(user);
    const name = await screen.findByLabelText('Nissenavn');
    await user.clear(name);
    await user.type(name, 'Lykteta');
    await user.click(screen.getByRole('button', { name: 'Bli med' }));

    expect(calls.rpc).toHaveBeenCalledWith('redeem_invite', {
      p_code: 'ABC123',
      p_nisse_name: 'Lykteta',
      p_avatar: {},
    });
    expect(await screen.findByText(/^Hei, /)).toBeInTheDocument();
    expect(window.sessionStorage.getItem('nisse-invite')).toBeNull();
  });

  it('asks for the group code first when none was remembered', async () => {
    const user = userEvent.setup();
    const { client } = fakeClient(SIGNED_IN);
    renderWithProviders(<App />, { client, route: '/onboarding' });
    expect(await screen.findByLabelText('Invitasjonskode')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Neste' }));
    expect(await screen.findByText(/Invitasjonskoden er ugyldig/)).toBeInTheDocument();
    await user.type(screen.getByLabelText('Invitasjonskode'), 'ABC123');
    await user.click(screen.getByRole('button', { name: 'Neste' }));
    expect(await screen.findByRole('heading', { name: 'Velg din historie' })).toBeInTheDocument();
  });

  it('suggests a name that fits the story and follows it when the story changes', async () => {
    window.sessionStorage.setItem('nisse-invite', 'ABC123');
    const user = userEvent.setup();
    renderWithProviders(<App />, { client: fakeClient(SIGNED_IN).client, route: '/onboarding' });

    await user.click(await screen.findByRole('radio', { name: /Grøt til nissen/ }));
    expect(document.documentElement.dataset['nisseTheme']).toBe('laaven');
    await toNameStep(user);
    const farmer = await screen.findByLabelText<HTMLInputElement>('Karakternavn');
    expect(farmer.value).toMatch(/^\S+ \S+$/);

    await user.click(screen.getByRole('button', { name: 'Tilbake' }));
    await user.click(screen.getByRole('radio', { name: /Full låve/ }));
    await toNameStep(user);
    const nisse = await screen.findByLabelText<HTMLInputElement>('Nissenavn');
    expect(nisse.value).toMatch(/(nissen|nissa|tufsen)$/);
    await user.click(screen.getByRole('button', { name: 'Nytt forslag' }));
    expect(nisse.value).toMatch(/(nissen|nissa|tufsen)$/);
  });

  it('sends the user back to the code step when the remembered code is refused', async () => {
    window.sessionStorage.setItem('nisse-invite', 'OLD');
    const user = userEvent.setup();
    const { client } = fakeClient({ ...SIGNED_IN, redeemError: { message: 'invite_invalid' } });
    renderWithProviders(<App />, { client, route: '/onboarding' });
    expect(screen.queryByLabelText('Invitasjonskode')).not.toBeInTheDocument();
    await toNameStep(user);
    await user.click(screen.getByRole('button', { name: 'Bli med' }));
    expect(await screen.findByLabelText('Invitasjonskode')).toBeInTheDocument();
    expect(screen.getByText(/Invitasjonskoden er ugyldig/)).toBeInTheDocument();
    expect(window.sessionStorage.getItem('nisse-invite')).toBeNull();
  });

  it.each([
    ['domain_not_allowed', /E-postadressen din hører ikke til/],
    ['name_taken', /Det nissenavnet er tatt/],
    ['already_member', /Du er allerede med/],
    ['something_else', /Noe gikk galt/],
  ])('maps the server error %s to copy', async (message, copy) => {
    window.sessionStorage.setItem('nisse-invite', 'ABC123');
    const user = userEvent.setup();
    const { client } = fakeClient({ ...SIGNED_IN, redeemError: { message } });
    renderWithProviders(<App />, { client, route: '/onboarding' });
    await toNameStep(user);
    await user.click(screen.getByRole('button', { name: 'Bli med' }));
    expect(await screen.findByText(copy)).toBeInTheDocument();
  });

  it('validates the name before asking the server', async () => {
    window.sessionStorage.setItem('nisse-invite', 'ABC123');
    const user = userEvent.setup();
    const { client, calls } = fakeClient(SIGNED_IN);
    renderWithProviders(<App />, { client, route: '/onboarding' });
    await toNameStep(user);
    const name = await screen.findByLabelText(/^(Nissenavn|Karakternavn)$/);
    await user.clear(name);
    await user.type(name, 'a@b');
    await user.click(screen.getByRole('button', { name: 'Bli med' }));
    expect(await screen.findByText(/må være mellom 2 og 32 tegn/)).toBeInTheDocument();
    expect(calls.rpc).not.toHaveBeenCalledWith('redeem_invite', expect.anything());
  });
});
