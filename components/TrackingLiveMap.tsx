"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
const REFRESH_INTERVAL_MS = 10000;

// Shown on /track while the pickup leg is actually "On The Way" or "On The
// Way to Branch" — the page itself is a Server Component, so "live" here
// means re-fetching the whole page on an interval (cheap — this is a single
// row lookup) rather than a client-side socket. Each refresh re-renders this
// with fresh lat/lng from the DB, which is enough to keep the embedded map
// centered on the rider's latest ping.
export default function TrackingLiveMap({
  lat,
  lng,
  updatedAt,
  destinationAddress,
}: {
  lat: number | null;
  lng: number | null;
  updatedAt: string | null;
  // Where the rider is headed — the customer's address ("On The Way") or the
  // branch's address ("On The Way to Branch"). When set, the map shows the
  // route to it instead of just the rider's bare position.
  destinationAddress?: string;
}) {
  const router = useRouter();
  const [staleness, setStaleness] = useState("");

  useEffect(() => {
    const id = setInterval(() => router.refresh(), REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [router]);

  // Date.now() is impure, so it's read here (inside an effect, in response
  // to `updatedAt` actually changing) rather than during render.
  useEffect(() => {
    const id = setTimeout(() => {
      if (!updatedAt) {
        setStaleness("");
        return;
      }
      const ageSeconds = Math.max(0, Math.round((Date.now() - new Date(updatedAt).getTime()) / 1000));
      setStaleness(ageSeconds < 60 ? `Updated ${ageSeconds}s ago` : `Updated ${Math.round(ageSeconds / 60)}m ago`);
    }, 0);
    return () => clearTimeout(id);
  }, [updatedAt]);

  if (lat === null || lng === null) {
    return <p className="text-sm text-slate-400">Waiting for the rider&apos;s location — this updates automatically once they start sharing it.</p>;
  }

  const origin = `${lat},${lng}`;
  // Google's embed API geocodes a plain address string for us — no need to
  // store lat/lng on every branch just to plot it here.
  const mapsUrl = destinationAddress
    ? `https://www.google.com/maps/embed/v1/directions?key=${GOOGLE_MAPS_KEY}&origin=${origin}&destination=${encodeURIComponent(destinationAddress)}&mode=driving`
    : `https://www.google.com/maps/embed/v1/view?key=${GOOGLE_MAPS_KEY}&center=${origin}&zoom=15`;
  const openUrl = destinationAddress
    ? `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${encodeURIComponent(destinationAddress)}&travelmode=driving`
    : `https://www.google.com/maps?q=${origin}`;

  return (
    <div className="space-y-1.5">
      {GOOGLE_MAPS_KEY ? (
        <iframe title="Rider's live location" className="h-56 w-full rounded-xl border border-slate-200" loading="lazy" referrerPolicy="no-referrer-when-downgrade" src={mapsUrl} />
      ) : (
        <a href={openUrl} target="_blank" rel="noreferrer" className="card block text-center text-sm text-blue-500 hover:underline">
          {destinationAddress ? "Open the rider's route in Google Maps →" : "Open the rider's live location in Google Maps →"}
        </a>
      )}
      {staleness && <p className="text-right text-[11px] text-slate-400">{staleness}</p>}
    </div>
  );
}
