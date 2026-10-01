import { headers } from "next/headers";

// True when this request came from the wrapped native Capacitor customer
// app (capacitor.config.ts's appendUserAgent: "CeejayCustomerApp"), not a
// regular browser hitting the same public URL — the server-side mirror of
// the client-side check in components/site/AppChrome.tsx. Lets
// PICKUP_DELIVERY_MOBILE_ENABLED's "soft launch through the app only" apply
// to server-rendered pages like app/app-home and app/my too, the same way
// it already gates the booking action (lib/actions.ts) and the native
// app's own /api/mobile/config.
export async function isCeejayCustomerApp(): Promise<boolean> {
  const ua = (await headers()).get("user-agent") ?? "";
  return ua.includes("CeejayCustomerApp");
}
