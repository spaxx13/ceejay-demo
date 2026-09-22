import Link from "next/link";
import { getLookups, getDeviceModels, getRequestFormContent, getCustomFormFields } from "@/lib/db";
import { PICKUP_DELIVERY_PUBLIC_ENABLED } from "@/lib/config";
import HomeServiceForm from "@/components/HomeServiceForm";
import { smsConfigured } from "@/lib/sms";
import { toPhInternational } from "@/lib/format";
import type { HomeServiceQueue } from "@/lib/types";

// Its own page, separate from the Home Service (on-site) request flow at
// /request — same underlying form/fields/submission action (both are still
// Home Service Requests under the hood), but Pickup & Delivery gets its own
// entry point and copy rather than a toggle buried inside the on-site form.
const AREA_LABELS: Record<HomeServiceQueue, string> = {
  near: "Metro Manila, Laguna, Batangas, Rizal, Bulacan, Cavite, and Pampanga",
  far: "Other Provinces",
};

const AREA_ENABLED_KEY: Record<HomeServiceQueue, "nearAreaEnabled" | "farAreaEnabled"> = {
  near: "nearAreaEnabled",
  far: "farAreaEnabled",
};

export default async function PickupDeliveryPage({ searchParams }: { searchParams: Promise<{ area?: string }> }) {
  if (!PICKUP_DELIVERY_PUBLIC_ENABLED) {
    return (
      <main className="grid-bg px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-xl space-y-4 text-center">
          <p className="kicker">Pickup &amp; Delivery</p>
          <h1 className="text-3xl font-bold text-slate-900">Coming Soon</h1>
          <p className="text-sm text-slate-400">
            We&apos;re still testing this — a rider picking up your device, us repairing it at the shop, then a rider delivering it back to
            you. It&apos;s not bookable yet, but our usual Home Service and walk-in options are ready whenever you are.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Link href="/request" className="btn-primary">
              Book Home Service instead
            </Link>
            <Link href="/branches" className="btn-secondary">
              Find a Branch
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const sp = await searchParams;
  const requestedArea: HomeServiceQueue | null = sp.area === "near" || sp.area === "far" ? sp.area : null;

  const [lookups, deviceModels, content, customFormFields] = await Promise.all([
    getLookups(),
    getDeviceModels(),
    getRequestFormContent(),
    getCustomFormFields(),
  ]);

  const enabledAreas = (Object.keys(AREA_LABELS) as HomeServiceQueue[]).filter((key) => content[AREA_ENABLED_KEY[key]]);
  const area = requestedArea && enabledAreas.includes(requestedArea) ? requestedArea : null;

  if (!area) {
    return (
      <main className="grid-bg px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-xl space-y-6">
          <div className="text-center">
            <p className="kicker">Pickup &amp; Delivery</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">Where&apos;s your device coming from?</h1>
            <p className="mt-2 text-sm text-slate-400">Choose your area so we can route your pickup to the right team.</p>
          </div>
          <div className="space-y-3">
            {enabledAreas.length === 0 && (
              <p className="card text-center text-sm text-slate-400">Pickup &amp; Delivery is temporarily unavailable. Please contact a branch directly.</p>
            )}
            {enabledAreas.map((key) => (
              <Link key={key} href={`/pickup-delivery?area=${key}`} className="card block text-center hover:border-blue-300">
                <p className="text-sm font-semibold text-slate-800">{AREA_LABELS[key]}</p>
              </Link>
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (area === "far") {
    const number = content.farAreaContactNumber.trim();
    const intlNumber = number ? toPhInternational(number) : null;

    return (
      <main className="grid-bg px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-xl space-y-6 text-center">
          <div>
            <p className="kicker">Pickup &amp; Delivery</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">Other Provinces</h1>
            <p className="mt-2 text-sm text-slate-400">
              We don&apos;t have an online form for this area yet — message us directly and we&apos;ll take it from there.
            </p>
            <p className="mt-1 text-xs text-slate-400">
              <Link href="/pickup-delivery" className="text-blue-500 hover:underline">
                Change area
              </Link>
            </p>
          </div>
          {intlNumber ? (
            <div className="space-y-3">
              <a
                href={`https://wa.me/${intlNumber}`}
                target="_blank"
                rel="noreferrer"
                className="card flex items-center justify-center gap-2 !bg-[#25D366] text-white hover:opacity-90"
              >
                <span className="text-sm font-semibold">Message us on WhatsApp</span>
              </a>
              <a
                href={`viber://chat?number=%2B${intlNumber}`}
                className="card flex items-center justify-center gap-2 !bg-[#7360F2] text-white hover:opacity-90"
              >
                <span className="text-sm font-semibold">Message us on Viber</span>
              </a>
            </div>
          ) : (
            <p className="card text-center text-sm text-slate-400">Pickup &amp; Delivery is temporarily unavailable. Please contact a branch directly.</p>
          )}
        </div>
      </main>
    );
  }

  const brands = lookups
    .filter((l) => l.kind === "device_brand" && l.active)
    .sort((a, b) => a.order - b.order)
    .map((l) => ({ id: l.id, label: l.label }));
  const models = deviceModels
    .filter((m) => m.active)
    .map((m) => ({ id: m.id, brandId: m.brandId, name: m.name }));
  const serviceTypes = lookups
    .filter((l) => l.kind === "service_type" && l.active)
    .sort((a, b) => a.order - b.order)
    .map((l) => ({ id: l.id, label: l.label }));
  const fields = customFormFields.filter((f) => f.active).sort((a, b) => a.order - b.order);

  return (
    <main className="grid-bg px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-xl space-y-6">
        <div className="text-center">
          <p className="kicker">Pickup &amp; Delivery</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">We pick up, repair, and deliver it back</h1>
          <p className="mt-2 text-sm text-slate-400">No need to leave home — a rider handles the trip both ways.</p>
          <p className="mt-1 text-xs text-slate-400">
            Area: {AREA_LABELS[area]} ·{" "}
            <Link href="/pickup-delivery" className="text-blue-500 hover:underline">
              Change
            </Link>
          </p>
        </div>
        {fields.length === 0 ? (
          <p className="card text-center text-sm text-slate-400">
            This form has no active fields right now — add or re-enable some from Admin &gt; Settings &gt; Request Form.
          </p>
        ) : (
          <HomeServiceForm
            brands={brands}
            models={models}
            serviceTypes={serviceTypes}
            content={content}
            fields={fields}
            area={area}
            smsAvailable={smsConfigured()}
            mode="pickup_delivery"
          />
        )}
      </div>
    </main>
  );
}
