"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";

export type LatLng = { lat: number; lng: number };

type SearchResult = { placeId: number; label: string; lat: number; lng: number };

// Metro Manila — where the map opens before the customer has searched or
// pinned anything.
const DEFAULT_CENTER: LatLng = { lat: 14.5995, lng: 120.9842 };

// OpenStreetMap's free Nominatim geocoder — no API key needed, which is why
// the demo uses it instead of Google Places. Its usage policy caps traffic
// at ~1 request/second, so searches are debounced below.
const NOMINATIM = "https://nominatim.openstreetmap.org";

async function searchPlaces(query: string, signal: AbortSignal): Promise<SearchResult[]> {
  const url = `${NOMINATIM}/search?format=jsonv2&countrycodes=ph&limit=6&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { signal, headers: { "Accept-Language": "en" } });
  if (!res.ok) return [];
  const rows: { place_id: number; display_name: string; lat: string; lon: string }[] = await res.json();
  return rows.map((r) => ({ placeId: r.place_id, label: r.display_name, lat: Number(r.lat), lng: Number(r.lon) }));
}

async function reverseGeocode(pos: LatLng): Promise<string | null> {
  try {
    const res = await fetch(`${NOMINATIM}/reverse?format=jsonv2&zoom=18&lat=${pos.lat}&lon=${pos.lng}`, {
      headers: { "Accept-Language": "en" },
    });
    if (!res.ok) return null;
    const row: { display_name?: string } = await res.json();
    return row.display_name ?? null;
  } catch {
    return null;
  }
}

export function pinIcon(L: typeof import("leaflet"), emoji: string, bg: string) {
  return L.divIcon({
    className: "",
    html: `<div style="display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:9999px 9999px 9999px 0;transform:rotate(-45deg);background:${bg};border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)"><span style="transform:rotate(45deg);font-size:18px;line-height:1">${emoji}</span></div>`,
    iconSize: [36, 36],
    // The rotated square's sharp corner sits ~43px below the box top, centred.
    iconAnchor: [18, 43],
    tooltipAnchor: [0, -30],
  });
}

const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

// Search box + map where the customer drops a pin on their exact location.
// The pin can be placed from a search result, by tapping the map, by
// dragging it, or from the phone's GPS ("Use my current location").
//
// Uses Google Maps + Places search when NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is
// set — Google finds exact PH house/street addresses that OpenStreetMap's
// search often can't — and falls back to the key-less OpenStreetMap
// version otherwise.
export default function LocationPinMap(props: { value: LatLng | null; onChange: (pos: LatLng, address: string | null) => void }) {
  return GOOGLE_MAPS_KEY ? <GooglePinMap {...props} /> : <OsmPinMap {...props} />;
}

// Minimal slice of the Maps JS API used below — kept local (not a global
// Window augmentation) so it can't collide with HomeServiceForm.tsx's own
// narrower `window.google` typing for the Street autocomplete.
type GLatLng = { lat: () => number; lng: () => number };
type GMap = {
  addListener: (event: string, cb: (e: { latLng: GLatLng }) => void) => void;
  setCenter: (pos: LatLng) => void;
  setZoom: (z: number) => void;
  panTo: (pos: LatLng) => void;
};
type GMarker = {
  setPosition: (pos: LatLng) => void;
  getPosition: () => GLatLng | null;
  addListener: (event: string, cb: () => void) => void;
};
type GAutocomplete = {
  addListener: (event: string, cb: () => void) => void;
  getPlace: () => { formatted_address?: string; name?: string; geometry?: { location: GLatLng } };
};
type GoogleNs = {
  maps: {
    Map: new (el: HTMLElement, opts: Record<string, unknown>) => GMap;
    Marker: new (opts: Record<string, unknown>) => GMarker;
    places: { Autocomplete: new (input: HTMLInputElement, opts?: Record<string, unknown>) => GAutocomplete };
  };
};

// Same script tag (id + libraries) the Street autocomplete in
// HomeServiceForm.tsx loads, so the two share one copy of the API.
function loadGoogleMaps(onReady: () => void) {
  const w = window as unknown as { google?: GoogleNs };
  if (w.google?.maps?.places) {
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

function requestCurrentPosition(onPos: (pos: LatLng) => void, onError: (msg: string) => void) {
  if (!navigator.geolocation) {
    onError("This browser can't share your location.");
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (p) => onPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
    (err) => onError(err.code === err.PERMISSION_DENIED ? "Location permission was denied." : "Couldn't get your location. Try searching instead."),
    { enableHighAccuracy: true, timeout: 15000 }
  );
}

function GooglePinMap({ value, onChange }: { value: LatLng | null; onChange: (pos: LatLng, address: string | null) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<GMap | null>(null);
  const markerRef = useRef<GMarker | null>(null);
  const googleRef = useRef<GoogleNs | null>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });
  const [ready, setReady] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  useEffect(() => {
    loadGoogleMaps(() => setReady(true));
  }, []);

  function showMarker(pos: LatLng, zoom?: number) {
    const g = googleRef.current;
    const map = mapRef.current;
    if (!g || !map) return;
    if (!markerRef.current) {
      const marker = new g.maps.Marker({ position: pos, map, draggable: true });
      marker.addListener("dragend", () => {
        const p = marker.getPosition();
        if (p) placePin({ lat: p.lat(), lng: p.lng() }, null);
      });
      markerRef.current = marker;
    } else {
      markerRef.current.setPosition(pos);
    }
    if (zoom) {
      map.setCenter(pos);
      map.setZoom(zoom);
    } else {
      map.panTo(pos);
    }
  }

  function placePin(pos: LatLng, knownAddress: string | null, zoom?: number) {
    if (!mapRef.current) return;
    showMarker(pos, zoom);
    onChangeRef.current(pos, knownAddress);
    if (!knownAddress) {
      reverseGeocode(pos).then((addr) => {
        const cur = markerRef.current?.getPosition();
        if (cur && cur.lat() === pos.lat && cur.lng() === pos.lng) onChangeRef.current(pos, addr);
      });
    }
  }

  useEffect(() => {
    if (!ready || !containerRef.current || !searchRef.current || mapRef.current) return;
    const g = (window as unknown as { google: GoogleNs }).google;
    googleRef.current = g;
    const map = new g.maps.Map(containerRef.current, {
      center: value ?? DEFAULT_CENTER,
      zoom: value ? 17 : 12,
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: false,
      gestureHandling: "greedy",
    });
    mapRef.current = map;
    map.addListener("click", (e) => placePin({ lat: e.latLng.lat(), lng: e.latLng.lng() }, null));
    if (value) showMarker(value);

    const autocomplete = new g.maps.places.Autocomplete(searchRef.current, {
      componentRestrictions: { country: "ph" },
      fields: ["formatted_address", "name", "geometry"],
    });
    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      const loc = place.geometry?.location;
      if (!loc) return;
      placePin({ lat: loc.lat(), lng: loc.lng() }, place.formatted_address ?? place.name ?? null, 18);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-time map setup
  }, [ready]);

  // Follow position changes made outside this map (e.g. the Street field's
  // own Google autocomplete on the Home Service form).
  useEffect(() => {
    if (!value || !mapRef.current) return;
    const cur = markerRef.current?.getPosition();
    if (!cur || cur.lat() !== value.lat || cur.lng() !== value.lng) showMarker(value, 17);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="space-y-2">
      <input
        ref={searchRef}
        type="text"
        placeholder="Search your exact address, building, or landmark"
        className="input w-full"
        aria-label="Search your location"
        onKeyDown={(e) => {
          // Inside the Home Service <form>, Enter would submit the booking
          // instead of picking the highlighted suggestion.
          if (e.key === "Enter") e.preventDefault();
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={locating || !ready}
          className="btn-secondary !px-3 !py-1.5 text-xs"
          onClick={() => {
            setLocating(true);
            setGeoError(null);
            requestCurrentPosition(
              (pos) => {
                setLocating(false);
                placePin(pos, null, 18);
              },
              (msg) => {
                setLocating(false);
                setGeoError(msg);
              }
            );
          }}
        >
          {locating ? "Locating…" : "📍 Use my current location"}
        </button>
        <p className="text-xs text-slate-400">Tap the map or drag the pin to adjust.</p>
      </div>
      {geoError && <p className="text-xs text-red-600">{geoError}</p>}
      <div ref={containerRef} className="h-80 w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100" />
    </div>
  );
}

function OsmPinMap({
  value,
  onChange,
}: {
  value: LatLng | null;
  onChange: (pos: LatLng, address: string | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const queryReady = query.trim().length >= 3;
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  // Leaflet touches `window` on import, so it's loaded client-side only.
  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;
      leafletRef.current = L;
      const map = L.map(containerRef.current, { zoomControl: true }).setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], 12);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);
      map.on("click", (e) => placePin({ lat: e.latlng.lat, lng: e.latlng.lng }, null));
      mapRef.current = map;
    });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Draws/moves the marker only — no onChange. Shared by customer actions
  // (placePin) and by the parent setting `value` from elsewhere.
  function showMarker(pos: LatLng, zoom?: number) {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    if (!markerRef.current) {
      const marker = L.marker([pos.lat, pos.lng], { draggable: true, icon: pinIcon(L, "🏠", "#0071e3") }).addTo(map);
      marker.on("dragend", () => {
        const p = marker.getLatLng();
        placePin({ lat: p.lat, lng: p.lng }, null);
      });
      markerRef.current = marker;
    } else {
      markerRef.current.setLatLng([pos.lat, pos.lng]);
    }
    if (zoom) map.setView([pos.lat, pos.lng], zoom);
    else map.panTo([pos.lat, pos.lng]);
  }

  function placePin(pos: LatLng, knownAddress: string | null, zoom?: number) {
    if (!leafletRef.current || !mapRef.current) return;
    showMarker(pos, zoom);
    onChangeRef.current(pos, knownAddress);
    if (!knownAddress) {
      reverseGeocode(pos).then((addr) => {
        // Only apply if the pin hasn't moved again since.
        const cur = markerRef.current?.getLatLng();
        if (cur && cur.lat === pos.lat && cur.lng === pos.lng) onChangeRef.current(pos, addr);
      });
    }
  }

  // Keep the pin in sync when the parent changes the position itself
  // (e.g. a reset, or the Google address autocomplete on the real form).
  useEffect(() => {
    if (!value) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    const cur = markerRef.current?.getLatLng();
    if (!cur || cur.lat !== value.lat || cur.lng !== value.lng) showMarker(value, 17);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setSearching(true);
      searchPlaces(q, controller.signal)
        .then((r) => {
          setResults(r);
          setShowResults(true);
        })
        .catch(() => {})
        .finally(() => setSearching(false));
    }, 700);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  function useMyLocation() {
    setLocating(true);
    setGeoError(null);
    requestCurrentPosition(
      (pos) => {
        setLocating(false);
        placePin(pos, null, 17);
      },
      (msg) => {
        setLocating(false);
        setGeoError(msg);
      }
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setShowResults(true)}
          onKeyDown={(e) => {
            // Inside the Home Service <form>, Enter would submit the booking.
            if (e.key === "Enter") e.preventDefault();
          }}
          placeholder="Search your street, barangay, subdivision, or landmark"
          className="input w-full"
          aria-label="Search your location"
        />
        {searching && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">Searching…</span>}
        {showResults && queryReady && results.length > 0 && (
          <ul className="absolute z-[1000] mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
            {results.map((r) => (
              <li key={r.placeId}>
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-blue-50"
                  onClick={() => {
                    setShowResults(false);
                    placePin({ lat: r.lat, lng: r.lng }, r.label, 17);
                  }}
                >
                  {r.label}
                </button>
              </li>
            ))}
          </ul>
        )}
        {showResults && !searching && queryReady && results.length === 0 && (
          <p className="mt-1 text-xs text-slate-400">No matches — try a nearby landmark, or tap the map to drop the pin.</p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={useMyLocation} disabled={locating} className="btn-secondary !px-3 !py-1.5 text-xs">
          {locating ? "Locating…" : "📍 Use my current location"}
        </button>
        <p className="text-xs text-slate-400">Tap the map or drag the pin to adjust.</p>
      </div>
      {geoError && <p className="text-xs text-red-600">{geoError}</p>}

      <div ref={containerRef} className="relative z-0 h-80 w-full overflow-hidden rounded-xl border border-slate-200" />
    </div>
  );
}
