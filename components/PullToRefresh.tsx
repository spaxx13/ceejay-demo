"use client";

import { useEffect, useRef, useState } from "react";

const THRESHOLD = 40;

// A standalone (installed-to-Home-Screen) PWA has no browser chrome, so it
// also has none of the browser's own pull-to-refresh gesture — the only way
// to force a truly fresh load was logging out and back in. This adds that
// gesture back, but only in standalone mode; inside a normal browser tab the
// platform's own pull-to-refresh already covers it, so the listeners below
// never attach there and this component stays inert.
export default function PullToRefresh({ children }: { children: React.ReactNode }) {
  const [distance, setDistance] = useState(0);
  const startY = useRef<number | null>(null);
  const distanceRef = useRef(0);
  const refreshing = useRef(false);

  useEffect(() => {
    const nav = window.navigator as Navigator & { standalone?: boolean };
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
    if (!isStandalone) return;

    function onTouchStart(e: TouchEvent) {
      if (window.scrollY > 0 || refreshing.current) return;
      startY.current = e.touches[0].clientY;
    }
    function onTouchMove(e: TouchEvent) {
      if (startY.current === null || refreshing.current) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta > 0 && window.scrollY === 0) {
        const d = Math.min(delta, 120);
        distanceRef.current = d;
        setDistance(d);
      }
    }
    function onTouchEnd() {
      if (startY.current === null) return;
      startY.current = null;
      if (distanceRef.current > THRESHOLD && !refreshing.current) {
        refreshing.current = true;
        window.location.reload();
        return;
      }
      distanceRef.current = 0;
      setDistance(0);
    }

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  return (
    <>
      <div
        aria-hidden="true"
        style={{
          height: distance,
          transition: distance === 0 ? "height 0.2s ease" : undefined,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          color: "#0071e3",
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        {distance > 0 && (distance > THRESHOLD ? "Release to refresh ↻" : "Pull to refresh ↓")}
      </div>
      {children}
    </>
  );
}
