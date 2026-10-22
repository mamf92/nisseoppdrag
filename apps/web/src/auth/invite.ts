// An invite code only has to survive the sign-in round trip, so it lives in sessionStorage and
// not in localStorage: closing the tab forgets it.
const KEY = 'nisse-invite';

export function readInvite(): string | null {
  try {
    return window.sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function storeInvite(code: string): void {
  try {
    window.sessionStorage.setItem(KEY, code);
  } catch {
    // Without storage the player types the code on the onboarding page instead.
  }
}

export function clearInvite(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
