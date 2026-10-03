"use client";

// One-tap turn-by-turn navigation for riders. The plain
// https://www.google.com/maps/dir/?api=1 link opens the Google Maps app on
// iPhone but leaves it sitting on the directions *input* screen ("Your
// location → Dropped pin") instead of showing the route. The app's own
// URL scheme (comgooglemaps://?daddr=…) goes straight to the route; if the
// app isn't installed the scheme does nothing, so after a moment we fall
// back to the legacy maps.google.com?daddr= link, which the website (and
// Android) reliably turns into a route. Waze is offered too — most riders
// here ride with it.
export default function NavigateButtons({
  lat,
  lng,
  address,
  label = "Navigate",
}: {
  lat: number | null;
  lng: number | null;
  address: string;
  label?: string;
}) {
  const hasPin = lat !== null && lng !== null;
  const dest = hasPin ? `${lat},${lng}` : address;
  const encoded = encodeURIComponent(dest);
  const googleApp = `comgooglemaps://?daddr=${encoded}&directionsmode=driving`;
  const googleWeb = `https://maps.google.com/maps?daddr=${encoded}&dirflg=d`;
  const waze = hasPin ? `https://waze.com/ul?ll=${lat},${lng}&navigate=yes` : `https://waze.com/ul?q=${encoded}&navigate=yes`;

  function openGoogle(e: React.MouseEvent<HTMLAnchorElement>) {
    const ua = navigator.userAgent;
    const isIos = /iPhone|iPad|iPod/i.test(ua);
    if (!isIos) return; // Android + desktop: the https link already opens the app/route
    e.preventDefault();
    // Try the app; if we're still here (app not installed), open the web route.
    const start = Date.now();
    const timer = window.setTimeout(() => {
      if (Date.now() - start < 2500 && document.visibilityState === "visible") window.location.href = googleWeb;
    }, 1200);
    window.addEventListener("pagehide", () => window.clearTimeout(timer), { once: true });
    window.location.href = googleApp;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a href={googleWeb} onClick={openGoogle} target="_blank" rel="noopener noreferrer" className="btn-primary inline-block !px-3 !py-1.5 text-xs">
        📍 {label} (Google Maps)
      </a>
      <a href={waze} target="_blank" rel="noopener noreferrer" className="btn-secondary inline-block !px-3 !py-1.5 text-xs">
        Waze
      </a>
      {!hasPin && <span className="text-[11px] text-amber-700">address only — customer set no pin</span>}
    </div>
  );
}
