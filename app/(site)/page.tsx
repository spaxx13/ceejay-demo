import Link from "next/link";
import { getSiteContent, getLookups, getBranches } from "@/lib/db";
import { PICKUP_DELIVERY_PUBLIC_ENABLED } from "@/lib/config";
import InShopIllustration from "@/components/site/InShopIllustration";
import HomeServiceIllustration from "@/components/site/HomeServiceIllustration";
import PickupDeliveryIllustration from "@/components/site/PickupDeliveryIllustration";

// Kept selectable on the Home Service request form, but not shown here —
// near-duplicates of "Camera" and "Backhousing(...)", which already cover
// the general listing. Matches app/(site)/services/page.tsx.
const HIDDEN_FROM_PUBLIC = new Set(["Camera replacement", "Back Housing (whole shell)"]);

// Small glyph set for the feature tags/list below — just enough to tell the
// three "how it works" cards' highlights apart at a glance, not a general
// icon library.
const TAG_ICONS = {
  check: "M4 10.5 8 14.5 16 6",
  clock: "M10 5.5V10l3 2M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z",
  device: "M7 3.5h6a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1Z M10 14h0",
  calendar: "M4 8.5h12M6 3.5v2M14 3.5v2M5 5.5h10a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Z",
  pin: "M10 18s6-5.2 6-9.5a6 6 0 1 0-12 0C4 12.8 10 18 10 18Z M10 11a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  wrench: "M13.7 6.3a3.5 3.5 0 0 1-4.6 4.6l-5 5a1.4 1.4 0 0 0 2 2l5-5a3.5 3.5 0 0 1 4.6-4.6l-2.3 2.3-2-2 2.3-2.3Z",
} as const;
type TagIcon = keyof typeof TAG_ICONS;

function TagGlyph({ icon }: { icon: TagIcon }) {
  return (
    <svg viewBox="0 0 20 20" className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d={TAG_ICONS[icon]} />
    </svg>
  );
}

function FeatureTag({ icon, children }: { icon: TagIcon; children: React.ReactNode }) {
  return (
    <span className="badge border-blue-200 bg-blue-50 text-blue-700">
      <TagGlyph icon={icon} />
      {children}
    </span>
  );
}

function FeatureListItem({ icon, children }: { icon: TagIcon; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2 text-sm text-slate-500">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-500">
        <TagGlyph icon={icon} />
      </span>
      {children}
    </li>
  );
}

export default async function HomePage() {
  const [sc, lookups, allBranches] = await Promise.all([getSiteContent(), getLookups(), getBranches()]);
  const serviceTypes = lookups
    .filter((l) => l.kind === "service_type" && l.active && !HIDDEN_FROM_PUBLIC.has(l.label))
    .sort((a, b) => a.order - b.order)
    .slice(0, 6);
  // A branch without an address is a backend-only bucket (e.g. "Home
  // Service", used to attribute technician sales) rather than a walk-in
  // location — keep those off the public site.
  const branches = allBranches.filter((b) => b.active && b.address.trim()).slice(0, 3);

  return (
    <main>
      <section className="grid-bg px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <p className="kicker">{sc.heroKicker}</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-900 sm:text-6xl">
            {sc.heroHeadlinePrefix} <span className="brand-gradient-text">{sc.heroHeadlineHighlight}</span> {sc.heroHeadlineSuffix}
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm text-slate-400 sm:text-base">{sc.heroSubtext}</p>
          <div className="mt-8 flex justify-center">
            <Link href="/branches" className="btn-secondary">
              {sc.secondaryCtaLabel}
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="mb-10 text-center">
          <p className="kicker">However Works For You</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">Three ways to get fixed</h2>
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="card flex flex-col overflow-hidden !p-0">
            <InShopIllustration className="w-full" />
            <div className="flex flex-1 flex-col p-6">
              <p className="font-semibold text-slate-800">Visit a Branch</p>
              <p className="mt-1.5 text-sm text-slate-400">
                Walk in for a free diagnostic and same-day repair at any of our branches. No appointment needed.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <FeatureTag icon="check">Free diagnostic</FeatureTag>
                <FeatureTag icon="clock">Same-day repair</FeatureTag>
                <FeatureTag icon="device">Screen, battery, charging</FeatureTag>
              </div>
              <div className="mt-auto space-y-2 pt-5">
                <Link href="/walk-in" className="btn-secondary block w-full text-center">
                  Pre-register your visit
                </Link>
                <Link href="/branches" className="block text-center text-sm text-blue-500 hover:underline">
                  Find a branch →
                </Link>
              </div>
            </div>
          </div>
          <div className="card flex flex-col overflow-hidden !p-0">
            <HomeServiceIllustration className="w-full" />
            <div className="flex flex-1 flex-col p-6">
              <p className="font-semibold text-slate-800">We Come to You</p>
              <p className="mt-1.5 text-sm text-slate-400">
                Book a technician to your doorstep. Same repair quality, zero travel — just tell us where and when.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <FeatureTag icon="calendar">Daily</FeatureTag>
                <FeatureTag icon="pin">Nationwide</FeatureTag>
                <FeatureTag icon="wrench">Repair at your door</FeatureTag>
              </div>
              <div className="mt-auto pt-5">
                <Link href="/request" className="btn-secondary block w-full text-center">
                  Book home service
                </Link>
              </div>
            </div>
          </div>
          <div className="card flex flex-col overflow-hidden !p-0">
            <div className="relative">
              <PickupDeliveryIllustration className="w-full" />
              {!PICKUP_DELIVERY_PUBLIC_ENABLED && (
                <span className="badge absolute right-4 top-4 border border-amber-200 bg-amber-50 text-amber-700">Soon</span>
              )}
            </div>
            <div className="flex flex-1 flex-col p-6">
              <p className="font-semibold text-slate-800">Pickup &amp; Delivery</p>
              <p className="mt-1.5 text-sm text-slate-400">
                Too busy to wait around? A rider picks up your device, we repair it at the shop, then a rider brings it back to you.
              </p>
              <ul className="mt-3 space-y-1.5">
                <FeatureListItem icon="pin">Rider picks up your phone</FeatureListItem>
                <FeatureListItem icon="wrench">Repaired at our branch</FeatureListItem>
                <FeatureListItem icon="check">Delivered back, good as new</FeatureListItem>
              </ul>
              <div className="mt-auto pt-5">
                {PICKUP_DELIVERY_PUBLIC_ENABLED ? (
                  <Link href="/pickup-delivery" className="btn-secondary block w-full text-center">
                    Book pickup &amp; delivery →
                  </Link>
                ) : (
                  <span className="btn-secondary block w-full cursor-not-allowed text-center opacity-50">Book pickup &amp; delivery →</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="kicker">What We Fix</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">Services</h2>
          </div>
          <Link href="/services" className="text-sm text-blue-300 hover:underline">
            View all services →
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {serviceTypes.length === 0 && <p className="text-sm text-slate-400">Services coming soon.</p>}
          {serviceTypes.map((s) => (
            <div key={s.id} className="card">
              <p className="font-semibold text-slate-800">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="kicker">Visit Us</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">Our Branches</h2>
          </div>
          <Link href="/branches" className="text-sm text-blue-300 hover:underline">
            View all branches →
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {branches.map((b) => (
            <div key={b.id} className="card">
              <p className="font-semibold text-slate-800">{b.name}</p>
              <p className="mt-1 text-sm text-slate-400">{b.address}</p>
              <p className="mt-2 text-sm text-blue-300">{b.contactNumber}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4 px-4 pb-20 sm:px-6">
        <div className="card mx-auto flex max-w-4xl flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <p className="text-lg font-semibold text-slate-800">Bringing your device in?</p>
            <p className="mt-1 text-sm text-slate-400">Pre-register your walk-in so the branch can be ready when you arrive.</p>
          </div>
          <Link href="/walk-in" className="btn-primary shrink-0">
            Pre-Register Visit
          </Link>
        </div>
        <div className="card mx-auto flex max-w-4xl flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <p className="text-lg font-semibold text-slate-800">{sc.ctaBannerTitle}</p>
            <p className="mt-1 text-sm text-slate-400">{sc.ctaBannerSubtitle}</p>
          </div>
          <Link href="/request" className="btn-primary shrink-0">
            {sc.ctaBannerButtonLabel}
          </Link>
        </div>
        {PICKUP_DELIVERY_PUBLIC_ENABLED && (
          <div className="card mx-auto flex max-w-4xl flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
            <div>
              <p className="text-lg font-semibold text-slate-800">Too busy to wait around?</p>
              <p className="mt-1 text-sm text-slate-400">A rider picks up your device, we repair it at the shop, then a rider brings it back to you.</p>
            </div>
            <Link href="/pickup-delivery" className="btn-primary shrink-0">
              Book Pickup &amp; Delivery
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
