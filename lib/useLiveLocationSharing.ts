"use client";

import { useEffect, useRef, useState } from "react";
import { registerPlugin } from "@capacitor/core";
import type { BackgroundGeolocationPlugin } from "@capacitor-community/background-geolocation";

// @capacitor-community/background-geolocation ships no runtime JS of its
// own (only TS types) — per its README, the plugin has to be registered by
// the app. registerPlugin() just builds a bridge proxy; it's safe to call
// at module scope on the web build too, since nothing here invokes any of
// its methods unless Capacitor.isNativePlatform() is true.
const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>("BackgroundGeolocation");

// Whether this is the native app (iOS/Android via Capacitor) vs the
// web/PWA build — read lazily, client-side only (Capacitor.isNativePlatform()
// touches `window`, so it can't run during server rendering). Exposed so
// callers can show platform-specific hints, e.g. "keep this page open"
// only applies to the web build.
export function useIsNativePlatform() {
  const [isNative, setIsNative] = useState(false);
  useEffect(() => {
    import("@capacitor/core").then(({ Capacitor }) => setIsNative(Capacitor.isNativePlatform()));
  }, []);
  return isNative;
}

export type LiveLocationSharingState = "starting" | "sharing" | "denied" | "error" | "stopped" | "unsupported";

// Shared by TechnicianLocationSharer and RiderLocationReporter: shares the
// device's GPS to `url` (POST { ...extraBody, lat, lng }) while `enabled`.
//
// On a native app (iOS/Android, built via Capacitor) this uses
// @capacitor-community/background-geolocation, which keeps reporting while
// the app is backgrounded or the screen is locked — that's the actual
// point of having a native app instead of the web/PWA version, which can
// only watch in the foreground (mobile browsers suspend JS timers and GPS
// once the tab is hidden or the screen locks), so it falls back to
// navigator.geolocation.watchPosition + a wake lock there instead.
//
// Requests go through Capacitor's CapacitorHttp rather than fetch()/a
// server action, since Android throttles HTTP requests made from inside
// the WebView to almost nothing once the app has been backgrounded for
// ~5 minutes — CapacitorHttp's native networking is unaffected by that.
// CapacitorHttp falls back to a plain fetch on the web build, so this is
// the same call on every platform.
export function useLiveLocationSharing({
  enabled,
  url,
  extraBody,
  sendIntervalMs = 10_000,
}: {
  enabled: boolean;
  url: string;
  extraBody: Record<string, unknown>;
  sendIntervalMs?: number;
}) {
  const [state, setState] = useState<LiveLocationSharingState>("starting");
  const [lastSentAt, setLastSentAt] = useState<number | null>(null);
  const lastSendRef = useRef(0);
  // Read fresh on every send without re-subscribing the effect below.
  const extraBodyRef = useRef(extraBody);
  useEffect(() => {
    extraBodyRef.current = extraBody;
  }, [extraBody]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let watchId: number | null = null;
    let nativeWatcherId: string | null = null;
    let wakeLock: { release: () => Promise<void> } | null = null;

    async function stopWatching() {
      if (nativeWatcherId) {
        BackgroundGeolocation.removeWatcher({ id: nativeWatcherId }).catch(() => {
          // Best-effort cleanup.
        });
      }
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      wakeLock?.release().catch(() => {});
    }

    async function send(lat: number, lng: number) {
      const now = Date.now();
      if (now - lastSendRef.current < sendIntervalMs) return;
      lastSendRef.current = now;
      try {
        const { CapacitorHttp } = await import("@capacitor/core");
        // CapacitorHttp's native networking doesn't resolve a relative path
        // against the WebView's current page the way fetch() would — build
        // an absolute URL explicitly. window.location.origin is correct on
        // every platform here since the Capacitor app loads the live site
        // directly (capacitor.config.ts's server.url), not a bundled file.
        const absoluteUrl = new URL(url, window.location.origin).toString();
        const res = await CapacitorHttp.post({
          url: absoluteUrl,
          headers: { "Content-Type": "application/json" },
          data: { ...extraBodyRef.current, lat, lng },
        });
        if (cancelled) return;
        const data = res.data as { stop?: boolean } | null;
        if (res.status === 401 || res.status === 403 || data?.stop) {
          setState("stopped");
          await stopWatching();
          return;
        }
        if (res.status >= 200 && res.status < 300) {
          setState("sharing");
          setLastSentAt(now);
        } else {
          setState("error");
        }
      } catch {
        if (!cancelled) setState("error");
      }
    }

    async function start() {
      const { Capacitor } = await import("@capacitor/core");
      if (Capacitor.isNativePlatform()) {
        try {
          nativeWatcherId = await BackgroundGeolocation.addWatcher(
            {
              backgroundTitle: "Ceejay — sharing your location",
              backgroundMessage: "Stops automatically once this job is no longer on the way.",
              requestPermissions: true,
              stale: false,
              distanceFilter: 25,
            },
            (location, error) => {
              if (cancelled) return;
              if (error) {
                setState(error.code === "NOT_AUTHORIZED" ? "denied" : "error");
                return;
              }
              if (location) send(location.latitude, location.longitude);
            }
          );
        } catch {
          if (!cancelled) setState("error");
        }
        return;
      }

      // Web/PWA fallback — foreground-only (see the module doc comment above).
      if (!("geolocation" in navigator)) {
        setState("unsupported");
        return;
      }
      const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
      nav.wakeLock
        ?.request("screen")
        .then((l) => (wakeLock = l))
        .catch(() => {
          // Best-effort — e.g. low battery or an unsupported context.
        });
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          if (!cancelled) send(pos.coords.latitude, pos.coords.longitude);
        },
        () => {
          if (!cancelled) setState("denied");
        },
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
      );
    }

    start();
    return () => {
      cancelled = true;
      stopWatching();
    };
    // extraBody is read through extraBodyRef, not a dependency on purpose.
  }, [enabled, url, sendIntervalMs]);

  return { state, lastSentAt };
}
