import { useEffect } from 'react';
import { PWA_ENABLED } from './flag';

/** Shows the number of open missions on the app icon (Badging API; installed apps only). */
export function useAppBadge(openMissions: number | null): void {
  useEffect(() => {
    if (!PWA_ENABLED || openMissions === null || !('setAppBadge' in navigator)) return;
    const done = openMissions > 0 ? navigator.setAppBadge(openMissions) : navigator.clearAppBadge();
    void done.catch(() => undefined);
  }, [openMissions]);
}
