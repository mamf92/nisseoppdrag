import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { RequireMember, RequireSignedIn } from './auth/guards';
import { CreateGamePage } from './pages/CreateGamePage';
import { AppShell } from './layout/AppShell';
import { BadgesPage } from './pages/BadgesPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { ProfilePage } from './pages/ProfilePage';
import { HomePage } from './pages/HomePage';
import { JoinPage } from './pages/JoinPage';
import { LoginPage } from './pages/LoginPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { WelcomePage } from './pages/WelcomePage';

// The component showcase exists in `pnpm dev` and in builds made with VITE_DEV_UI=true (the
// Playwright run). It is not part of the production bundle.
const DevUi =
  import.meta.env.DEV || import.meta.env['VITE_DEV_UI'] === 'true'
    ? lazy(() => import('./pages/DevUi').then((m) => ({ default: m.DevUi })))
    : null;

export function App() {
  return (
    <Routes>
      {DevUi ? (
        <Route
          path="/dev/ui"
          element={
            <Suspense fallback={null}>
              <DevUi />
            </Suspense>
          }
        />
      ) : null}
      <Route path="/velkommen" element={<WelcomePage />} />
      <Route path="/personvern" element={<PrivacyPage />} />
      <Route path="/logg-inn" element={<LoginPage />} />
      <Route path="/bli-med/:code" element={<JoinPage />} />
      <Route
        path="/onboarding"
        element={
          <RequireSignedIn>
            <OnboardingPage />
          </RequireSignedIn>
        }
      />
      <Route
        path="/lag-spill"
        element={
          <RequireSignedIn>
            <CreateGamePage />
          </RequireSignedIn>
        }
      />
      <Route
        element={
          <RequireMember>
            <AppShell />
          </RequireMember>
        }
      >
        <Route index element={<HomePage />} />
        <Route path="toppliste" element={<LeaderboardPage />} />
        <Route path="merker" element={<BadgesPage />} />
        <Route path="meg" element={<ProfilePage />} />
        <Route path="*" element={<HomePage />} />
      </Route>
    </Routes>
  );
}
