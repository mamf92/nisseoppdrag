import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { pwa, pwaEnabled } from './vite-pwa';

const PWA = pwaEnabled();

export default defineConfig({
  plugins: [react(), tailwindcss(), pwa(PWA)],
  define: {
    // read through src/pwa/flag.ts
    'import.meta.env.VITE_PWA_ENABLED': JSON.stringify(String(PWA)),
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
