import { Route, Routes } from 'react-router-dom';

function Home() {
  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="font-display text-3xl">Nisseoppdrag</h1>
      <p className="mt-2">Nissene gjør seg klare. Snart kan du ta oppdrag!</p>
    </main>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="*" element={<Home />} />
    </Routes>
  );
}
