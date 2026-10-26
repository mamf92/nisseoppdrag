// Sanity checks for the two public Supabase values baked into the browser bundle. They exist
// because swapping the URL and the key in the Vercel settings produced a build that deployed fine
// and then failed at sign-in. The checks run at build time (vite.config.ts) and in the post-deploy
// smoke test, never in the browser.

export interface SupabaseEnv {
  url: string | undefined;
  key: string | undefined;
}

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost']);

function looksLikeKey(value: string): boolean {
  return value.startsWith('sb_') || value.startsWith('eyJ');
}

function jwtRole(token: string): string | undefined {
  const payload = token.split('.')[1];
  if (!payload) return undefined;
  try {
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as {
      role?: unknown;
    };
    return typeof json.role === 'string' ? json.role : undefined;
  } catch {
    return undefined;
  }
}

/** Returns a list of human-readable problems; an empty list means the values look right. */
export function checkSupabaseEnv({ url, key }: SupabaseEnv): string[] {
  const problems: string[] = [];

  if (!url) {
    problems.push('VITE_SUPABASE_URL is not set.');
  } else if (looksLikeKey(url)) {
    problems.push('VITE_SUPABASE_URL contains a key, not a URL. Are the two values swapped?');
  } else if (url !== url.trim() || /["']/.test(url)) {
    problems.push('VITE_SUPABASE_URL has stray whitespace or quotes around it.');
  } else {
    let parsed: URL | undefined;
    try {
      parsed = new URL(url);
    } catch {
      problems.push('VITE_SUPABASE_URL is not a valid URL.');
    }
    if (parsed) {
      const local = LOCAL_HOSTS.has(parsed.hostname);
      if (!local && parsed.protocol !== 'https:') {
        problems.push('VITE_SUPABASE_URL must use https.');
      }
      if (!local && !parsed.hostname.endsWith('.supabase.co')) {
        problems.push('VITE_SUPABASE_URL should be the project URL, https://<ref>.supabase.co.');
      }
      if (parsed.pathname !== '/' || parsed.search !== '') {
        problems.push('VITE_SUPABASE_URL must be the bare project URL, without a path.');
      }
    }
  }

  if (!key) {
    problems.push('VITE_SUPABASE_PUBLISHABLE_KEY is not set.');
  } else if (/^https?:\/\//.test(key)) {
    problems.push('VITE_SUPABASE_PUBLISHABLE_KEY contains a URL, not a key. Are they swapped?');
  } else if (key !== key.trim() || /["']/.test(key)) {
    problems.push('VITE_SUPABASE_PUBLISHABLE_KEY has stray whitespace or quotes around it.');
  } else if (key.startsWith('sb_secret_')) {
    problems.push('VITE_SUPABASE_PUBLISHABLE_KEY is a SECRET key. Never ship it to the browser.');
  } else if (key.startsWith('sb_publishable_')) {
    // Good.
  } else if (key.startsWith('eyJ')) {
    const role = jwtRole(key);
    if (role === 'service_role') {
      problems.push('VITE_SUPABASE_PUBLISHABLE_KEY is a service_role key. Never ship it.');
    } else if (role !== 'anon') {
      problems.push('VITE_SUPABASE_PUBLISHABLE_KEY is a JWT but not the anon key.');
    }
  } else {
    problems.push(
      'VITE_SUPABASE_PUBLISHABLE_KEY is not a Supabase key (sb_publishable_… or anon).',
    );
  }

  return problems;
}
