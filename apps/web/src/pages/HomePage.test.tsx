import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MEMBER_ME, fakeClient } from '../test-auth';
import { renderWithProviders } from '../test-utils';
import { HomePage } from './HomePage';

const CATEGORIES = ['social', 'kindness', 'learning', 'collaboration', 'holiday_fun'];

function slotJson(n: number, status = 'open') {
  return {
    assignment_id: `a${String(n)}`,
    slot: n,
    status,
    points_awarded: 0,
    category: CATEGORIES[n - 1],
    title_nb: `Oppdrag ${String(n)}`,
    title_en: `Mission ${String(n)}`,
    body_nb: 'Gjør noe fint.',
    body_en: 'Do something nice.',
    points: 10,
    difficulty: 1,
  };
}

const WEEK = {
  state: 'open',
  week_start: '2026-12-07',
  closes_at: '2099-12-13T22:59:00Z',
  skip_left: true,
  reroll_left: true,
  slots: [1, 2, 3, 4, 5].map((n) => slotJson(n)),
};

function setup(rpc: Parameters<typeof fakeClient>[0] = {}) {
  const fake = fakeClient({ session: true, me: MEMBER_ME, ...rpc });
  const view = renderWithProviders(<HomePage />, { client: fake.client });
  return { ...fake, ...view };
}

function card(title: string) {
  return screen.getByRole('article', { name: title });
}

describe('HomePage', () => {
  it('shows the five missions of the week with the tokens', async () => {
    setup({ rpc: { ensure_my_week: () => ({ data: WEEK, error: null }) } });
    expect(await screen.findByRole('heading', { name: 'Oppdrag 1' })).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(5);
    expect(screen.getByText('Hopp over · 1 igjen')).toBeInTheDocument();
    expect(screen.getByText('Rist sekken · 1 igjen')).toBeInTheDocument();
    expect(screen.getByText('0 av 5 fullført')).toBeInTheDocument();
  });

  it('marks a slot the catalog left empty', async () => {
    const week = { ...WEEK, slots: [slotJson(1), slotJson(2), slotJson(3), slotJson(5)] };
    setup({ rpc: { ensure_my_week: () => ({ data: week, error: null }) } });
    expect(await screen.findByRole('heading', { name: 'Oppdrag 1' })).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(4);
    expect(screen.getByText(/Nissene fant ikke noe oppdrag/)).toBeInTheDocument();
  });

  it('explains when there is no active season', async () => {
    setup({ rpc: { ensure_my_week: () => ({ data: { state: 'no_active_week' }, error: null }) } });
    expect(await screen.findByText('Ingen sesong i gang')).toBeInTheDocument();
  });

  it('offers a retry when the week cannot be loaded', async () => {
    setup({ rpc: { ensure_my_week: () => ({ data: null, error: { message: 'boom' } }) } });
    expect(await screen.findByRole('button', { name: 'Prøv igjen' })).toBeInTheDocument();
  });

  it('completes a mission after the undo window, and undo cancels it', async () => {
    const complete = vi.fn(() => ({
      data: { points: 10, new_achievements: [] },
      error: null,
    }));
    const { calls } = setup({
      rpc: { ensure_my_week: () => ({ data: WEEK, error: null }), complete_assignment: complete },
    });
    const user = userEvent.setup();
    await screen.findByRole('heading', { name: 'Oppdrag 1' });

    await user.click(within(card('Oppdrag 1')).getByRole('button', { name: 'Fullført!' }));
    expect(screen.getByText('1 av 5 fullført')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Angre' }));
    expect(screen.getByText('0 av 5 fullført')).toBeInTheDocument();

    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      await user.click(within(card('Oppdrag 2')).getByRole('button', { name: 'Fullført!' }));
      expect(complete).not.toHaveBeenCalled();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(4100);
      });
      await waitFor(() => {
        expect(complete).toHaveBeenCalledTimes(1);
      });
      expect(calls.rpc).toHaveBeenCalledWith('complete_assignment', { p_assignment: 'a2' });
    } finally {
      vi.useRealTimers();
    }
    await waitFor(() => {
      expect(within(card('Oppdrag 2')).getByText('Fullført')).toBeInTheDocument();
    });
  });

  it('skips after one confirmation and rolls back with a toast on skip_used', async () => {
    setup({
      rpc: {
        ensure_my_week: () => ({ data: WEEK, error: null }),
        skip_assignment: () => ({ data: null, error: { message: 'skip_used' } }),
      },
    });
    const user = userEvent.setup();
    await screen.findByRole('heading', { name: 'Oppdrag 3' });
    await user.click(within(card('Oppdrag 3')).getByRole('button', { name: 'Hopp over' }));
    await user.click(screen.getByRole('button', { name: 'Ja, hopp over' }));
    expect(
      await screen.findByText('Du har allerede hoppet over et oppdrag denne uken.'),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(
        within(card('Oppdrag 3')).getByRole('button', { name: 'Fullført!' }),
      ).toBeInTheDocument();
    });
  });

  it('shows a toast when the sack has nothing else to give', async () => {
    setup({
      rpc: {
        ensure_my_week: () => ({ data: WEEK, error: null }),
        reroll_assignment: () => ({ data: null, error: { message: 'no_alternative' } }),
      },
    });
    const user = userEvent.setup();
    await screen.findByRole('heading', { name: 'Oppdrag 1' });
    await user.click(within(card('Oppdrag 1')).getByRole('button', { name: 'Rist sekken' }));
    expect(await screen.findByText('Fant ikke noe annet oppdrag å bytte til.')).toBeInTheDocument();
  });
});
