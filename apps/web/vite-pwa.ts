import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';

// The experimental PWA is on everywhere except Vercel Production, unless VITE_PWA says otherwise:
//   VITE_PWA=true   force it on (e.g. to try it on Production)
//   VITE_PWA=false  force it off
export function pwaEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env['VITE_PWA'] === 'true') return true;
  if (env['VITE_PWA'] === 'false') return false;
  return env['VERCEL_ENV'] !== 'production';
}

const HEAD_TAGS = [
  { tag: 'link', attrs: { rel: 'manifest', href: '/manifest.webmanifest' } },
  { tag: 'meta', attrs: { name: 'theme-color', content: '#161d2b' } },
  { tag: 'meta', attrs: { name: 'mobile-web-app-capable', content: 'yes' } },
  { tag: 'meta', attrs: { name: 'apple-mobile-web-app-capable', content: 'yes' } },
  { tag: 'meta', attrs: { name: 'apple-mobile-web-app-title', content: 'Nisseoppdrag' } },
  {
    tag: 'meta',
    attrs: { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
  },
] as const;

// When the PWA is off, a worker that removes itself replaces sw.js, so a browser that installed
// the experiment on this host gets back to the plain site.
const RETIRE = `self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key.startsWith('nisse-')) await caches.delete(key);
      await self.registration.unregister();
    })(),
  );
});
`;

/** Adds the manifest and icons to index.html and stamps the service worker with the build. */
export function pwa(enabled: boolean): Plugin {
  let config: ResolvedConfig;
  const emitted: string[] = [];
  return {
    name: 'nisse-pwa',
    configResolved(resolved) {
      config = resolved;
    },
    transformIndexHtml() {
      if (!enabled) return [];
      return HEAD_TAGS.map(({ tag, attrs }) => ({ tag, attrs, injectTo: 'head' as const }));
    },
    generateBundle(_options, bundle) {
      emitted.push(...Object.keys(bundle).filter((file) => !file.endsWith('.map')));
    },
    async writeBundle() {
      const outDir = config.build.outDir;
      const sw = join(outDir, 'sw.js');
      if (!enabled) {
        await writeFile(sw, RETIRE);
        await rm(join(outDir, 'manifest.webmanifest'), { force: true });
        return;
      }
      const shell = [
        '/index.html',
        '/manifest.webmanifest',
        '/theme-init.js',
        '/favicon.svg',
        '/icons/icon-192.png',
        ...emitted.filter((file) => file !== 'index.html').map((file) => `/${file}`),
      ];
      const version = Date.now().toString(36);
      const source = await readFile(sw, 'utf8');
      const stamped = source
        .replace("const BUILD = 'dev';", `const BUILD = '${version}';`)
        .replace('const PRECACHE = [];', `const PRECACHE = ${JSON.stringify(shell)};`);
      if (stamped === source) throw new Error('sw.js: BUILD/PRECACHE placeholders not found');
      await writeFile(sw, stamped);
    },
  };
}
