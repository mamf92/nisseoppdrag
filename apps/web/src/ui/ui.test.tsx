import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { renderWithProviders } from '../test-utils';
import {
  AppNav,
  Badge,
  Button,
  Hatches,
  Lantern,
  LanguageSwitch,
  LeaderboardRow,
  MissionCard,
  Sheet,
  TextField,
  ThemeSwitch,
  TokenChip,
  useToast,
} from '.';

describe('Button', () => {
  it('is a real button that does not submit forms by default', () => {
    renderWithProviders(<Button>Gå</Button>);
    expect(screen.getByRole('button', { name: 'Gå' })).toHaveAttribute('type', 'button');
  });
});

describe('MissionCard', () => {
  const base = {
    category: 'social',
    title: 'Ta en pause',
    points: 20,
    difficulty: 2,
  } as const;

  it('offers complete, skip and reroll while open', async () => {
    const onComplete = vi.fn();
    const onSkip = vi.fn();
    const onReroll = vi.fn();
    renderWithProviders(
      <MissionCard
        {...base}
        status="open"
        onComplete={onComplete}
        onSkip={onSkip}
        onReroll={onReroll}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Fullført!' }));
    await userEvent.click(screen.getByRole('button', { name: 'Hopp over' }));
    await userEvent.click(screen.getByRole('button', { name: 'Rist sekken' }));
    expect(onComplete).toHaveBeenCalledOnce();
    expect(onSkip).toHaveBeenCalledOnce();
    expect(onReroll).toHaveBeenCalledOnce();
  });

  it('disables skip and reroll when their token is spent, and everything while busy', () => {
    const { rerender } = renderWithProviders(
      <MissionCard {...base} status="open" skipDisabled rerollDisabled />,
    );
    expect(screen.getByRole('button', { name: 'Fullført!' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Hopp over' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Rist sekken' })).toBeDisabled();
    rerender(<MissionCard {...base} status="open" busy />);
    expect(screen.getByRole('button', { name: 'Fullført!' })).toBeDisabled();
  });

  it('shows a stamp instead of buttons once done or skipped', () => {
    const { rerender } = renderWithProviders(<MissionCard {...base} status="done" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('Fullført')).toBeInTheDocument();
    rerender(<MissionCard {...base} status="skipped" />);
    expect(screen.getByText('Hoppet over')).toBeInTheDocument();
  });

  it('describes difficulty and points to assistive technology', () => {
    renderWithProviders(<MissionCard {...base} status="open" />);
    expect(screen.getByRole('img', { name: 'Vanskelighetsgrad 2 av 3' })).toBeInTheDocument();
    expect(screen.getByText('20 p')).toBeInTheDocument();
  });

  it('plays the sack animation only when asked to', () => {
    const { container, rerender } = renderWithProviders(<MissionCard {...base} status="open" />);
    expect(container.querySelector('.n-mission--shake')).toBeNull();
    rerender(<MissionCard {...base} status="open" shake />);
    expect(container.querySelector('.n-mission--shake')).not.toBeNull();
  });

  it('is named by its title', () => {
    renderWithProviders(<MissionCard {...base} status="open" />);
    expect(screen.getByRole('article', { name: 'Ta en pause' })).toBeInTheDocument();
  });
});

describe('Hatches', () => {
  const states = ['done', 'done', 'open', 'closed', 'skipped'] as const;

  it('labels every hatch with its state and category', () => {
    renderWithProviders(<Hatches states={states} />);
    const list = screen.getByRole('list', { name: 'Ukens fem luker' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(5);
    expect(items[2]).toHaveAccessibleName('Luke 3, åpen i dag, Læring');
    expect(items[3]).toHaveAccessibleName('Luke 4, lukket, Samarbeid');
    expect(items[4]).toHaveAccessibleName('Luke 5, hoppet over, Julemoro');
  });

  it('brings ingredients in Låven', () => {
    renderWithProviders(<Hatches states={states} />, { theme: 'laaven' });
    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveAccessibleName('Luke 1, fullført, Sosialt, Melk');
    expect(items[1]).toHaveAccessibleName('Luke 2, fullført, Vennlighet, Smør');
  });

  it('brings the family home in Gården', () => {
    const { container } = renderWithProviders(<Hatches states={states} />, { theme: 'gaarden' });
    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveAccessibleName('Luke 1, fullført, Sosialt, Lyktenissen');
    expect(container.querySelectorAll('.n-hatch--portrait')).toHaveLength(2);
  });

  it('lets a prop override the theme', () => {
    renderWithProviders(<Hatches states={states} theme="laaven" />, { theme: 'gaarden' });
    expect(screen.getAllByRole('listitem')[0]).toHaveAccessibleName(
      'Luke 1, fullført, Sosialt, Melk',
    );
  });

  it('treats missing states as closed', () => {
    renderWithProviders(<Hatches states={[]} />);
    expect(screen.getAllByRole('listitem')[0]).toHaveAccessibleName('Luke 1, lukket, Sosialt');
  });
});

describe('Lantern and chips', () => {
  it('reads out the progress', () => {
    renderWithProviders(<Lantern done={3} />);
    expect(screen.getByRole('img', { name: '3 av 5 fullført' })).toBeInTheDocument();
  });

  it('never lights more than five panes or fewer than none', () => {
    const { container, rerender } = renderWithProviders(<Lantern done={9} />);
    expect(container.querySelectorAll('.n-pane--lit')).toHaveLength(5);
    rerender(<Lantern done={-1} />);
    expect(container.querySelectorAll('.n-pane--lit')).toHaveLength(0);
  });

  it('shows how many tokens are left, and when they are used', () => {
    const { rerender } = renderWithProviders(<TokenChip kind="skip" left={1} />);
    expect(screen.getByText('Hopp over · 1 igjen')).toBeInTheDocument();
    rerender(<TokenChip kind="reroll" left={0} />);
    expect(screen.getByText('Rist sekken · brukt')).toBeInTheDocument();
  });
});

describe('LeaderboardRow', () => {
  it('marks the signed-in player', () => {
    renderWithProviders(
      <ul>
        <LeaderboardRow rank={2} name="Lyktenissen" points={298} me />
        <LeaderboardRow rank={1} name="Fjøsnissen" points={312} />
      </ul>,
    );
    const rows = screen.getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('Lyktenissen (deg)');
    expect(rows[0]).toHaveAttribute('aria-current', 'true');
    expect(rows[1]).not.toHaveAttribute('aria-current');
    expect(screen.getByLabelText('Plass 2')).toBeInTheDocument();
  });

  it('only accepts plain hex colours for the avatar', () => {
    const { container } = renderWithProviders(
      <ul>
        <LeaderboardRow
          rank={1}
          name="X"
          points={1}
          look={{ cap: 'red; background: url(x)', beard: '#ffffff' }}
        />
      </ul>,
    );
    const avatar = container.querySelector<HTMLElement>('.n-avatar');
    expect(avatar?.style.getPropertyValue('--nisse-cap')).toBe('');
    expect(avatar?.style.getPropertyValue('--nisse-beard')).toBe('#ffffff');
  });
});

describe('Badge', () => {
  it('hides the name of a secret badge', () => {
    renderWithProviders(<Badge file="L-2C-shaken_sack" name="Ristet sekk" state="secret" />);
    expect(screen.queryByText('Ristet sekk')).not.toBeInTheDocument();
    expect(screen.getByText('Hemmelig')).toBeInTheDocument();
  });

  it('says so when a badge is locked, and when it is new', () => {
    const { rerender } = renderWithProviders(
      <Badge file="L-2B-chief_nisse" name="Overnissen" state="locked" />,
    );
    expect(screen.getByText('(Låst)')).toBeInTheDocument();
    rerender(<Badge file="L-21-full_barn" name="Full låve" isNew />);
    expect(screen.getByText('Ny!')).toBeInTheDocument();
  });
});

describe('Toast', () => {
  it('has its live regions before anything is announced', () => {
    renderWithProviders(<div />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  function Trigger() {
    const toast = useToast();
    return (
      <>
        <button
          type="button"
          onClick={() => {
            toast.show('Lagret');
          }}
        >
          ok
        </button>
        <button
          type="button"
          onClick={() => {
            toast.show('Brukt opp denne uka', 'error');
          }}
        >
          feil
        </button>
      </>
    );
  }

  it('announces information politely and errors assertively', async () => {
    renderWithProviders(<Trigger />);
    await userEvent.click(screen.getByRole('button', { name: 'ok' }));
    await userEvent.click(screen.getByRole('button', { name: 'feil' }));
    expect(within(screen.getByRole('status')).getByText('Lagret')).toBeInTheDocument();
    expect(within(screen.getByRole('alert')).getByText('Brukt opp denne uka')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive');
  });

  it('closes on request and by itself', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      renderWithProviders(<Trigger />);
      await userEvent.click(screen.getByRole('button', { name: 'ok' }));
      await userEvent.click(screen.getByRole('button', { name: 'Lukk' }));
      expect(screen.queryByText('Lagret')).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'ok' }));
      act(() => {
        vi.advanceTimersByTime(5100);
      });
      expect(screen.queryByText('Lagret')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('refuses to be used without its provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    function Bare() {
      useToast();
      return null;
    }
    expect(() => render(<Bare />)).toThrow('useToast must be used inside ToastProvider');
    spy.mockRestore();
  });
});

describe('Sheet', () => {
  it('shows its title and closes with the button', async () => {
    const onClose = vi.fn();
    renderWithProviders(
      <Sheet open title="Nytt oppdrag" onClose={onClose}>
        <p>Innhold</p>
      </Sheet>,
    );
    expect(screen.getByRole('dialog', { name: 'Nytt oppdrag' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Lukk' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('renders nothing inside while closed', () => {
    renderWithProviders(
      <Sheet open={false} title="Nytt oppdrag" onClose={() => undefined}>
        <p>Innhold</p>
      </Sheet>,
    );
    expect(screen.queryByText('Innhold')).not.toBeInTheDocument();
  });
});

describe('TextField', () => {
  it('connects label, hint and error to the input', () => {
    renderWithProviders(
      <TextField label="Nissenavn" hint="Ikke ditt eget navn" error="Navnet er tatt" />,
    );
    const input = screen.getByLabelText('Nissenavn');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Ikke ditt eget navn Navnet er tatt');
  });

  it('is valid and undescribed without hint or error', () => {
    renderWithProviders(<TextField label="Nissenavn" />);
    const input = screen.getByLabelText('Nissenavn');
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).not.toHaveAttribute('aria-describedby');
  });
});

describe('AppNav', () => {
  it('marks the current page', () => {
    renderWithProviders(<AppNav />, { route: '/toppliste' });
    const nav = screen.getByRole('navigation', { name: 'Hovedmeny' });
    expect(within(nav).getByRole('link', { name: 'Toppliste' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: 'Oppdrag' })).not.toHaveAttribute('aria-current');
  });

  it('follows the language', async () => {
    renderWithProviders(
      <>
        <LanguageSwitch />
        <AppNav />
      </>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'English' }));
    expect(screen.getByRole('link', { name: 'Missions' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('en');
    expect(window.localStorage.getItem('nisse-lang')).toBe('en');
  });
});

describe('ThemeSwitch', () => {
  it('switches the theme on <html> and remembers it', async () => {
    renderWithProviders(<ThemeSwitch />, { theme: 'gaarden' });
    expect(document.documentElement.dataset['nisseTheme']).toBe('gaarden');
    await userEvent.click(screen.getByRole('button', { name: 'Låven' }));
    expect(document.documentElement.dataset['nisseTheme']).toBe('laaven');
    expect(window.localStorage.getItem('nisse-theme')).toBe('laaven');
    expect(screen.getByRole('button', { name: 'Låven' })).toHaveAttribute('aria-pressed', 'true');
  });
});
