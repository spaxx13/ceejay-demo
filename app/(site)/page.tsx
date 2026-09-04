import Link from "next/link";
import { getSiteContent, getLookups, getBranches } from "@/lib/db";
import InShopIllustration from "@/components/site/InShopIllustration";
import HomeServiceIllustration from "@/components/site/HomeServiceIllustration";

// Kept selectable on the Home Service request form, but not shown here —
// near-duplicates of "Camera" and "Backhousing(...)", which already cover
// the general listing. Matches app/(site)/services/page.tsx.
const HIDDEN_FROM_PUBLIC = new Set(["Camera replacement", "Back Housing (whole shell)"]);

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
          <p className="kicker">Two Ways to Get Fixed</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">However works for you</h2>
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="card overflow-hidden !p-0">
            <InShopIllustration className="w-full" />
            <div className="p-6">
              <p className="font-semibold text-slate-800">Visit a Branch</p>
              <p className="mt-1.5 text-sm text-slate-400">
                Walk in for a free diagnostic and same-day repair at any of our branches — no appointment needed.
              </p>
              <Link href="/branches" className="mt-4 inline-block text-sm text-blue-500 hover:underline">
                Find a branch →
              </Link>
            </div>
          </div>
          <div className="card overflow-hidden !p-0">
            <HomeServiceIllustration className="w-full" />
            <div className="p-6">
              <p className="font-semibold text-slate-800">We Come to You</p>
              <p className="mt-1.5 text-sm text-slate-400">
                Book a technician to your doorstep. Same repair quality, zero travel — just tell us where and when.
              </p>
              <Link href="/request" className="mt-4 inline-block text-sm text-blue-500 hover:underline">
                Book home service →
              </Link>
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

      <section className="px-4 pb-20 sm:px-6">
        <div className="card mx-auto flex max-w-4xl flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <p className="text-lg font-semibold text-slate-800">{sc.ctaBannerTitle}</p>
            <p className="mt-1 text-sm text-slate-400">{sc.ctaBannerSubtitle}</p>
          </div>
          <Link href="/request" className="btn-primary shrink-0">
            {sc.ctaBannerButtonLabel}
          </Link>
        </div>
      </section>
    </main>
  );
}
