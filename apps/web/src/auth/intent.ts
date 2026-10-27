// What the visitor came to do, chosen before signing in. Both intents use the same sign-in; the
// choice only decides the first thing a new account sees afterwards. It lives in sessionStorage
// for the same reason the invite code does: it only has to survive the sign-in round trip.
export type Intent = 'join' | 'create';

const KEY = 'nisse-intent';

export function readIntent(): Intent | null {
  try {
    const value = window.sessionStorage.getItem(KEY);
    return value === 'join' || value === 'create' ? value : null;
  } catch {
    return null;
  }
}

export function storeIntent(intent: Intent): void {
  try {
    window.sessionStorage.setItem(KEY, intent);
  } catch {
    // Without storage a new account simply lands on joining a game.
  }
}

export function clearIntent(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}

/** Where an account without a group goes after signing in. */
export function firstStepFor(intent: Intent | null): string {
  return intent === 'create' ? '/lag-spill' : '/onboarding';
}
