import Link from "next/link";
import { getCourierRequestByReference, getBranches } from "@/lib/db";
import { normalizePhone } from "@/lib/sms";
import { COURIER_STATUS_LABELS, COURIER_STATUS_ORDER, COURIER_PACKING_TIPS, formatPesos } from "@/lib/courierService";
import CourierInboundForm from "@/components/site/CourierInboundForm";
import { formatDateTime } from "@/lib/format";

// Customer-facing tracking for a Courier Service request: reference number
// + the mobile number they booked with, no login (same as /track).
export default async function CourierTrackPage({ searchParams }: { searchParams: Promise<{ reference?: string; phone?: string }> }) {
  const sp = await searchParams;
  const reference = (sp.reference ?? "").trim();
  const phone = (sp.phone ?? "").trim();

  if (!reference || !phone) {
    return (
      <main className="grid-bg px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-md space-y-6">
          <div className="text-center">
            <p className="kicker">Courier Service</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">Track Your Request</h1>
            <p className="mt-2 text-sm text-slate-400">Enter your reference number and the mobile number you booked with.</p>
          </div>
          <form className="card space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Reference Number</label>
              <input name="reference" required className="input" placeholder="e.g. CS-2026-0001" defaultValue={reference} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Mobile Number</label>
              <input name="phone" required className="input" placeholder="09xx xxx xxxx" defaultValue={phone} />
            </div>
            <button type="submit" className="btn-primary w-full">
              Track Request
            </button>
          </form>
        </div>
      </main>
    );
  }

  const [req, branches] = await Promise.all([getCourierRequestByReference(reference), getBranches()]);
  if (!req || normalizePhone(req.phone) !== normalizePhone(phone)) {
    return (
      <main className="grid-bg px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-md space-y-4 text-center">
          <p className="kicker">Courier Service</p>
          <h1 className="text-2xl font-bold text-slate-900">Not found</h1>
          <p className="text-sm text-slate-400">We couldn&apos;t find a request with that reference number and mobile number.</p>
          <Link href="/courier-service/track" className="btn-secondary inline-block">
            Try again
          </Link>
        </div>
      </main>
    );
  }

  const branch = branches.find((b) => b.id === req.branchId);
  const cancelled = req.status === "cancelled";
  const currentIdx = COURIER_STATUS_ORDER.indexOf(req.status);
  const total = req.repairCost !== null && req.returnShippingFee !== null ? req.repairCost + req.returnShippingFee : null;

  return (
    <main className="grid-bg px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-md space-y-4">
        <div className="text-center">
          <p className="kicker">Courier Service</p>
          <h1 className="mt-1 font-mono text-xl font-bold text-slate-900">{req.reference}</h1>
          <p className="mt-1 text-sm font-semibold text-slate-700">{COURIER_STATUS_LABELS[req.status]}</p>
        </div>

        {!cancelled && (
          <ol className="card space-y-2 text-sm">
            {COURIER_STATUS_ORDER.map((s, i) => (
              <li key={s} className={i <= currentIdx ? "font-medium text-slate-800" : "text-slate-300"}>
                {i <= currentIdx ? "✅" : "○"} {COURIER_STATUS_LABELS[s]}
              </li>
            ))}
          </ol>
        )}

        {req.status === "awaiting_unit" && branch && (
          <div className="card space-y-3">
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
              <p className="font-semibold">Ship your device to:</p>
              <p>Ceejay Cellphone Repair Shop — {branch.name}</p>
              <p>{branch.address}</p>
              {branch.contactNumber && <p>Contact: {branch.contactNumber}</p>}
              <p>Attn: {req.reference}</p>
            </div>
            <ul className="list-disc space-y-1 pl-5 text-xs text-slate-500">
              {COURIER_PACKING_TIPS.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            {req.inboundTracking ? (
              <p className="text-sm text-slate-600">
                Your shipment: {req.inboundCourier} — <span className="font-mono">{req.inboundTracking}</span>
              </p>
            ) : (
              <CourierInboundForm reference={req.reference} phone={phone} />
            )}
          </div>
        )}

        {req.status === "ready_to_ship" && (
          <div className="card space-y-1 text-sm">
            <p className="font-semibold text-slate-800">Your device is repaired!</p>
            <p className="text-slate-500">Repair cost: {formatPesos(req.repairCost)}</p>
            <p className="text-slate-500">Return shipping: {formatPesos(req.returnShippingFee)}</p>
            <p className="font-semibold text-slate-800">Total: {formatPesos(total)}</p>
            <p className="text-xs text-slate-400">
              {req.paidAt
                ? "Payment received — we'll ship it back shortly."
                : `Please pay this to the branch${branch?.contactNumber ? ` (${branch.contactNumber})` : ""} so we can ship your device back to you.`}
            </p>
          </div>
        )}

        {(req.status === "shipped" || req.status === "delivered") && (
          <div className="card space-y-1 text-sm">
            <p className="font-semibold text-slate-800">Shipped back to you</p>
            <p className="text-slate-500">
              {req.outboundCourier} — <span className="font-mono">{req.outboundTracking}</span>
            </p>
            {req.shippedAt && <p className="text-xs text-slate-400">Shipped {formatDateTime(req.shippedAt)}</p>}
          </div>
        )}

        {cancelled && <p className="card text-center text-sm text-slate-500">This request was cancelled. Contact the branch if you have questions.</p>}
      </div>
    </main>
  );
}
