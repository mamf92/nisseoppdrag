import { screen } from '@testing-library/react';
import { App } from './App';
import { renderWithProviders } from './test-utils';

describe('App', () => {
  it('shows the heading in bokmål', () => {
    renderWithProviders(<App />);
    expect(screen.getByRole('heading', { name: 'Nisseoppdrag' })).toBeInTheDocument();
  });

  it('shows the English name when English is chosen', () => {
    renderWithProviders(<App />, { lang: 'en' });
    expect(screen.getByRole('heading', { name: 'Nisse Missions' })).toBeInTheDocument();
  });
});
