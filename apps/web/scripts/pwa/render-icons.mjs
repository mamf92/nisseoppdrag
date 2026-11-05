// Renders the PWA icons in public/icons from app-icon.svg with the preinstalled Chromium.
// Run after changing the SVG:  node apps/web/scripts/pwa/render-icons.mjs
// (set PLAYWRIGHT_CHROMIUM_PATH when Playwright's own browser is not installed)
import { readFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', '..', 'public', 'icons');
const svg = await readFile(join(here, 'app-icon.svg'), 'utf8');

// The badge is a one-colour silhouette (Android paints it white in the status bar).
const badge = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
  <path d="M20 66 C23 44 34 24 54 18 C66 14 76 19 79 29 C70 27 64 31 62 40 C60 50 66 60 72 66 Z" fill="#fff"/>
  <circle cx="80" cy="31" r="7" fill="#fff"/>
  <rect x="16" y="62" width="62" height="14" rx="7" fill="#fff"/>
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
