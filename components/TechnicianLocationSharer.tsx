"use client";

import { useMemo } from "react";
import { useLiveLocationSharing, useIsNativePlatform } from "@/lib/useLiveLocationSharing";

// Rendered on a technician's job card while its status is En Route: shares
// the phone's GPS with the customer's /track-technician page (and the
// admin Live Map) until the job leaves En Route. On the native app this
// keeps going in the background/with the screen locked; on the web/PWA
// version the technician has to keep this page open — see
// lib/useLiveLocationSharing.ts for why.
export default function TechnicianLocationSharer({ requestId }: { requestId: string }) {
  const isNative = useIsNativePlatform();
  const extraBody = useMemo(() => ({ requestId }), [requestId]);
  const { state, lastSentAt } = useLiveLocationSharing({
    enabled: true,
    url: "/api/technician/location",
    extraBody,
  });

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
            {!isNative && "Keep this page open while driving. "}
            {lastSentAt && `Last sent ${new Date(lastSentAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`}
          </p>
        </>
      )}
      {state === "denied" && (
        <p className="font-semibold">
          ⚠️ Location permission is blocked, so the customer can&apos;t see you on the map. Allow location for this app in your phone&apos;s settings, then reload.
        </p>
      )}
      {state === "error" && <p className="font-semibold">⚠️ Couldn&apos;t get or send your location. Check GPS and signal — it will keep retrying.</p>}
      {state === "unsupported" && <p className="font-semibold">⚠️ This device can&apos;t share location.</p>}
    </div>
  );
}
