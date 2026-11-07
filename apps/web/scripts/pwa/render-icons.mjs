// Draws the nisse mark and renders favicon.svg, app-icon.svg and the PWA icons in public/icons with the preinstalled Chromium.
// Run after changing the mark:  node apps/web/scripts/pwa/render-icons.mjs
// (set PLAYWRIGHT_CHROMIUM_PATH when Playwright's own browser is not installed)
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', '..', 'public', 'icons');

// One nisse mark everywhere: the same red cap as the "Meg" tab in the bottom menu (the `cap`
// icon in the sprite), here in colour. It is drawn once in a 32 x 32 box and placed three ways:
// the favicon, the home screen icon and the shortcut icons all come from this single shape.
const MARK = `
  <path d="M6.4 24 C7.4 16 10.4 9 15.4 5.6 C18.8 3.2 22.8 3.6 25.2 6 C26.8 7.6 27.6 9.6 27.6 11.6 C25.6 10.2 23.2 10.2 21.8 11.8 C23.8 15.2 25.2 19.6 26.2 24Z" fill="#d9493a"/>
  <path d="M12.6 12.4 C14 9.6 16 7.6 18.4 6.6" fill="none" stroke="#8f2219" stroke-width="1.1" stroke-linecap="round" opacity=".7"/>
  <circle cx="27.6" cy="13.4" r="2.6" fill="#f3ead8"/>
  <rect x="4.4" y="22.4" width="23.2" height="6.4" rx="2.6" fill="#f3ead8"/>
  <path d="M7 24.4 L8.5 26.8 L10 24.4 L11.5 26.8 L13 24.4 L14.5 26.8 L16 24.4 L17.5 26.8 L19 24.4 L20.5 26.8 L22 24.4 L23.5 26.8 L25 24.4" fill="none" stroke="#b4382b" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/>`;

// Home screen icon: the mark on the night barn sky with a lantern glow. Everything that matters sits
// inside the central 80 % so the maskable crop keeps it.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="glow" cx="50%" cy="52%" r="50%">
      <stop offset="0" stop-color="#e8a94b" stop-opacity="0.45"/>
      <stop offset="1" stop-color="#e8a94b" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1f2940"/>
      <stop offset="1" stop-color="#11161f"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#sky)"/>
  <circle cx="256" cy="262" r="230" fill="url(#glow)"/>
  <g transform="translate(31 48) scale(13)">${MARK}</g>
</svg>`;

// Browser tab icon: the same mark on a rounded night tile (scales down to 16 px).
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="7" fill="#161d2b"/>
  <g transform="translate(-0.4 0.8) scale(.95)">${MARK}</g>
</svg>
`;
await writeFile(join(here, 'app-icon.svg'), svg + '\n');
await writeFile(join(out, '..', 'favicon.svg'), favicon);

// The badge is a one-colour silhouette (Android paints it white in the status bar).
const badge = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
  <g transform="translate(3 3) scale(2.8)" fill="#fff">
    <path d="M6.4 24 C7.4 16 10.4 9 15.4 5.6 C18.8 3.2 22.8 3.6 25.2 6 C26.8 7.6 27.6 9.6 27.6 11.6 C25.6 10.2 23.2 10.2 21.8 11.8 C23.8 15.2 25.2 19.6 26.2 24Z"/>
    <circle cx="27.6" cy="13.4" r="2.6"/>
    <rect x="4.4" y="22.4" width="23.2" height="6.4" rx="2.6"/>
  </g>
</svg>`;

const icons = [
  { file: 'icon-192.png', size: 192, source: svg },
  { file: 'icon-512.png', size: 512, source: svg },
  // maskable: the art already keeps to the safe zone, so it is the same picture
  { file: 'maskable-512.png', size: 512, source: svg },
  { file: 'apple-touch-icon.png', size: 180, source: svg },
  { file: 'shortcut-96.png', size: 96, source: svg },
  { file: 'badge-96.png', size: 96, source: badge, transparent: true },
];

await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH });
const page = await browser.newPage();
for (const icon of icons) {
  await page.setViewportSize({ width: icon.size, height: icon.size });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block;width:${icon.size}px;height:${icon.size}px}</style>${icon.source}`,
  );
  await page.screenshot({ path: join(out, icon.file), omitBackground: Boolean(icon.transparent) });
  console.log('wrote', icon.file);
}
await browser.close();
