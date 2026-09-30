"use client";

import { useEffect } from "react";

// Silent registration of the static-asset caching in public/sw.js (see its
// own comment for what it does and why) — every page gets this, including
// the public site, independent of PushSubscribe's own registration call
// (staff-only, tied to the notification-permission flow on /admin and
// /technician). Registering the same script twice is a no-op — the browser
// just hands back the existing registration — so there's no conflict between
// the two.
export default function RegisterServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  return null;
}
