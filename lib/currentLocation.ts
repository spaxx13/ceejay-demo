// "Use my current location" plumbing for the booking map (see
// components/LocationPinMap.tsx). Kept free of React so the timeout path can
// be exercised on its own — scripts/test-current-location.mjs.

export type GeoFailure = "unsupported" | "denied" | "unavailable" | "timeout";

export const GEO_FAILURE_MESSAGE = "Hindi makuha ang location mo. I-search ang address mo o i-tap ang mapa para i-pin ang exact location.";
export const GEO_DENIED_MESSAGE = "Naka-block ang location permission. I-allow ito sa settings, o i-search na lang ang address mo sa itaas.";

export function geoFailureMessage(reason: GeoFailure) {
  return reason === "denied" ? GEO_DENIED_MESSAGE : GEO_FAILURE_MESSAGE;
}

// The browser's own limit, and ours on top of it. Some in-app browsers
// (Messenger/Facebook on Android) never call the success OR the error
// callback — not even for the browser's timeout — which used to leave the
// button stuck on "Locating…" forever. The watchdog guarantees an answer.
export const GEO_BROWSER_TIMEOUT_MS = 10_000;
export const GEO_WATCHDOG_MS = 12_000;

type GeolocationLike = Pick<Geolocation, "getCurrentPosition">;

// Calls exactly one of onPos / onFail, exactly once, within `watchdogMs`.
// Returns a cancel function (for unmount) after which neither is called.
export function requestCurrentPosition(
  onPos: (pos: { lat: number; lng: number }) => void,
  onFail: (reason: GeoFailure) => void,
  opts: { geolocation?: GeolocationLike | null; watchdogMs?: number } = {}
): () => void {
  const geolocation = opts.geolocation !== undefined ? opts.geolocation : typeof navigator !== "undefined" ? navigator.geolocation : null;
  let settled = false;
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  const settle = (run: () => void) => {
    if (settled) return;
    settled = true;
    if (watchdog !== undefined) clearTimeout(watchdog);
    run();
  };

  if (!geolocation) {
    settle(() => onFail("unsupported"));
    return () => {};
  }

  watchdog = setTimeout(() => settle(() => onFail("timeout")), opts.watchdogMs ?? GEO_WATCHDOG_MS);
  try {
    geolocation.getCurrentPosition(
      (p) => settle(() => onPos({ lat: p.coords.latitude, lng: p.coords.longitude })),
      (err) =>
        settle(() =>
          // 1 = PERMISSION_DENIED, 3 = TIMEOUT (numeric: not every webview
          // puts the named constants on the error object).
          onFail(err.code === 1 ? "denied" : err.code === 3 ? "timeout" : "unavailable")
        ),
      { enableHighAccuracy: true, timeout: GEO_BROWSER_TIMEOUT_MS, maximumAge: 0 }
    );
  } catch {
    settle(() => onFail("unavailable"));
  }
  return () => settle(() => {});
}

// ---------- Facebook / Messenger in-app browser ----------

export type InAppBrowser = { platform: "android" | "ios" | "other" };

// Facebook's and Messenger's built-in browsers tag their user agent with
// FBAN/FBAV/FB_IAB (and "Messenger" on some builds).
export function detectFacebookInAppBrowser(userAgent: string): InAppBrowser | null {
  if (!/FBAN|FBAV|FB_IAB|Messenger/i.test(userAgent)) return null;
  if (/Android/i.test(userAgent)) return { platform: "android" };
  if (/iPhone|iPad|iPod/i.test(userAgent)) return { platform: "ios" };
  return { platform: "other" };
}

// Android intent link that reopens the given https page in Chrome.
export function chromeIntentUrl(loc: { host: string; pathname: string; search: string }) {
  return `intent://${loc.host}${loc.pathname}${loc.search}#Intent;scheme=https;package=com.android.chrome;end`;
}
