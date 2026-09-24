import Image from "next/image";
import Link from "next/link";
import { getCurrentCustomer } from "@/lib/customerAuth";

// Dedicated entry screen for the Ceejay mobile app (Capacitor wraps this
// page, not the full marketing site) — just the two booking flows the app
// exists for, no header/footer/nav out to the rest of the website. The
// full site (branches, walk-in, quote, admin, etc.) is still reachable
// from a browser as normal; this page is only ever the app's start screen.
export default async function AppHomePage() {
  const customer = await getCurrentCustomer();

  return (
    <main className="grid-bg flex min-h-screen flex-col items-center justify-center px-4 py-10 pb-20 sm:px-6">
      <div className="mx-auto w-full max-w-sm space-y-8 text-center">
        <div className="space-y-3">
          <Image src="/contact-widget-icon.png" alt="Ceejay" width={88} height={88} className="mx-auto rounded-2xl" priority />
          <h1 className="text-2xl font-bold text-slate-900">Ceejay Cellphone Repair Shop</h1>
          <p className="text-sm text-slate-400">How would you like your repair handled?</p>
        </div>

        <div className="space-y-4">
          <Link href="/request" className="card block space-y-1 text-left transition hover:border-blue-300 hover:shadow-md">
            <p className="text-lg font-semibold text-slate-900">🚚 Home Service</p>
            <p className="text-sm text-slate-400">A technician comes to your address to repair your device.</p>
          </Link>
          <Link href="/pickup-delivery" className="card block space-y-1 text-left transition hover:border-blue-300 hover:shadow-md">
            <p className="text-lg font-semibold text-slate-900">📦 Pick-up &amp; Delivery</p>
            <p className="text-sm text-slate-400">A rider picks up your device, we repair it at the shop, then deliver it back.</p>
          </Link>
        </div>

        {/* A padded block (not a bare text link) — a thin one-line link sitting
            this close to the bottom of the screen is a easy to miss / hard to
            tap precisely on a real phone, especially near the home indicator
            gesture area on notched iPhones. */}
        <Link
          href={customer ? "/my" : "/my/login"}
          className="block rounded-xl px-4 py-3 text-sm font-semibold text-blue-600 hover:bg-blue-50 hover:underline"
        >
          {customer ? `👤 My Bookings — Hi, ${customer.name.split(" ")[0] || "there"}` : "👤 Sign In to Track Your Repair"}
        </Link>
      </div>
    </main>
  );
}
