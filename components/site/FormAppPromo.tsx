"use client";

import { useSyncExternalStore } from "react";
import { APP_STORE_URL } from "@/lib/config";
import AppStoreButton from "@/components/site/AppStoreButton";

function subscribeNever() {
  return () => {};
}
function isInsideApp() {
  return navigator.userAgent.includes("CeejayCustomerApp") || navigator.userAgent.includes("CeejayAdminApp");
}

// Compact "use the app instead" strip shown above the public forms.
// Renders nothing while NEXT_PUBLIC_APP_STORE_URL is unset or inside the apps.
export default function FormAppPromo() {
  const inApp = useSyncExternalStore(subscribeNever, isInsideApp, () => false);
  if (!APP_STORE_URL || inApp) return null;
  return (
    <div className="mx-auto mb-6 max-w-2xl">
      <div className="card flex flex-col items-center gap-3 !py-4 text-center sm:flex-row sm:justify-between sm:text-left">
        <div>
          <p className="text-sm font-semibold text-slate-800">Mas mabilis sa Ceejay app</p>
          <p className="mt-0.5 text-xs text-slate-400">I-book, i-track, at tumanggap ng updates mula sa iyong iPhone.</p>
        </div>
        <AppStoreButton className="shrink-0 !py-1.5" />
      </div>
    </div>
  );
}
