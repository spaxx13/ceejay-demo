"use client";

import { useState } from "react";
import TechnicianTrackingView from "./TechnicianTrackingView";
import type { TrackingSnapshot } from "@/lib/technicianTracking";

// Collapsible live map on the admin request page — the same view the
// customer gets from their "on the way" email. Starts open while the job is
// On the Way. The map only mounts once opened (Leaflet can't lay itself out
// inside a hidden container).
export default function AdminLiveMap({ requestId, initial }: { requestId: string; initial: TrackingSnapshot }) {
  const onTheWay = initial.phase === "on_the_way";
  const [open, setOpen] = useState(onTheWay);
  return (
    <div className="card space-y-3">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between text-left">
        <span className="text-sm font-semibold text-slate-800">🗺️ Live Map{onTheWay ? " — technician on the way" : ""}</span>
        <span className="text-xs text-slate-400">{open ? "Hide" : "Show"}</span>
      </button>
      {open && <TechnicianTrackingView pollUrl={`/api/admin/track-technician/${requestId}`} initial={initial} viewer="admin" />}
    </div>
  );
}
