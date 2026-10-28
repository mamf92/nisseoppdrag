import { fireEvent, screen } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { renderWithProviders } from '../test-utils';
import { BadgeViewer } from './BadgeViewer';
import { eyesChance } from './Eyes';

const BADGE = {
  file: 'L-20-first_spoon',
  name: 'Første grøtskje',
  how: 'Fullfør ditt første oppdrag.',
  bonusPoints: 5,
  unlockedAt: '2026-12-01T10:00:00Z',
};

function reduceMotion() {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query.includes('reduce'),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('BadgeViewer', () => {
  it('shows the coin and turns it over to the date it was won', () => {
    reduceMotion();
    renderWithProviders(<BadgeViewer badge={BADGE} origin={null} onClose={vi.fn()} />);
    expect(screen.getByRole('heading', { name: BADGE.name })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: BADGE.name })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Snu merket' }));
    expect(
      screen.getByRole('img', { name: `${BADGE.name}. Låst opp 1. desember 2026` }),
    ).toBeInTheDocument();
    expect(screen.getByText('+5 poeng')).toBeInTheDocument();
  });

  it('says a locked badge is not won yet on its back', () => {
    reduceMotion();
    renderWithProviders(
      <BadgeViewer badge={{ ...BADGE, unlockedAt: null }} origin={null} onClose={vi.fn()} />,
    );
    fireEvent.keyDown(screen.getByRole('img', { name: BADGE.name }), { key: 'ArrowRight' });
    expect(
      screen.getByRole('img', { name: `${BADGE.name}. Ikke låst opp ennå` }),
    ).toBeInTheDocument();
  });

  it('closes from its button', () => {
    const onClose = vi.fn();
    renderWithProviders(<BadgeViewer badge={BADGE} origin={null} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Lukk' }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('eyes in the dark', () => {
  it('are more likely in the small hours', () => {
    expect(eyesChance(2)).toBeGreaterThan(eyesChance(14));
    expect(eyesChance(23)).toBe(eyesChance(3));
  });
});
