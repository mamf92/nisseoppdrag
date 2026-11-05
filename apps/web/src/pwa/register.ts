// Registers the service worker and reports when a new version is waiting.

type Listener = (apply: () => void) => void;
let onUpdate: Listener | null = null;
let waiting: ServiceWorker | null = null;

function announce(worker: ServiceWorker) {
  waiting = worker;
  onUpdate?.(() => {
    worker.postMessage('skip-waiting');
  });
}

/** Calls `listener` with an «apply» function whenever a new version is ready to take over. */
export function whenUpdateReady(listener: Listener): () => void {
  onUpdate = listener;
  if (waiting) announce(waiting);
  return () => {
    onUpdate = null;
  };
}

export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;
  // Reload once the new worker has taken over, so page and cache are the same version.
  let reloading = false;
  const hadController = navigator.serviceWorker.controller !== null;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    window.location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then((reg) => {
        if (reg.waiting && navigator.serviceWorker.controller) announce(reg.waiting);
        reg.addEventListener('updatefound', () => {
          const next = reg.installing;
          next?.addEventListener('statechange', () => {
            if (next.state === 'installed' && navigator.serviceWorker.controller) announce(next);
          });
        });
        // An app left open for days still learns about new versions.
        window.setInterval(() => void reg.update().catch(() => undefined), 60 * 60 * 1000);
      })
      .catch(() => undefined);
  });
}
