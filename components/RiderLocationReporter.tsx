"use client";

import { useMemo } from "react";
import { useLiveLocationSharing, useIsNativePlatform } from "@/lib/useLiveLocationSharing";

// Mounted on a job card only while its pickup leg is actually "On The Way"
// or "On The Way to Branch" (see app/rider/page.tsx) — shares the rider's
// live GPS to app/api/rider/location so the customer's /track page can
// show it live. On the native app this keeps going in the background/with
// the screen locked; on the web/PWA version the rider has to keep this
// page open — see lib/useLiveLocationSharing.ts for why. Renders nothing
// but a small status line; naturally stops (the parent unmounts this) once
// the leg is no longer active, rather than the server telling it to stop.
export default function RiderLocationReporter({ requestId }: { requestId: string }) {
  const isNative = useIsNativePlatform();
  const extraBody = useMemo(() => ({ requestId }), [requestId]);
  const { state } = useLiveLocationSharing({
    enabled: true,
    url: "/api/rider/location",
    extraBody,
  });

  if (state === "sharing") {
    return (
      <p className="text-[11px] text-green-700">
        📍 Sharing your live location with the customer.{!isNative && " Keep this page open."}
      </p>
    );
  }
  if (state === "denied") {
    return <p className="text-[11px] text-amber-700">Location permission denied — the customer won&apos;t see a live map for this trip.</p>;
  }
  if (state === "error") {
    return <p className="text-[11px] text-amber-700">Couldn&apos;t send your location — it will keep retrying.</p>;
  }
  if (state === "unsupported" || state === "stopped") {
    return null;
  }
  return <p className="text-[11px] text-slate-400">Getting your location…</p>;
}
