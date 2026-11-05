// The experimental PWA is a build-time switch (see vite-pwa.ts): on in previews and local builds,
// off on Vercel Production unless VITE_PWA=true. With it off none of this code runs.
export const PWA_ENABLED = import.meta.env['VITE_PWA_ENABLED'] === 'true';

// Per-device conveniences in localStorage; never sent anywhere.
const GUIDE_KEY = 'nisse-install-guide';
const ASK_KEY = 'nisse-push-ask';

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // remembered for this visit only
  }
}

export const guideSeen = () => read(GUIDE_KEY) !== null;
export const markGuideSeen = () => {
  write(GUIDE_KEY, 'seen');
};
export const pushAskDismissed = () => read(ASK_KEY) !== null;
export const dismissPushAsk = () => {
  write(ASK_KEY, 'dismissed');
};
