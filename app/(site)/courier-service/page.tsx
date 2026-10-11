import Link from "next/link";
import { getBranches, getLookups, getDeviceModels } from "@/lib/db";
import CourierForm from "@/components/site/CourierForm";
import { isCourierReceivingBranch } from "@/lib/courierService";
import { emailConfigured } from "@/lib/email";

// Mail-in repair for customers outside the Home Service and Pickup &
// Delivery areas — anywhere in the Philippines. The customer ships the
// device to a branch by courier; we repair it and ship it back. See
// lib/courierService.ts.
export default async function CourierServicePage() {
  const [allBranches, lookups, deviceModels] = await Promise.all([getBranches(), getLookups(), getDeviceModels()]);

  // Devices are only shipped to one branch (COURIER_RECEIVING_BRANCH_NAME).
  const branch = allBranches.filter((b) => b.active && b.address.trim() && isCourierReceivingBranch(b.name)).map((b) => ({ id: b.id, name: b.name, address: b.address, contactNumber: b.contactNumber }))[0];
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
    <main className="grid-bg px-4 py-14 sm:px-6">
      <div className="mx-auto max-w-xl">
        <div className="text-center">
          <p className="kicker">Courier Service</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900 sm:text-4xl">Repair by Courier — Nationwide</h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-slate-400">
            Outside our Home Service and Pickup &amp; Delivery areas? Ship your device to one of our branches by courier — we repair it and
            send it back to you, anywhere in the Philippines.
          </p>
        </div>

        <ol className="mt-6 grid grid-cols-1 gap-2 text-sm text-slate-500 sm:grid-cols-4">
          {["Book below", "Ship it to us", "We repair it", "We ship it back"].map((step, i) => (
            <li key={step} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-center">
              <span className="font-semibold text-slate-800">{i + 1}.</span> {step}
            </li>
          ))}
        </ol>
        <p className="mt-3 text-center text-xs text-slate-400">
          You pay the courier to send your device in, and the return shipping fee together with the repair cost before we ship it back.
        </p>

        <div className="mt-6 rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3 text-center">
          <p className="text-sm font-semibold text-amber-900">📞 Tumawag muna sa branch bago mag-book</p>
          <p className="mt-1 text-sm text-amber-800">
            Tawagan muna ang {branch ? `Ceejay ${branch.name}` : "branch"}
            {branch?.contactNumber && (
              <>
                {" "}
                sa{" "}
                <a href={`tel:${branch.contactNumber.replace(/[^\d+]/g, "")}`} className="font-bold underline">
                  {branch.contactNumber}
                </a>
              </>
            )}{" "}
            para ma-confirm namin kung ano talaga ang problema ng phone mo at kung kailangan itong ipadala. Pagkatapos, mag-book dito.
          </p>
        </div>

        <div className="mt-8">
          {!branch ? (
            <p className="card text-center text-sm text-slate-400">Courier Service is temporarily unavailable. Please contact a branch directly.</p>
          ) : (
            <CourierForm branch={branch} brands={brands} models={models} serviceTypes={serviceTypes} emailAvailable={emailConfigured()} />
          )}
        </div>
        <p className="mt-4 text-center text-sm">
          <Link href="/courier-service/track" className="text-blue-500 hover:underline">
            Already booked? Track your request
          </Link>
        </p>
      </div>
    </main>
  );
}
