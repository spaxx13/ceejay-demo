import Link from "next/link";
import { getLookups, getDeviceModels, getRequestFormContent, getCustomFormFields } from "@/lib/db";
import { PICKUP_DELIVERY_PUBLIC_ENABLED } from "@/lib/config";
import HomeServiceForm from "@/components/HomeServiceForm";
import { smsConfigured } from "@/lib/sms";

// Its own page, separate from the Home Service (on-site) request flow at
// /request — same underlying form/fields/submission action (both are still
// Home Service Requests under the hood), but Pickup & Delivery gets its own
// entry point and copy rather than a toggle buried inside the on-site form.
// Metro Manila only for now (riders don't cover the wider near-queue area or
// the far/other-provinces queue at all) — HomeServiceForm restricts the
// address picker to Metro Manila cities whenever mode="pickup_delivery".

export default async function PickupDeliveryPage() {
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

  const [lookups, deviceModels, content, customFormFields] = await Promise.all([
    getLookups(),
    getDeviceModels(),
    getRequestFormContent(),
    getCustomFormFields(),
  ]);

  if (!content.nearAreaEnabled) {
    return (
      <main className="grid-bg px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-xl space-y-4 text-center">
          <p className="kicker">Pickup &amp; Delivery</p>
          <h1 className="text-2xl font-bold text-slate-900">Temporarily Unavailable</h1>
          <p className="text-sm text-slate-400">Please contact a branch directly, or try Home Service instead.</p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Link href="/branches" className="btn-secondary">
              Find a Branch
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // Whether a rider is actually available is checked at submit time now
  // (submitHomeServiceRequest, after OTP) instead of blocking the form
  // outright here — the customer can still fill it out, and finds out
  // right when it matters (before paying) rather than being turned away
  // at the door.
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
          <p className="mt-1 text-xs text-slate-400">Metro Manila only, for now.</p>
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
            area="near"
            smsAvailable={smsConfigured()}
            mode="pickup_delivery"
          />
        )}
      </div>
    </main>
  );
}
