"use client";

import { useEffect } from "react";

// Syncs the installed app's home-screen icon badge with the current unread
// count on mount and whenever it changes (e.g. after marking notifications
// read) — the service worker's push handler (public/sw.js) already covers
// the app-closed case, this covers everything else. Browsers without the
// Badging API (anything but a standalone iOS/Chrome PWA) just no-op.
export default function AppBadgeSync({ count }: { count: number }) {
  useEffect(() => {
    const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    if (!nav.setAppBadge || !nav.clearAppBadge) return;
    (count > 0 ? nav.setAppBadge(count) : nav.clearAppBadge()).catch(() => {});
  }, [count]);

  return null;
}
