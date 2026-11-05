import { useSyncExternalStore } from 'react';

// Chrome and Edge fire `beforeinstallprompt` early, often before React has mounted, so the event
// is caught here at start-up and kept until the guide's install button uses it.
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const emit = () => {
  listeners.forEach((listener) => {
    listener();
  });
};

export function captureInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault(); // our own button and guide replace the mini-infobar
    deferred = event as InstallPromptEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    installed = true;
    emit();
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** `canPrompt`: the browser offered a one-tap install; `installed`: it happened this visit. */
export function useInstallPrompt() {
  const canPrompt = useSyncExternalStore(subscribe, () => deferred !== null);
  const justInstalled = useSyncExternalStore(subscribe, () => installed);
  return {
    canPrompt,
    installed: justInstalled,
    async prompt(): Promise<boolean> {
      const event = deferred;
      if (!event) return false;
      deferred = null;
      emit();
      await event.prompt();
      const choice = await event.userChoice;
      return choice.outcome === 'accepted';
    },
  };
}
