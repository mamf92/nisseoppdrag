import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { useT } from './i18n/I18nProvider';

// The component showcase exists in `pnpm dev` and in builds made with VITE_DEV_UI=true (the
// Playwright run). It is not part of the production bundle.
const DevUi =
  import.meta.env.DEV || import.meta.env['VITE_DEV_UI'] === 'true'
    ? lazy(() => import('./pages/DevUi').then((m) => ({ default: m.DevUi })))
    : null;

function Home() {
  const t = useT();
  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-3xl font-bold">{t('app.name')}</h1>
      <p className="mt-2">{t('home.placeholder')}</p>
    </main>
  );
}

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
      <Route path="*" element={<Home />} />
    </Routes>
  );
}
