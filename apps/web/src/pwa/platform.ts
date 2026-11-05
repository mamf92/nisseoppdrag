// Which install path a visitor needs. Only the user agent string and a few feature checks are
// read, in the browser, and nothing is stored or sent anywhere.

export type Platform =
  /** Already running as an installed app. */
  | 'standalone'
  /** Safari on iPhone/iPad: Share › Add to Home Screen. */
  | 'ios-safari'
  /** Chrome, Firefox, Edge … on iPhone/iPad (they use the same share sheet since iOS 16.4). */
  | 'ios-other'
  /** An app's built-in browser (Instagram, Facebook, LinkedIn …): open in Safari first. */
  | 'ios-inapp'
  /** Android: Chrome's install prompt or its menu. */
  | 'android'
  /** Chrome or Edge on a computer: the install button in the address bar. */
  | 'desktop-chromium'
  /** Safari on a Mac: File › Add to Dock. */
  | 'desktop-safari'
  /** Firefox on a computer: no install, but notifications work in the tab. */
  | 'desktop-other';

export interface PlatformInfo {
  platform: Platform;
  /** Safari's major version on Apple devices (26 brings the new tab bar with «⋯»). */
  safariVersion: number | null;
  /** iOS/iPadOS before 16.4 cannot receive Web Push at all. */
  iosTooOldForPush: boolean;
}

interface Env {
  userAgent: string;
  maxTouchPoints: number;
  standalone: boolean;
}

function currentEnv(): Env {
  const nav = navigator as Navigator & { standalone?: boolean };
  const displayStandalone =
    typeof window.matchMedia === 'function' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: minimal-ui)').matches);
  return {
    userAgent: nav.userAgent,
    maxTouchPoints: nav.maxTouchPoints,
    standalone: displayStandalone || nav.standalone === true,
  };
}

export function detectPlatform(env: Env = currentEnv()): PlatformInfo {
  const ua = env.userAgent;
  const safariMatch = /Version\/(\d+)(?:\.(\d+))?[.\d]* (Mobile\/\S+ )?Safari/.exec(ua);
  const safariVersion = safariMatch ? Number(safariMatch[1]) : null;
  const safariFull = safariMatch
    ? Number(safariMatch[1]) + Number(safariMatch[2] ?? 0) / 100
    : null;
  // iPadOS asks for the desktop site, so it says «Macintosh»; touch points give it away.
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && env.maxTouchPoints > 1);
  const osMatch = /OS (\d+)_(\d+)/.exec(ua);
  const iosVersion = osMatch ? Number(osMatch[1]) + Number(osMatch[2]) / 100 : null;
  const iosTooOldForPush =
    ios && (safariFull !== null ? safariFull < 16.04 : iosVersion !== null && iosVersion < 16.04);

  const info = (platform: Platform): PlatformInfo => ({
    platform,
    safariVersion,
    iosTooOldForPush,
  });
  if (env.standalone) return info('standalone');
  if (ios) {
    if (/FBAN|FBAV|Instagram|LinkedInApp|Snapchat|Line\/|MicroMessenger|GSA\//.test(ua))
      return info('ios-inapp');
    if (/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/.test(ua)) return info('ios-other');
    return info('ios-safari');
  }
  if (/Android/.test(ua)) return info('android');
  if (/Chrome\/|Edg\//.test(ua) && !/Firefox/.test(ua)) return info('desktop-chromium');
  if (/Macintosh/.test(ua) && safariVersion !== null) return info('desktop-safari');
  return info('desktop-other');
}

/** Phones and tablets get the guide on their first visit; computers find it in Meg. */
export function isMobile(platform: Platform): boolean {
  return platform.startsWith('ios') || platform === 'android';
}
