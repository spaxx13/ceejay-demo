"use client";

import { useEffect, useRef, useState } from "react";

// Minimal surface of the Maps JS API this component actually touches —
// kept narrow and local (not a global Window augmentation) so it can't
// collide with the separate, narrower `window.google` typing already
// declared in HomeServiceForm.tsx for Places Autocomplete.
type GMap = { addListener: (event: string, cb: (e: { latLng: { lat: () => number; lng: () => number } }) => void) => void };
type GMarker = {
  setPosition: (pos: { lat: number; lng: number }) => void;
  getPosition: () => { lat: () => number; lng: () => number } | null;
  addListener: (event: string, cb: () => void) => void;
};
type GoogleMapsNamespace = {
  maps: {
    Map: new (el: HTMLElement, opts: Record<string, unknown>) => GMap;
    Marker: new (opts: Record<string, unknown>) => GMarker;
  };
};

const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
const DEFAULT_CENTER = { lat: 14.6042, lng: 121.0509 }; // Metro Manila, roughly centered

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

// A click-to-drop-pin map, used wherever an exact location matters more
// than a typed address string can reliably capture (Admin > Branches, and
// the customer's pickup address on the Pickup & Delivery form) — a plain
// address geocodes to whatever Google thinks is the nearest/most prominent
// match, which is sometimes the wrong building. Returns nothing (renders
// nothing) when no Google Maps key is configured, same graceful-degradation
// convention as the rest of this app's optional Maps features.
//
// Two ways to use it:
// - Uncontrolled (`latName`/`lngName` set): writes its own hidden inputs,
//   read back from FormData on submit — for a plain server-action form
//   with no existing lat/lng state (Admin > Branches).
// - Controlled (`onChange` set): calls back with the picked coordinates
//   instead, for a form that already owns lat/lng in its own state and
//   renders its own hidden inputs (the Pickup & Delivery request form,
//   which already does this for Places Autocomplete).
export default function MapPinPicker({
  latName,
  lngName,
  defaultLat,
  defaultLng,
  label = "Pin your exact location",
  onChange,
}: {
  latName?: string;
  lngName?: string;
  defaultLat?: number | null;
  defaultLng?: number | null;
  label?: string;
  onChange?: (lat: number, lng: number) => void;
}) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const latInputRef = useRef<HTMLInputElement>(null);
  const lngInputRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<GMap | null>(null);
  const markerRef = useRef<GMarker | null>(null);
  const [ready, setReady] = useState(false);
  const [coordsLabel, setCoordsLabel] = useState(
    defaultLat != null && defaultLng != null ? `${defaultLat.toFixed(6)}, ${defaultLng.toFixed(6)}` : ""
  );

  useEffect(() => {
    if (!GOOGLE_MAPS_KEY) return;
    loadGoogleMaps(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ready || !mapContainerRef.current || mapRef.current) return;
    const g = (window as unknown as { google: GoogleMapsNamespace }).google;
    const hasDefault = defaultLat != null && defaultLng != null;
    const start = hasDefault ? { lat: defaultLat as number, lng: defaultLng as number } : DEFAULT_CENTER;

    const map = new g.maps.Map(mapContainerRef.current, {
      center: start,
      zoom: hasDefault ? 16 : 12,
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: false,
    });
    mapRef.current = map;

    function setPosition(lat: number, lng: number) {
      if (latInputRef.current) latInputRef.current.value = String(lat);
      if (lngInputRef.current) lngInputRef.current.value = String(lng);
      setCoordsLabel(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
      onChange?.(lat, lng);
    }

    function placeMarker(pos: { lat: number; lng: number }) {
      if (markerRef.current) {
        markerRef.current.setPosition(pos);
      } else {
        markerRef.current = new g.maps.Marker({ position: pos, map, draggable: true });
        markerRef.current.addListener("dragend", () => {
          const p = markerRef.current?.getPosition();
          if (p) setPosition(p.lat(), p.lng());
        });
      }
      setPosition(pos.lat, pos.lng);
    }

    if (hasDefault) placeMarker(start);

    map.addListener("click", (e) => placeMarker({ lat: e.latLng.lat(), lng: e.latLng.lng() }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only initializes the map once; defaultLat/Lng seed the starting pin, not tracked afterward
  }, [ready]);

  if (!GOOGLE_MAPS_KEY) return null;

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-slate-500">{label}</label>
      <div ref={mapContainerRef} className="h-52 w-full rounded-xl border border-slate-200 bg-slate-100" />
      {latName && lngName && (
        <>
          <input ref={latInputRef} type="hidden" name={latName} defaultValue={defaultLat ?? ""} />
          <input ref={lngInputRef} type="hidden" name={lngName} defaultValue={defaultLng ?? ""} />
        </>
      )}
      <p className="text-[11px] text-slate-400">{coordsLabel ? `Pin set at ${coordsLabel}` : "Click on the map to drop a pin at the exact spot."}</p>
    </div>
  );
}
