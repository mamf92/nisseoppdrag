import { detectPlatform, isMobile } from './platform';

const UA = {
  iphone18:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
  iphone26:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1',
  iphone15:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 15_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Mobile/15E148 Safari/604.1',
  ipad: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
  chromeIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0.0.0 Mobile/15E148 Safari/604.1',
  instagram:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 400.0.0',
  android:
    'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
  chrome:
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  firefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0',
};

const env = (
  userAgent: string,
  extra: Partial<{ maxTouchPoints: number; standalone: boolean }> = {},
) => ({
  userAgent,
  maxTouchPoints: 0,
  standalone: false,
  ...extra,
});

describe('detectPlatform', () => {
  it('knows Safari on iPhone and its version', () => {
    expect(detectPlatform(env(UA.iphone18, { maxTouchPoints: 5 }))).toEqual({
      platform: 'ios-safari',
      safariVersion: 18,
      iosTooOldForPush: false,
    });
    expect(detectPlatform(env(UA.iphone26, { maxTouchPoints: 5 })).safariVersion).toBe(26);
  });

  it('flags iOS too old for Web Push', () => {
    expect(detectPlatform(env(UA.iphone15, { maxTouchPoints: 5 })).iosTooOldForPush).toBe(true);
  });

  it('sees through the iPad desktop user agent', () => {
    expect(detectPlatform(env(UA.ipad, { maxTouchPoints: 5 })).platform).toBe('ios-safari');
    expect(detectPlatform(env(UA.ipad)).platform).toBe('desktop-safari');
  });

  it('tells other iOS browsers and in-app browsers apart', () => {
    expect(detectPlatform(env(UA.chromeIos)).platform).toBe('ios-other');
    expect(detectPlatform(env(UA.instagram)).platform).toBe('ios-inapp');
  });

  it('knows Android, desktop Chrome and Firefox', () => {
    expect(detectPlatform(env(UA.android)).platform).toBe('android');
    expect(detectPlatform(env(UA.chrome)).platform).toBe('desktop-chromium');
    expect(detectPlatform(env(UA.firefox)).platform).toBe('desktop-other');
  });

  it('an installed app is standalone whatever the browser', () => {
    expect(detectPlatform(env(UA.iphone18, { standalone: true })).platform).toBe('standalone');
  });

  it('only phones and tablets get the guide on first visit', () => {
    expect(isMobile('ios-safari')).toBe(true);
    expect(isMobile('android')).toBe(true);
    expect(isMobile('desktop-chromium')).toBe(false);
    expect(isMobile('standalone')).toBe(false);
  });
});
