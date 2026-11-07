// Renders the white notification badge (public/icons/badge-96.png) with the preinstalled Chromium.
// The other icons come from the painted nisse: see build-icons.py.
// Run after changing the badge:  node apps/web/scripts/pwa/render-icons.mjs
// (set PLAYWRIGHT_CHROMIUM_PATH when Playwright's own browser is not installed)
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', '..', 'public', 'icons');

// The badge is a one-colour silhouette (Android paints it white in the status bar).
const badge = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
  <g transform="translate(3 3) scale(2.8)" fill="#fff">
    <path d="M6.4 24 C7.4 16 10.4 9 15.4 5.6 C18.8 3.2 22.8 3.6 25.2 6 C26.8 7.6 27.6 9.6 27.6 11.6 C25.6 10.2 23.2 10.2 21.8 11.8 C23.8 15.2 25.2 19.6 26.2 24Z"/>
    <circle cx="27.6" cy="13.4" r="2.6"/>
    <rect x="4.4" y="22.4" width="23.2" height="6.4" rx="2.6"/>
  </g>
</svg>`;

const icons = [
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
