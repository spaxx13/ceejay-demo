"use client";

import { useEffect, useRef, useState } from "react";
import { updateTechnicianLocation } from "@/lib/actions";

// How often a fix is sent to the server while sharing. watchPosition can
// fire every second; the customer's page only polls every 10s anyway.
const SEND_EVERY_MS = 10_000;

type WakeLockSentinelLike = { release: () => Promise<void> };

// Rendered on a technician's job card while its status is En Route: shares
// the phone's GPS with the customer's /track-technician page until the job
// leaves En Route (the server answers `stop`). The page has to stay open —
// phones pause GPS for background tabs — so it also asks the screen to
// stay awake.
export default function TechnicianLocationSharer({ requestId }: { requestId: string }) {
  const [state, setState] = useState<"starting" | "sharing" | "denied" | "error" | "stopped" | "unsupported">(() =>
    typeof navigator !== "undefined" && !navigator.geolocation ? "unsupported" : "starting"
  );
  const [lastSentAt, setLastSentAt] = useState<number | null>(null);
  const lastSendRef = useRef(0);

  useEffect(() => {
    if (!navigator.geolocation) return;
    let stopped = false;
    let wakeLock: WakeLockSentinelLike | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<WakeLockSentinelLike> } };
    nav.wakeLock?.request("screen").then((l) => (wakeLock = l)).catch(() => {});

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        if (stopped) return;
        const nowMs = Date.now();
        if (nowMs - lastSendRef.current < SEND_EVERY_MS) return;
        lastSendRef.current = nowMs;
        try {
          const res = await updateTechnicianLocation(requestId, pos.coords.latitude, pos.coords.longitude);
          if (res.stop) {
            stopped = true;
            navigator.geolocation.clearWatch(watchId);
            setState("stopped");
            return;
          }
          if (res.ok) {
            setState("sharing");
            setLastSentAt(nowMs);
          }
        } catch {
          setState("error");
        }
      },
      (err) => setState(err.code === err.PERMISSION_DENIED ? "denied" : "error"),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 }
    );

    return () => {
      stopped = true;
      navigator.geolocation.clearWatch(watchId);
      wakeLock?.release().catch(() => {});
    };
  }, [requestId]);

  if (state === "stopped") return null;

  const tone =
    state === "sharing" ? "border-green-300 bg-green-50 text-green-900" : state === "starting" ? "border-blue-300 bg-blue-50 text-blue-900" : "border-red-300 bg-red-50 text-red-900";

  return (
    <div className={`rounded-lg border-2 p-3 text-sm ${tone}`}>
      {state === "starting" && <p className="font-semibold">📡 Starting location sharing… allow location access if your phone asks.</p>}
      {state === "sharing" && (
        <>
          <p className="font-semibold">📡 Sharing your live location with the customer</p>
          <p className="text-xs">
            Keep this page open while driving.{lastSentAt && ` Last sent ${new Date(lastSentAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`}
          </p>
        </>
      )}
      {state === "denied" && (
        <p className="font-semibold">
          ⚠️ Location permission is blocked, so the customer can&apos;t see you on the map. Allow location for this site in your phone&apos;s settings, then reload.
        </p>
      )}
      {state === "error" && <p className="font-semibold">⚠️ Couldn&apos;t get or send your location. Check GPS and signal — it will keep retrying.</p>}
      {state === "unsupported" && <p className="font-semibold">⚠️ This browser can&apos;t share location.</p>}
    </div>
  );
}
