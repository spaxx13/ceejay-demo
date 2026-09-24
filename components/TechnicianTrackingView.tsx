"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { estimateEta, isTrackingClosed, type TrackingSnapshot } from "@/lib/technicianTracking";

// Leaflet needs `window`, so the map renders client-side only.
const TechnicianTrackingMap = dynamic(() => import("./TechnicianTrackingMap"), { ssr: false });

const POLL_MS = 10_000;
// Before the technician sets off (and once they've arrived) the map is only
// waiting for a status change, so it doesn't need the 10s live refresh.
const IDLE_POLL_MS = 60_000;
// A fix older than this means the technician's phone stopped reporting
// (screen locked, app closed, no signal) — say so instead of implying
// they're standing still.
const STALE_MS = 2 * 60_000;

function formatKm(km: number) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

function minutesAgo(iso: string, now: number) {
  const m = Math.floor((now - new Date(iso).getTime()) / 60_000);
  return m <= 0 ? "just now" : m === 1 ? "1 min ago" : `${m} mins ago`;
}

// Live tracking view: status banner, ETA, and a map of the technician
// riding to the customer's pin. Polls `pollUrl` until the technician
// arrives. Shown to the customer (public /track-technician page, polling by
// token) and to Home Service admins on the request page (`viewer="admin"`,
// polling by request id), with wording adjusted for each.
export default function TechnicianTrackingView({
  pollUrl,
  initial,
  viewer = "customer",
}: {
  pollUrl: string;
  initial: TrackingSnapshot;
  viewer?: "customer" | "admin";
}) {
  const admin = viewer === "admin";
  const [snap, setSnap] = useState(initial);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    // Keep polling through "arrived" so the page closes itself once the job
    // is marked Completed.
    if (isTrackingClosed(snap.phase)) return;
    const interval = snap.phase === "on_the_way" ? POLL_MS : IDLE_POLL_MS;
    let timer: number | undefined;
    const poll = async () => {
      setNow(Date.now());
      try {
        const res = await fetch(pollUrl, { cache: "no-store" });
        if (res.ok) setSnap(await res.json());
      } catch {
        // offline for a moment — keep showing the last position
      }
    };
    const start = () => {
      if (timer === undefined) timer = window.setInterval(poll, interval);
    };
    const stop = () => {
      window.clearInterval(timer);
      timer = undefined;
    };
    // Don't poll from a hidden tab (e.g. an admin page left open all day);
    // catch up right away when it's shown again.
    const onVisibilityChange = () => {
      if (document.hidden) stop();
      else {
        poll();
        start();
      }
    };
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [pollUrl, snap.phase]);

  const eta = snap.technician && snap.customer ? estimateEta(snap.technician, snap.customer) : null;
  const stale = snap.technicianUpdatedAt ? now - new Date(snap.technicianUpdatedAt).getTime() > STALE_MS : false;

  return (
    <div className="space-y-4">
      <div
        className={`card flex items-center justify-between gap-3 border-2 ${
          snap.phase === "arrived" || snap.phase === "completed"
            ? "border-green-300 bg-green-50"
            : snap.phase === "on_the_way"
              ? "border-orange-300 bg-orange-50"
              : "border-slate-200"
        }`}
      >
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {snap.phase === "scheduled" && (admin ? "Technician hasn't left yet" : "Your technician hasn't left yet")}
            {snap.phase === "on_the_way" && (admin ? "🛵 Technician is on the way" : "🛵 Your technician is on the way")}
            {snap.phase === "arrived" && (admin ? "✅ Technician has arrived" : "✅ Your technician has arrived")}
            {snap.phase === "completed" && "✅ Home service completed"}
            {snap.phase === "cancelled" && "This home service was cancelled"}
          </p>
          <p className="text-xs text-slate-600">
            {snap.phase === "completed"
              ? admin
                ? "Tracking has ended for this job."
                : "Thank you for choosing Ceejay! Live tracking has ended."
              : `${snap.technicianName} · Ceejay Technician`}
          </p>
        </div>
        {snap.phase === "on_the_way" && eta && (
          <div className="text-right">
            <p className="text-lg font-bold text-orange-900">~{eta.minutes} min</p>
            <p className="text-xs text-slate-600">{formatKm(eta.km)} away</p>
          </div>
        )}
      </div>

      {snap.phase === "on_the_way" && !snap.technician && (
        <p className="text-center text-sm text-slate-500">
          {admin
            ? "Waiting for the technician's location — they need My Jobs open on their phone with location allowed."
            : "Waiting for your technician's location…"}
        </p>
      )}
      {snap.phase === "on_the_way" && snap.technicianUpdatedAt && (
        <p className={`text-center text-xs ${stale ? "text-amber-700" : "text-slate-400"}`}>
          {stale ? "⚠️ " : ""}Location updated {minutesAgo(snap.technicianUpdatedAt, now)}
          {stale && (admin ? " — the technician's phone may have lost signal or closed My Jobs." : " — your technician may be in an area with weak signal.")}
        </p>
      )}

      {(snap.customer || snap.technician) && !isTrackingClosed(snap.phase) && (
        <TechnicianTrackingMap
          customer={snap.customer}
          technician={snap.technician}
          route={[]}
          customerLabel={admin ? "Customer's pin" : "Your location"}
        />
      )}

      {!isTrackingClosed(snap.phase) && (
        <ol className="flex justify-between text-xs">
          {[
            { label: "Assigned", done: true },
            { label: "On the way", done: snap.phase === "on_the_way" || snap.phase === "arrived" },
            { label: "Arrived", done: snap.phase === "arrived" },
          ].map((s) => (
            <li key={s.label} className={s.done ? "font-semibold text-green-700" : "text-slate-400"}>
              {s.done ? "●" : "○"} {s.label}
            </li>
          ))}
        </ol>
      )}
      {eta && <p className="text-center text-[11px] text-slate-400">Arrival time is an estimate and may change with traffic.</p>}
    </div>
  );
}
