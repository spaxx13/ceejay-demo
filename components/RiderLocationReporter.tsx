"use client";

import { useEffect, useState } from "react";

// Mounted on a job card only while its pickup leg is actually "On The Way"
// or "On The Way to Branch" (see app/rider/page.tsx) — watches the rider's
// own browser location and pings app/api/rider/location every ~12s so the
// customer's /track page can show it live. Renders nothing but a small
// status line; silently does nothing if the rider hasn't granted location
// permission (or is on a browser without it) rather than blocking the rest
// of the page.
const PING_INTERVAL_MS = 12000;

export default function RiderLocationReporter({ requestId }: { requestId: string }) {
  const [status, setStatus] = useState<"idle" | "sharing" | "denied" | "unsupported">("idle");

  // Keeps the rider's screen from auto-locking while this trip is active —
  // location updates stop once the screen locks or the tab is backgrounded,
  // since mobile browsers suspend JS timers then. Best-effort: silently
  // does nothing on browsers without the API, and the lock is released
  // automatically by the browser whenever the tab is hidden, so it's
  // re-requested on visibilitychange rather than tracked as a hard failure.
  useEffect(() => {
    if (!("wakeLock" in navigator)) return;

    let lock: WakeLockSentinel | null = null;
    let cancelled = false;

    async function acquire() {
      try {
        lock = await navigator.wakeLock.request("screen");
      } catch {
        // Ignored — e.g. low battery or an unsupported context. The rider
        // keeps their location working as long as the screen stays on
        // some other way; this is a nice-to-have, not a requirement.
      }
    }

    acquire();

    function handleVisibilityChange() {
      if (document.visibilityState === "visible" && !cancelled) acquire();
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      lock?.release().catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      const id = setTimeout(() => setStatus("unsupported"), 0);
      return () => clearTimeout(id);
    }

    let cancelled = false;
    let lastSent = 0;

    function send(lat: number, lng: number) {
      fetch("/api/rider/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, lat, lng }),
      }).catch(() => {
        // Best-effort — a dropped ping just means the map is briefly stale.
      });
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (cancelled) return;
        setStatus("sharing");
        const now = Date.now();
        if (now - lastSent < PING_INTERVAL_MS) return;
        lastSent = now;
        send(pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        if (!cancelled) setStatus("denied");
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );

    return () => {
      cancelled = true;
      navigator.geolocation.clearWatch(watchId);
    };
  }, [requestId]);

  if (status === "sharing") {
    return <p className="text-[11px] text-green-700">📍 Sharing your live location with the customer.</p>;
  }
  if (status === "denied") {
    return <p className="text-[11px] text-amber-700">Location permission denied — the customer won&apos;t see a live map for this trip.</p>;
  }
  if (status === "unsupported") {
    return null;
  }
  return <p className="text-[11px] text-slate-400">Getting your location…</p>;
}
