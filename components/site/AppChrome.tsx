"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

type AppKind = "customer" | "admin" | "none";

// The Ceejay customer and admin apps (capacitor.config.ts's
// appendUserAgent) tag their own requests so this can skip the marketing
// header/footer/contact widget for them, so ending up here inside an app
// doesn't detour through the whole website's navigation. Reading it via
// useSyncExternalStore (not headers() on the server, and not
// useEffect+setState) keeps this a plain client value: the server always
// renders the regular site chrome (getServerAppKindSnapshot), which is what
// lets app/(site)/layout.tsx stay static instead of opting the entire
// public site into per-request dynamic rendering. The one cost is the two
// apps briefly seeing the full site chrome until this corrects itself right
// after hydration — a fixed, tiny cost paid only inside those two apps, not
// on every visit to the public site.
function subscribeNever() {
  return () => {};
}
function getAppKindSnapshot(): AppKind {
  const ua = navigator.userAgent;
  if (ua.includes("CeejayCustomerApp")) return "customer";
  if (ua.includes("CeejayAdminApp")) return "admin";
  return "none";
}
function getServerAppKindSnapshot(): AppKind {
  return "none";
}

export default function AppChrome({
  children,
  header,
  footer,
  contactWidget,
}: {
  children: React.ReactNode;
  header: React.ReactNode;
  footer: React.ReactNode;
  contactWidget: React.ReactNode;
}) {
  const appKind = useSyncExternalStore(subscribeNever, getAppKindSnapshot, getServerAppKindSnapshot);

  if (appKind !== "none") {
    // With no header/footer, a page under here would otherwise be a dead
    // end — this is the app's one consistent way back, same destination
    // from anywhere.
    return (
      <div className="min-h-screen">
        <div className="px-4 sm:px-6" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}>
          <Link href={appKind === "admin" ? "/admin" : "/app-home"} className="inline-block text-sm text-slate-400 hover:underline">
            ← Back
          </Link>
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      {header}
      <div className="flex-1">{children}</div>
      {footer}
      {contactWidget}
    </div>
  );
}
