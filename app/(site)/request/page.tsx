import Link from "next/link";
import { getLookups, getDeviceModels, getRequestFormContent, getCustomFormFields } from "@/lib/db";
import HomeServiceForm from "@/components/HomeServiceForm";
import type { HomeServiceQueue } from "@/lib/types";

// The customer picks their service area up front (?area=near|far) — this
// tags the request with the right queue (lib/actions.ts's
// submitHomeServiceRequest) so it's only ever managed by the admin assigned
// to that queue, never guessed later from their address.
const AREA_LABELS: Record<HomeServiceQueue, string> = {
  near: "Metro Manila, Laguna, Batangas, and Quezon",
  far: "Other Provinces",
};

export default async function RequestPage({ searchParams }: { searchParams: Promise<{ area?: string }> }) {
  const sp = await searchParams;
  const area: HomeServiceQueue | null = sp.area === "near" || sp.area === "far" ? sp.area : null;

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
            {(Object.keys(AREA_LABELS) as HomeServiceQueue[]).map((key) => (
              <Link key={key} href={`/request?area=${key}`} className="card block text-center hover:border-blue-300">
                <p className="text-sm font-semibold text-slate-800">{AREA_LABELS[key]}</p>
              </Link>
            ))}
          </div>
        </div>
      </main>
    );
  }

  const [lookups, deviceModels, content, customFormFields] = await Promise.all([
    getLookups(),
    getDeviceModels(),
    getRequestFormContent(),
    getCustomFormFields(),
  ]);
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
          <HomeServiceForm brands={brands} models={models} serviceTypes={serviceTypes} content={content} fields={fields} area={area} />
        )}
      </div>
    </main>
  );
}
