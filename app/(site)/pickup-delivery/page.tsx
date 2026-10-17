import Link from "next/link";
import { getLookups, getDeviceModels, getRequestFormContent, getCustomFormFields, getBranches, canManagePickupDelivery } from "@/lib/db";
import { PICKUP_DELIVERY_PUBLIC_ENABLED, PICKUP_DELIVERY_SKIP_OTP } from "@/lib/config";
import { getCurrentUser } from "@/lib/auth";
import HomeServiceForm from "@/components/HomeServiceForm";
import CourierForm from "@/components/site/CourierForm";
import { isCourierReceivingBranch } from "@/lib/courierService";
import { emailConfigured } from "@/lib/email";
import { smsConfigured } from "@/lib/sms";
import { PICKUP_DELIVERY_COVERAGE_LABEL } from "@/lib/homeServiceFees";

// Its own page, separate from the Home Service (on-site) request flow at
// /request — same underlying form/fields/submission action (both are still
// Home Service Requests under the hood), but Pickup & Delivery gets its own
// entry point and copy rather than a toggle buried inside the on-site form.
// Coverage is PICKUP_DELIVERY_COVERAGE (lib/homeServiceFees.ts): Metro
// Manila plus Cainta/Antipolo/Taytay (Rizal) and San Jose Del Monte/Meycauayan/Marilao (Bulacan) — HomeServiceForm trims the
// address picker to that whenever mode="pickup_delivery".

// Two ways to get a device to and from the shop:
//   Option 1 (?option=rider) — our own rider picks it up and delivers it back.
//   Option 2 (?option=book)  — the customer books and pays their own Lalamove /
//     Grab driver both ways. It's stored as a self_book Courier Service request
//     (lib/courierService.ts), so it has its own back office at /admin/courier
//     and doesn't depend on riders or the Option 1 launch switch below.
export default async function PickupDeliveryPage({ searchParams }: { searchParams: Promise<{ option?: string }> }) {
  const { option } = await searchParams;
  if (option === "rider") return <RiderOption />;
  if (option === "book") return <BookYourOwnOption />;
  return <OptionChooser />;
}

function BackToOptions() {
  return (
    <p className="text-center text-sm">
      <Link href="/pickup-delivery" className="text-blue-500 hover:underline">
        ← Choose a different option
      </Link>
    </p>
  );
}

async function OptionChooser() {
  const staffPreview = !PICKUP_DELIVERY_PUBLIC_ENABLED && canManagePickupDelivery(await getCurrentUser());
  const riderAvailable = PICKUP_DELIVERY_PUBLIC_ENABLED || staffPreview;
  return (
    <main className="grid-bg px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-xl space-y-6">
        <div className="text-center">
          <p className="kicker">Pickup &amp; Delivery</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Paano mo gustong ipadala ang device?</h1>
          <p className="mt-2 text-sm text-slate-400">Pumili ng isa. Pareho itong may pickup papunta sa shop at delivery pabalik sa iyo.</p>
          <p className="mt-1 text-xs text-slate-400">Available sa {PICKUP_DELIVERY_COVERAGE_LABEL}.</p>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <div className="card space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Option 1</p>
              <h2 className="text-lg font-semibold text-slate-900">Sariling rider ng Ceejay</h2>
            </div>
            <p className="text-sm text-slate-500">Kami ang magpapadala ng rider para kunin ang device mo, ire-repair namin ito, at rider din namin ang maghahatid pabalik.</p>
            <ul className="list-disc space-y-1 pl-5 text-xs text-slate-500">
              <li>Hindi mo kailangang mag-book ng courier</li>
              <li>May pickup at delivery fee na makikita mo sa form</li>
            </ul>
            {riderAvailable ? (
              <Link href="/pickup-delivery?option=rider" className="btn-primary block text-center">
                Mag-book ng Rider
              </Link>
            ) : (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-center text-sm text-slate-500">Coming Soon</p>
            )}
          </div>

          <div className="card space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Option 2</p>
              <h2 className="text-lg font-semibold text-slate-900">Mag-book ng sarili mong Lalamove o Grab</h2>
            </div>
            <p className="text-sm text-slate-500">Ikaw ang magbo-book ng driver papunta sa shop at ulit pagkatapos ng repair. Ikaw ang magbabayad ng driver, at kami na ang bahala sa tracking at repair.</p>
            <ul className="list-disc space-y-1 pl-5 text-xs text-slate-500">
              <li>May hand-over code para sigurado na tamang driver ang kukuha</li>
              <li>Ilalagay mo lang ang booking link at plate number ng driver</li>
            </ul>
            <Link href="/pickup-delivery?option=book" className="btn-primary block text-center">
              Mag-book gamit ang Lalamove / Grab
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

async function BookYourOwnOption() {
  const [allBranches, lookups, deviceModels] = await Promise.all([getBranches(), getLookups(), getDeviceModels()]);
  // Same receiving branch as Courier Service — see COURIER_RECEIVING_BRANCH_NAME.
  const branch = allBranches
    .filter((b) => b.active && b.address.trim() && isCourierReceivingBranch(b.name))
    .map((b) => ({ id: b.id, name: b.name, address: b.address, contactNumber: b.contactNumber }))[0];
  const brands = lookups
    .filter((l) => l.kind === "device_brand" && l.active)
    .sort((a, b) => a.order - b.order)
    .map((l) => ({ id: l.id, label: l.label }));
  const models = deviceModels.filter((m) => m.active).map((m) => ({ id: m.id, brandId: m.brandId, name: m.name }));
  const serviceTypes = lookups
    .filter((l) => l.kind === "service_type" && l.active)
    .sort((a, b) => a.order - b.order)
    .map((l) => ({ id: l.id, label: l.label }));

  return (
    <main className="grid-bg px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-xl space-y-6">
        <div className="text-center">
          <p className="kicker">Pickup &amp; Delivery · Option 2</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Mag-book ng sarili mong Lalamove o Grab</h1>
          <p className="mt-2 text-sm text-slate-400">
            Isumite muna ang repair request. Pagkatapos, ikaw ang magbo-book ng driver papunta sa shop, at ulit pagkatapos ng repair.
          </p>
        </div>

        <ol className="grid grid-cols-1 gap-2 text-sm text-slate-500 sm:grid-cols-4">
          {["Isumite ang request", "Mag-book ng driver", "Ire-repair namin", "Mag-book ng driver pabalik"].map((step, i) => (
            <li key={step} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-center">
              <span className="font-semibold text-slate-800">{i + 1}.</span> {step}
            </li>
          ))}
        </ol>
        <p className="text-center text-xs text-slate-400">
          Ikaw ang magbabayad ng Lalamove/Grab sa dalawang biyahe. Ang repair cost ay babayaran bago ilabas ang device.
        </p>

        <div className="rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3 text-center">
          <p className="text-sm font-semibold text-amber-900">📞 Please call us first before booking</p>
          <p className="mt-1 text-sm text-amber-800">
            Call{" "}
            <a href="tel:09566692007" className="font-bold underline">
              0956 669 2007
            </a>{" "}
            so we can confirm your device&apos;s problem first.
          </p>
        </div>

        {branch ? (
          <CourierForm branch={branch} brands={brands} models={models} serviceTypes={serviceTypes} emailAvailable={emailConfigured()} mode="self_book" />
        ) : (
          <p className="card text-center text-sm text-slate-400">This option is temporarily unavailable. Please contact a branch directly.</p>
        )}
        <p className="text-center text-sm">
          <Link href="/courier-service/track" className="text-blue-500 hover:underline">
            Already booked? Track your request
          </Link>
        </p>
        <BackToOptions />
      </div>
    </main>
  );
}

async function RiderOption() {
  // Staff preview: while the public gate is still off, a logged-in admin
  // (same session cookie as /admin) still gets the real form here so the
  // flow can be tested on the live site — the public keeps seeing "Coming
  // Soon". submitHomeServiceRequest applies the same exception server-side.
  const staffPreview = !PICKUP_DELIVERY_PUBLIC_ENABLED && canManagePickupDelivery(await getCurrentUser());
  if (!PICKUP_DELIVERY_PUBLIC_ENABLED && !staffPreview) {
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
            <Link href="/pickup-delivery?option=book" className="btn-primary">
              Book your own Lalamove / Grab
            </Link>
            <Link href="/request" className="btn-secondary">
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

  const [lookups, deviceModels, content, customFormFields, branches] = await Promise.all([
    getLookups(),
    getDeviceModels(),
    getRequestFormContent(),
    getCustomFormFields(),
    getBranches(),
  ]);
  const branchPins = branches.filter((b) => b.active && b.address).map((b) => ({ id: b.id, name: b.name, lat: b.lat, lng: b.lng }));
  const branchesWithoutPins = branchPins.filter((b) => b.lat === null || b.lng === null);

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
        {staffPreview && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs text-amber-800">
            Staff preview — you can see this because you&apos;re logged in as an admin with Pickup &amp; Delivery access. Visitors still see &quot;Coming Soon&quot; until
            NEXT_PUBLIC_PICKUP_DELIVERY_ENABLED is turned on. Test bookings from here skip SMS verification.
          </p>
        )}
        {staffPreview && branchesWithoutPins.length > 0 && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-center text-xs text-red-700">
            ⚠ Distance pricing can&apos;t show an exact fee yet — no map pin on: {branchesWithoutPins.map((b) => b.name).join(", ")}. Set
            each branch&apos;s Exact Pin in Admin &gt; Settings &gt; Branches. (Only admins see this notice.)
          </p>
        )}
        <div className="text-center">
          <p className="kicker">Pickup &amp; Delivery</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">We pick up, repair, and deliver it back</h1>
          <p className="mt-2 text-sm text-slate-400">No need to leave home — a rider handles the trip both ways.</p>
          <p className="mt-1 text-xs text-slate-400">Available in {PICKUP_DELIVERY_COVERAGE_LABEL}.</p>
        </div>
        <div className="rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3 text-center">
          <p className="text-sm font-semibold text-amber-900">📞 Please call us first before booking</p>
          <p className="mt-1 text-sm text-amber-800">
            Call{" "}
            <a href="tel:09566692007" className="font-bold underline">
              0956 669 2007
            </a>{" "}
            so we can confirm your device&apos;s problem and make sure Pickup &amp; Delivery is the right option for it — then book below.
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
            area="near"
            // TEMPORARY: PICKUP_DELIVERY_SKIP_OTP lets the form degrade the
            // same way it already does when no SMS provider is configured —
            // no OTP step shown, no real SMS sent — see lib/config.ts.
            // Staff preview also skips OTP (and payment, server-side) — see
            // submitHomeServiceRequest's matching staffPreview gate.
            smsAvailable={smsConfigured() && !PICKUP_DELIVERY_SKIP_OTP && !staffPreview}
            mode="pickup_delivery"
            branchPins={branchPins}
          />
        )}
        <BackToOptions />
      </div>
    </main>
  );
}
