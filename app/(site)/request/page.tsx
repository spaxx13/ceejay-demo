import Link from "next/link";
import { getLookups, getDeviceModels, getRequestFormContent, getCustomFormFields } from "@/lib/db";
import HomeServiceForm from "@/components/HomeServiceForm";
import { smsConfigured } from "@/lib/sms";
import { toPhInternational } from "@/lib/format";
import type { HomeServiceQueue } from "@/lib/types";

// The customer picks their service area up front (?area=near|far) — this
// tags the request with the right queue (lib/actions.ts's
// submitHomeServiceRequest) so it's only ever managed by the admin assigned
// to that queue, never guessed later from their address.
const AREA_LABELS: Record<HomeServiceQueue, string> = {
  near: "Metro Manila, Laguna, Batangas, Rizal, Bulacan, Cavite, and Pampanga",
  far: "Other Provinces",
};

const AREA_ENABLED_KEY: Record<HomeServiceQueue, "nearAreaEnabled" | "farAreaEnabled"> = {
  near: "nearAreaEnabled",
  far: "farAreaEnabled",
};

export default async function RequestPage({ searchParams }: { searchParams: Promise<{ area?: string }> }) {
  const sp = await searchParams;
  const requestedArea: HomeServiceQueue | null = sp.area === "near" || sp.area === "far" ? sp.area : null;

  const [lookups, deviceModels, content, customFormFields] = await Promise.all([
    getLookups(),
    getDeviceModels(),
    getRequestFormContent(),
    getCustomFormFields(),
  ]);

  const enabledAreas = (Object.keys(AREA_LABELS) as HomeServiceQueue[]).filter((key) => content[AREA_ENABLED_KEY[key]]);
  // Ignore a stale/hand-typed ?area= link pointing at an area the owner has
  // since hidden — fall back to the picker instead of serving a form for a
  // queue that's no longer taking bookings.
  const area = requestedArea && enabledAreas.includes(requestedArea) ? requestedArea : null;

  if (!area) {
    return (
      <main className="grid-bg px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-xl space-y-6">
          <div className="text-center">
            <p className="kicker">Book a Home Service</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">Where would you like your service?</h1>
            <p className="mt-2 text-sm text-slate-400">Choose your area so we can route your request to the right team.</p>
          </div>
          <div className="space-y-3">
            {enabledAreas.length === 0 && (
              <p className="card text-center text-sm text-slate-400">Home service booking is temporarily unavailable. Please contact a branch directly.</p>
            )}
            {enabledAreas.map((key) => (
              <Link key={key} href={`/request?area=${key}`} className="card block text-center hover:border-blue-300">
                <p className="text-sm font-semibold text-slate-800">{AREA_LABELS[key]}</p>
              </Link>
            ))}
          </div>
        </div>
      </main>
    );
  }

  // "Other Provinces" has no technicians on an automated dispatch queue, so
  // instead of the digital booking form (built for the "near" queue's real
  // assignment flow) this just routes the customer straight into a chat.
  if (area === "far") {
    const number = content.farAreaContactNumber.trim();
    const intlNumber = number ? toPhInternational(number) : null;

    return (
      <main className="grid-bg px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-xl space-y-6 text-center">
          <div>
            <p className="kicker">Book a Home Service</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">Other Provinces</h1>
            <p className="mt-2 text-sm text-slate-400">
              We don&apos;t have an online form for this area yet — message us directly and we&apos;ll take it from there.
            </p>
            <p className="mt-1 text-xs text-slate-400">
              <Link href="/request" className="text-blue-500 hover:underline">
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
                <ChatIcon />
                <span className="text-sm font-semibold">Message us on WhatsApp</span>
              </a>
              <a
                href={`viber://chat?number=%2B${intlNumber}`}
                className="card flex items-center justify-center gap-2 !bg-[#7360F2] text-white hover:opacity-90"
              >
                <ChatIcon />
                <span className="text-sm font-semibold">Message us on Viber</span>
              </a>
            </div>
          ) : (
            <p className="card text-center text-sm text-slate-400">Home service booking is temporarily unavailable. Please contact a branch directly.</p>
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
          <p className="kicker">{content.pageKicker}</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">{content.pageTitle}</h1>
          <p className="mt-2 text-sm text-slate-400">{content.pageSubtitle}</p>
          <p className="mt-1 text-xs text-slate-400">
            Area: {AREA_LABELS[area]} ·{" "}
            <Link href="/request" className="text-blue-500 hover:underline">
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
          />
        )}
      </div>
    </main>
  );
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 shrink-0">
      <path d="M12 2C6.48 2 2 5.94 2 10.8c0 2.77 1.47 5.24 3.78 6.85L5 22l4.55-2.39c.79.15 1.61.24 2.45.24 5.52 0 10-3.94 10-8.85S17.52 2 12 2z" />
    </svg>
  );
}
