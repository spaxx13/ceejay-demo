"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// Minimal surface of the Maps JS API this component touches — kept narrow
// and local rather than a global Window augmentation, same convention as
// MapPinPicker.tsx.
type LatLngLiteral = { lat: number; lng: number };
type GMap = { setCenter: (pos: LatLngLiteral) => void; setZoom: (z: number) => void; fitBounds: (bounds: GBounds, padding?: number) => void };
type GMarker = { setPosition: (pos: LatLngLiteral) => void; setMap: (map: GMap | null) => void };
type GBounds = { extend: (pos: LatLngLiteral) => void };
type GDirectionsRenderer = { setMap: (map: GMap | null) => void; setDirections: (result: unknown) => void };
type GDirectionsService = {
  route: (request: Record<string, unknown>, callback: (result: unknown, status: string) => void) => void;
};
type GoogleMapsNamespace = {
  maps: {
    Map: new (el: HTMLElement, opts: Record<string, unknown>) => GMap;
    Marker: new (opts: Record<string, unknown>) => GMarker;
    LatLngBounds: new () => GBounds;
    DirectionsService: new () => GDirectionsService;
    DirectionsRenderer: new (opts?: Record<string, unknown>) => GDirectionsRenderer;
    TravelMode: { DRIVING: string };
  };
};

const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
const REFRESH_INTERVAL_MS = 10000;

function loadGoogleMaps(onReady: () => void) {
  const w = window as unknown as { google?: GoogleMapsNamespace };
  if (w.google?.maps) {
    onReady();
    return;
  }
  const existing = document.getElementById("google-maps-script") as HTMLScriptElement | null;
  if (existing) {
    existing.addEventListener("load", onReady);
    return;
  }
  const script = document.createElement("script");
  script.id = "google-maps-script";
  script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&libraries=places`;
  script.async = true;
  script.onload = onReady;
  document.head.appendChild(script);
}

// Shown on /track while the pickup leg is actually "On The Way", "Picked
// Up", or "On The Way to Branch" — the page itself is a Server Component,
// so "live" here means re-fetching the whole page on an interval (cheap —
// this is a single row lookup) rather than a client-side socket. Each
// refresh re-renders this with fresh lat/lng from the DB, which is enough
// to keep the map centered on the rider's latest ping.
//
// Uses the Maps JavaScript API (not the simpler Embed API) specifically so
// the route can be drawn without Google's built-in "place card" popup —
// the Embed API's directions mode always shows that overlay, with no
// parameter to suppress it.
export default function TrackingLiveMap({
  lat,
  lng,
  updatedAt,
  destinationAddress,
  destinationLat,
  destinationLng,
}: {
  lat: number | null;
  lng: number | null;
  updatedAt: string | null;
  // Where the rider is headed — the customer's address ("On The Way") or the
  // branch's address ("On The Way to Branch"). When set, the map shows the
  // route to it instead of just the rider's bare position.
  destinationAddress?: string;
  // Exact coordinates for that same destination, when known (a branch with
  // its pin set in Admin > Branches, or a customer address geocoded at
  // booking time) — preferred over the address text, since geocoding a
  // plain string can resolve to the wrong nearby landmark.
  destinationLat?: number | null;
  destinationLng?: number | null;
}) {
  const router = useRouter();
  const [staleness, setStaleness] = useState("");
  const [ready, setReady] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<GMap | null>(null);
  const markerRef = useRef<GMarker | null>(null);
  const destMarkerRef = useRef<GMarker | null>(null);
  const directionsRendererRef = useRef<GDirectionsRenderer | null>(null);

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

  useEffect(() => {
    if (!GOOGLE_MAPS_KEY || lat === null || lng === null) return;
    loadGoogleMaps(() => setReady(true));
  }, [lat, lng]);

  useEffect(() => {
    if (!ready || !mapContainerRef.current || lat === null || lng === null) return;
    const g = (window as unknown as { google: GoogleMapsNamespace }).google;
    const origin = { lat, lng };
    const destinationCoords = destinationLat != null && destinationLng != null ? { lat: destinationLat, lng: destinationLng } : null;
    const destination = destinationCoords ?? destinationAddress ?? null;

    if (!mapRef.current) {
      mapRef.current = new g.maps.Map(mapContainerRef.current, {
        center: origin,
        zoom: 15,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
      });
    }
    const map = mapRef.current;

    // Markers are placed ourselves (rather than relying on
    // DirectionsRenderer's default A/B pins) so the rider's and the
    // destination's positions stay visible on the map even if the
    // directions request below fails — a blank map with no polyline and no
    // pins is confusing, a map with pins but no route is still useful.
    if (markerRef.current) {
      markerRef.current.setPosition(origin);
    } else {
      markerRef.current = new g.maps.Marker({
        position: origin,
        map,
        icon: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png",
        title: "Rider",
      });
    }

    if (destinationCoords) {
      if (destMarkerRef.current) {
        destMarkerRef.current.setPosition(destinationCoords);
      } else {
        destMarkerRef.current = new g.maps.Marker({ position: destinationCoords, map, title: "Destination" });
      }
      const bounds = new g.maps.LatLngBounds();
      bounds.extend(origin);
      bounds.extend(destinationCoords);
      map.fitBounds(bounds, 56);
    } else {
      if (destMarkerRef.current) {
        destMarkerRef.current.setMap(null);
        destMarkerRef.current = null;
      }
      map.setCenter(origin);
      map.setZoom(15);
    }

    if (destination) {
      if (!directionsRendererRef.current) {
        directionsRendererRef.current = new g.maps.DirectionsRenderer({ suppressInfoWindows: true, suppressMarkers: true });
      }
      const renderer = directionsRendererRef.current;
      renderer.setMap(map);
      new g.maps.DirectionsService().route({ origin, destination, travelMode: g.maps.TravelMode.DRIVING }, (result, status) => {
        if (status === "OK" && result) {
          renderer.setDirections(result);
        } else {
          console.error("TrackingLiveMap: directions request failed", status);
        }
      });
    } else if (directionsRendererRef.current) {
      directionsRendererRef.current.setMap(null);
    }
  }, [ready, lat, lng, destinationAddress, destinationLat, destinationLng]);

  if (lat === null || lng === null) {
    return <p className="text-sm text-slate-400">Waiting for the rider&apos;s location — this updates automatically once they start sharing it.</p>;
  }

  if (!GOOGLE_MAPS_KEY) {
    const origin = `${lat},${lng}`;
    // Prefer an exact pin over geocoding the address text — a plain string
    // (e.g. "Farmers Plaza, Cubao") can resolve to the wrong, more prominent
    // nearby landmark (e.g. Gateway Mall next door).
    const destination =
      destinationLat != null && destinationLng != null ? `${destinationLat},${destinationLng}` : destinationAddress ? destinationAddress : null;
    const openUrl = destination
      ? `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${encodeURIComponent(destination)}&travelmode=driving`
      : `https://www.google.com/maps?q=${origin}`;
    return (
      <a href={openUrl} target="_blank" rel="noreferrer" className="card block text-center text-sm text-blue-500 hover:underline">
        {destination ? "Open the rider's route in Google Maps →" : "Open the rider's live location in Google Maps →"}
      </a>
    );
  }

  return (
    <div className="space-y-1.5">
      <div ref={mapContainerRef} className="h-80 w-full rounded-xl border border-slate-200 sm:h-96" />
      {staleness && <p className="text-right text-[11px] text-slate-400">{staleness}</p>}
    </div>
  );
}
