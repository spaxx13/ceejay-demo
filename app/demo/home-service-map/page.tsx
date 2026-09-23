"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { LatLng } from "@/components/LocationPinMap";

// Leaflet needs `window`, so both maps render client-side only.
const LocationPinMap = dynamic(() => import("@/components/LocationPinMap"), { ssr: false });
const TechnicianTrackingMap = dynamic(() => import("@/components/TechnicianTrackingMap"), { ssr: false });

// Assumed average city riding speed, used for the ETA the customer sees.
const AVG_SPEED_KMH = 25;
// How far away (km) the simulated technician starts from the customer.
const START_DISTANCE_KM = 3.5;
const TICK_MS = 1000;

type TripStatus = "idle" | "routing" | "on_the_way" | "arrived";

function haversineKm(a: LatLng, b: LatLng) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function offsetKm(origin: LatLng, km: number, bearingDeg: number): LatLng {
  const b = (bearingDeg * Math.PI) / 180;
  return {
    lat: origin.lat + (km / 111.32) * Math.cos(b),
    lng: origin.lng + (km / (111.32 * Math.cos((origin.lat * Math.PI) / 180))) * Math.sin(b),
  };
}

// Road route from OSRM's free public demo server. Falls back to a straight
// line if it's unreachable, so the demo still works offline-ish.
async function fetchRoute(from: LatLng, to: LatLng): Promise<LatLng[]> {
  try {
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`
    );
    if (res.ok) {
      const data: { routes?: { geometry: { coordinates: [number, number][] } }[] } = await res.json();
      const coords = data.routes?.[0]?.geometry.coordinates;
      if (coords && coords.length > 1) return coords.map(([lng, lat]) => ({ lat, lng }));
    }
  } catch {
    // fall through
  }
  return [from, to];
}

// Point `distKm` along the route, plus how much route is left after it.
function pointAlong(route: LatLng[], cumulative: number[], distKm: number): LatLng {
  const total = cumulative[cumulative.length - 1];
  if (distKm >= total) return route[route.length - 1];
  let i = 1;
  while (cumulative[i] < distKm) i++;
  const segLen = cumulative[i] - cumulative[i - 1];
  const t = segLen === 0 ? 0 : (distKm - cumulative[i - 1]) / segLen;
  return {
    lat: route[i - 1].lat + (route[i].lat - route[i - 1].lat) * t,
    lng: route[i - 1].lng + (route[i].lng - route[i - 1].lng) * t,
  };
}

function formatKm(km: number) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

export default function HomeServiceMapDemoPage() {
  const [pin, setPin] = useState<LatLng | null>(null);
  const [address, setAddress] = useState<string | null>(null);

  const [status, setStatus] = useState<TripStatus>("idle");
  const [route, setRoute] = useState<LatLng[]>([]);
  const [travelledKm, setTravelledKm] = useState(0);
  // Simulation speed-up: 1x is real time, higher values fast-forward the
  // trip so it can be watched end to end in under a minute.
  const [speedUp, setSpeedUp] = useState(20);
  const speedUpRef = useRef(speedUp);
  useEffect(() => {
    speedUpRef.current = speedUp;
  }, [speedUp]);

  const cumulative = useMemo(() => {
    const out = [0];
    for (let i = 1; i < route.length; i++) out.push(out[i - 1] + haversineKm(route[i - 1], route[i]));
    return out;
  }, [route]);
  const totalKm = cumulative[cumulative.length - 1] ?? 0;
  const remainingKm = Math.max(0, totalKm - travelledKm);
  const etaMin = Math.ceil((remainingKm / AVG_SPEED_KMH) * 60);
  const techPos = route.length > 1 ? pointAlong(route, cumulative, travelledKm) : null;

  useEffect(() => {
    if (status !== "on_the_way") return;
    const timer = window.setInterval(() => {
      setTravelledKm((d) => {
        const next = d + (AVG_SPEED_KMH / 3600) * (TICK_MS / 1000) * speedUpRef.current;
        if (next >= totalKm) {
          setStatus("arrived");
          return totalKm;
        }
        return next;
      });
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [status, totalKm]);

  async function startTrip() {
    if (!pin) return;
    setStatus("routing");
    setTravelledKm(0);
    const start = offsetKm(pin, START_DISTANCE_KM, Math.random() * 360);
    setRoute(await fetchRoute(start, pin));
    setStatus("on_the_way");
  }

  function resetTrip() {
    setStatus("idle");
    setRoute([]);
    setTravelledKm(0);
  }

  const tracking = status !== "idle";

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
      <div className="space-y-1">
        <h1 className="text-lg font-semibold text-slate-900">Home Service Map Demo</h1>
        <p className="text-sm text-slate-500">
          Standalone test page — no login or real booking needed. Step 1 is the pin-your-location map for the Home Service form.
          Step 2 is what the customer sees once the technician is on the way (the technician&apos;s movement is simulated).
        </p>
      </div>

      <section className="card space-y-3">
        <div>
          <p className="kicker">Step 1 · Home Service Form</p>
          <h2 className="text-base font-semibold text-slate-800">Pin your exact location</h2>
          <p className="text-xs text-slate-400">Search your area, then drag the pin to your exact gate/door so the technician finds you easily.</p>
        </div>
        <LocationPinMap
          value={pin}
          onChange={(pos, addr) => {
            setPin(pos);
            setAddress(addr);
            if (tracking) resetTrip();
          }}
        />
        {pin ? (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
            <p className="font-medium">📍 Pinned location</p>
            <p className="mt-0.5 text-xs">{address ?? "Looking up address…"}</p>
            <p className="mt-0.5 font-mono text-[11px] text-blue-700">
              {pin.lat.toFixed(6)}, {pin.lng.toFixed(6)}
            </p>
          </div>
        ) : (
          <p className="text-xs text-slate-400">No pin yet.</p>
        )}
      </section>

      <section className="card space-y-3">
        <div>
          <p className="kicker">Step 2 · Customer tracking page</p>
          <h2 className="text-base font-semibold text-slate-800">Track your technician</h2>
        </div>

        {!pin ? (
          <p className="text-sm text-slate-400">Pin a location in Step 1 first.</p>
        ) : !tracking ? (
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={startTrip} className="btn-primary !px-4 !py-2 text-sm">
              ▶ Simulate technician on the way
            </button>
            <p className="text-xs text-slate-400">Starts the technician about {START_DISTANCE_KM} km away and drives them to your pin.</p>
          </div>
        ) : (
          <>
            <div
              className={`flex items-center justify-between gap-3 rounded-lg border-2 p-3 ${
                status === "arrived" ? "border-green-300 bg-green-50" : "border-orange-300 bg-orange-50"
              }`}
            >
              <div>
                <p className={`text-sm font-semibold ${status === "arrived" ? "text-green-800" : "text-orange-900"}`}>
                  {status === "routing" && "Preparing route…"}
                  {status === "on_the_way" && "🛵 Your technician is on the way"}
                  {status === "arrived" && "✅ Your technician has arrived"}
                </p>
                <p className="text-xs text-slate-600">Juan Dela Cruz · Ceejay Technician</p>
              </div>
              {status === "on_the_way" && (
                <div className="text-right">
                  <p className="text-lg font-bold text-orange-900">{etaMin} min</p>
                  <p className="text-xs text-slate-600">{formatKm(remainingKm)} away</p>
                </div>
              )}
            </div>

            <TechnicianTrackingMap customer={pin} technician={techPos} route={route} />

            <ol className="flex justify-between text-xs">
              {[
                { label: "Assigned", done: true },
                { label: "On the way", done: status === "on_the_way" || status === "arrived" },
                { label: "Arrived", done: status === "arrived" },
              ].map((s) => (
                <li key={s.label} className={s.done ? "font-semibold text-green-700" : "text-slate-400"}>
                  {s.done ? "●" : "○"} {s.label}
                </li>
              ))}
            </ol>

            <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3">
              <span className="text-xs text-slate-500">Demo speed:</span>
              {[1, 5, 20, 60].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSpeedUp(s)}
                  className={`btn-secondary !px-3 !py-1 text-xs ${speedUp === s ? "!bg-blue-200" : ""}`}
                >
                  {s}x
                </button>
              ))}
              <button type="button" onClick={resetTrip} className="ml-auto text-xs text-slate-500 hover:underline">
                Reset
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
