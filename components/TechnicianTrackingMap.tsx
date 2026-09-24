"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker, Polyline } from "leaflet";
import "leaflet/dist/leaflet.css";
import { pinIcon, type LatLng } from "./LocationPinMap";

// Customer-facing live map: the customer's pinned home, the technician's
// current position, and the road route between them. Purely
// presentational — whoever renders it feeds in fresh positions (the demo
// page simulates them; TechnicianTrackingView polls the technician's GPS).
export default function TechnicianTrackingMap({
  customer,
  technician,
  route,
  customerLabel = "Your location",
}: {
  customer: LatLng | null;
  technician: LatLng | null;
  route: LatLng[];
  customerLabel?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const customerMarkerRef = useRef<Marker | null>(null);
  const techMarkerRef = useRef<Marker | null>(null);
  const routeLineRef = useRef<Polyline | null>(null);
  const [ready, setReady] = useState(false);
  const [follow, setFollow] = useState(true);
  // First fit snaps straight to both markers; later ones animate.
  const fittedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;
      leafletRef.current = L;
      const start = customer ?? technician ?? { lat: 14.5995, lng: 120.9842 };
      const map = L.map(containerRef.current).setView([start.lat, start.lng], 14);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);
      // Once the customer pans/zooms themselves, stop yanking the view back.
      map.on("dragstart", () => setFollow(false));
      mapRef.current = map;
      setReady(true);
    });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      customerMarkerRef.current = null;
      techMarkerRef.current = null;
      routeLineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!ready || !L || !map || !customer) return;
    if (!customerMarkerRef.current) {
      customerMarkerRef.current = L.marker([customer.lat, customer.lng], { icon: pinIcon(L, "🏠", "#0071e3") })
        .bindTooltip(customerLabel)
        .addTo(map);
    } else {
      customerMarkerRef.current.setLatLng([customer.lat, customer.lng]);
    }
  }, [ready, customer, customerLabel]);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!ready || !L || !map) return;
    routeLineRef.current?.remove();
    routeLineRef.current = route.length > 1
      ? L.polyline(route.map((p) => [p.lat, p.lng] as [number, number]), { color: "#0071e3", weight: 5, opacity: 0.6 }).addTo(map)
      : null;
  }, [ready, route]);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!ready || !L || !map) return;
    if (!technician) {
      techMarkerRef.current?.remove();
      techMarkerRef.current = null;
      return;
    }
    if (!techMarkerRef.current) {
      techMarkerRef.current = L.marker([technician.lat, technician.lng], {
        icon: pinIcon(L, "🛵", "#f97316"),
        zIndexOffset: 1000,
      })
        .bindTooltip("Technician")
        .addTo(map);
    } else {
      techMarkerRef.current.setLatLng([technician.lat, technician.lng]);
    }
    if (follow) {
      if (customer) {
        map.fitBounds(
          L.latLngBounds([
            [technician.lat, technician.lng],
            [customer.lat, customer.lng],
          ]),
          { padding: [50, 50], maxZoom: 17, animate: fittedRef.current }
        );
      } else {
        map.setView([technician.lat, technician.lng], 16, { animate: fittedRef.current });
      }
      fittedRef.current = true;
    }
  }, [ready, technician, customer, follow]);

  return (
    <div className="relative">
      <div ref={containerRef} className="relative z-0 h-96 w-full overflow-hidden rounded-xl border border-slate-200" />
      {!follow && (
        <button
          type="button"
          onClick={() => setFollow(true)}
          className="btn-secondary absolute bottom-3 right-3 z-[500] !px-3 !py-1.5 text-xs shadow"
        >
          Re-center
        </button>
      )}
    </div>
  );
}
