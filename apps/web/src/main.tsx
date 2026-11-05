import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { AppProviders } from './AppProviders';
import { AuthProvider } from './auth/AuthProvider';
import './index.css';
import { PWA_ENABLED } from './pwa/flag';
import { captureInstallPrompt } from './pwa/installPrompt';
import { registerServiceWorker } from './pwa/register';

if (PWA_ENABLED) {
  captureInstallPrompt();
  registerServiceWorker();
}

const queryClient = new QueryClient();
const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppProviders>
          <AuthProvider>
            <App />
          </AuthProvider>
        </AppProviders>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
