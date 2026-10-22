import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { RequireMember, RequireSignedIn } from './auth/guards';
import { HomePage } from './pages/HomePage';
import { JoinPage } from './pages/JoinPage';
import { LoginPage } from './pages/LoginPage';
import { OnboardingPage } from './pages/OnboardingPage';

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
        path="*"
        element={
          <RequireMember>
            <HomePage />
          </RequireMember>
        }
      />
    </Routes>
  );
}
