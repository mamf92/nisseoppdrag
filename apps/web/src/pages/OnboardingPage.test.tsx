import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UserEvent } from '@testing-library/user-event';
import { App } from '../App';
import { FARM_NAMES } from '../auth/farmerName';
import { NAME_PREFIXES, NAME_SUFFIXES } from '../auth/nisseName';
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
      p_story: 'gaarden',
      p_name: 'Lykteta',
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

  it('shows the stories without the gate painting, one next to the other', async () => {
    window.sessionStorage.setItem('nisse-invite', 'ABC123');
    const { container } = renderWithProviders(<App />, {
      client: fakeClient(SIGNED_IN).client,
      route: '/onboarding',
    });
    expect(await screen.findByRole('heading', { name: 'Velg din historie' })).toBeInTheDocument();
    expect(container.querySelector('.n-gate')).toBeNull();
    expect(container.querySelectorAll('.n-stories .n-story')).toHaveLength(2);
  });

  it('folds the heading into a bar when the page is scrolled', async () => {
    window.sessionStorage.setItem('nisse-invite', 'ABC123');
    const { container } = renderWithProviders(<App />, {
      client: fakeClient(SIGNED_IN).client,
      route: '/onboarding',
    });
    await screen.findByRole('heading', { name: 'Velg din historie' });
    const head = container.querySelector('.n-storyhead');
    expect(head).not.toHaveAttribute('data-compact');
    Object.defineProperty(window, 'scrollY', { value: 200, configurable: true });
    fireEvent.scroll(window);
    await waitFor(() => {
      expect(head).toHaveAttribute('data-compact', 'true');
    });
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
  });

  it('suggests a free farm name in Låven that can be changed from the lists', async () => {
    window.sessionStorage.setItem('nisse-invite', 'ABC123');
    const user = userEvent.setup();
    const { client, calls } = fakeClient(SIGNED_IN);
    renderWithProviders(<App />, { client, route: '/onboarding' });

    await user.click(await screen.findByRole('radio', { name: /Grøt til nissen/ }));
    expect(document.documentElement.dataset['nisseTheme']).toBe('laaven');
    await toNameStep(user);
    expect(calls.rpc).toHaveBeenCalledWith('taken_names', { p_code: 'ABC123' });
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    // There is no gender choice, and the lists are hidden until "Bytt?" is pressed.
    expect(screen.queryByRole('button', { name: 'Kvinnenavn' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Fornavn')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Bytt?' }));
    await user.selectOptions(screen.getByLabelText('Fornavn'), 'Sigrid');
    await user.selectOptions(screen.getByLabelText('Gårdsnavn'), 'Vik');
    expect(screen.getByText('Sigrid Vik')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Bli med' }));
    expect(calls.rpc).toHaveBeenCalledWith('redeem_invite', {
      p_code: 'ABC123',
      p_story: 'laaven',
      p_name: 'Sigrid Vik',
    });
  });

  it('keeps taken farm names off the lists and out of the shuffle', async () => {
    window.sessionStorage.setItem('nisse-invite', 'ABC123');
    const user = userEvent.setup();
    const taken = FARM_NAMES.map((farm) => `ivar ${farm.toLowerCase()}`).filter(
      (name) => name !== 'ivar ruud',
    );
    taken.push('ola ruud');
    const { client } = fakeClient({ ...SIGNED_IN, taken });
    renderWithProviders(<App />, { client, route: '/onboarding' });
    await user.click(await screen.findByRole('radio', { name: /Grøt til nissen/ }));
    await toNameStep(user);
    await user.click(screen.getByRole('button', { name: 'Bytt?' }));

    // Only Ruud is left for Ivar; Ola Ruud is gone from Ola's farm names.
    await user.selectOptions(screen.getByLabelText('Fornavn'), 'Ivar');
    expect(within(screen.getByLabelText('Gårdsnavn')).getAllByRole('option')).toHaveLength(1);
    expect(screen.getByText('Ivar Ruud')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Fornavn'), 'Ola');
    expect(screen.queryByRole('option', { name: 'Ruud' })).not.toBeInTheDocument();

    // The shuffle never lands on a taken name.
    for (let i = 0; i < 15; i++) {
      await user.click(screen.getByRole('button', { name: 'Overrask meg!' }));
      const shown = screen.getByLabelText<HTMLSelectElement>('Fornavn');
      const farm = screen.getByLabelText<HTMLSelectElement>('Gårdsnavn');
      expect(taken).not.toContain(`${shown.value} ${farm.value}`.toLowerCase());
    }
  });

  it('suggests a nisse name in Gården that nobody has, and offers a new one', async () => {
    window.sessionStorage.setItem('nisse-invite', 'ABC123');
    const user = userEvent.setup();
    const all = NAME_PREFIXES.flatMap((p) => NAME_SUFFIXES.map((s) => `${p}${s}`.toLowerCase()));
    const left = 'lyktenissa';
    const { client } = fakeClient({ ...SIGNED_IN, taken: all.filter((n) => n !== left) });
    renderWithProviders(<App />, { client, route: '/onboarding' });
    await user.click(await screen.findByRole('radio', { name: /Full låve/ }));
    await toNameStep(user);
    const nisse = await screen.findByLabelText<HTMLInputElement>('Nissenavn');
    expect(nisse.value).toBe('Lyktenissa');
    await user.click(screen.getByRole('button', { name: 'Nytt forslag' }));
    expect(nisse.value).toBe('Lyktenissa');
  });

  it('refuses a nisse name that is taken before asking the server', async () => {
    window.sessionStorage.setItem('nisse-invite', 'ABC123');
    const user = userEvent.setup();
    const { client, calls } = fakeClient({ ...SIGNED_IN, taken: ['lykteta'] });
    renderWithProviders(<App />, { client, route: '/onboarding' });
    await user.click(await screen.findByRole('radio', { name: /Full låve/ }));
    await toNameStep(user);
    const name = await screen.findByLabelText('Nissenavn');
    await user.clear(name);
    await user.type(name, 'LYKTETA');
    await user.click(screen.getByRole('button', { name: 'Bli med' }));
    expect(await screen.findByText(/Det navnet er tatt/)).toBeInTheDocument();
    expect(calls.rpc).not.toHaveBeenCalledWith('redeem_invite', expect.anything());
  });

  it('moves to a free name when the server says the chosen one was just taken', async () => {
    window.sessionStorage.setItem('nisse-invite', 'ABC123');
    const user = userEvent.setup();
    const { client, calls } = fakeClient({ ...SIGNED_IN, redeemError: { message: 'name_taken' } });
    renderWithProviders(<App />, { client, route: '/onboarding' });
    await user.click(await screen.findByRole('radio', { name: /Grøt til nissen/ }));
    await toNameStep(user);
    await user.click(screen.getByRole('button', { name: 'Bli med' }));
    expect(await screen.findByText(/Det navnet er tatt/)).toBeInTheDocument();
    // The list was fetched again to find a free name.
    expect(calls.rpc.mock.calls.filter(([name]) => name === 'taken_names')).toHaveLength(2);
  });

  it('goes back to the code step when the code is refused while looking up names', async () => {
    window.sessionStorage.setItem('nisse-invite', 'OLD');
    const user = userEvent.setup();
    const { client } = fakeClient({ ...SIGNED_IN, takenError: { message: 'invite_invalid' } });
    renderWithProviders(<App />, { client, route: '/onboarding' });
    await user.click(await screen.findByRole('button', { name: 'Neste' }));
    expect(await screen.findByLabelText('Invitasjonskode')).toBeInTheDocument();
    expect(screen.getByText(/Invitasjonskoden er ugyldig/)).toBeInTheDocument();
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
    ['name_taken', /Det navnet er tatt/],
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
    const name = await screen.findByLabelText('Nissenavn');
    await user.clear(name);
    await user.type(name, 'a@b');
    await user.click(screen.getByRole('button', { name: 'Bli med' }));
    expect(await screen.findByText(/må være mellom 2 og 32 tegn/)).toBeInTheDocument();
    expect(calls.rpc).not.toHaveBeenCalledWith('redeem_invite', expect.anything());
  });
});
