import { loadEnv } from 'vite';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { checkSupabaseEnv } from './src/lib/supabaseEnv.ts';

// Fails the build when the public Supabase values are present but wrong (swapped, quoted, a
// secret key). Hosted builds (Vercel, or REQUIRE_SUPABASE_ENV=1) must also have both set; other
// builds, such as the first CI build before the local stack starts, may leave them out.
function checkSupabaseEnvPlugin(mode: string): Plugin {
  return {
    name: 'nisse-check-supabase-env',
    apply: 'build',
    buildStart() {
      const env = { ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env };
      const url = env['VITE_SUPABASE_URL'];
      const key = env['VITE_SUPABASE_PUBLISHABLE_KEY'] || env['VITE_SUPABASE_ANON_KEY'];
      const required = Boolean(env['VERCEL']) || env['REQUIRE_SUPABASE_ENV'] === '1';
      if (!required && !url && !key) return;
      const problems = checkSupabaseEnv({ url, key });
      if (problems.length > 0) {
        this.error(`Supabase environment check failed:\n - ${problems.join('\n - ')}`);
      }
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), checkSupabaseEnvPlugin(mode)],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
}));
