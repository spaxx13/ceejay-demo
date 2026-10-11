import Link from "next/link";
import { getCourierRequestByReference, getBranches } from "@/lib/db";
import { normalizePhone } from "@/lib/sms";
import { COURIER_STATUS_LABELS, COURIER_STATUS_ORDER, COURIER_PACKING_TIPS, COURIER_PAYMENT_ACCOUNTS, COURIER_PAYMENT_QR_IMAGE, formatPesos } from "@/lib/courierService";
import CourierInboundForm from "@/components/site/CourierInboundForm";
import CourierPaymentForm from "@/components/site/CourierPaymentForm";
import CourierReceivedForm from "@/components/site/CourierReceivedForm";
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
          <div className="card space-y-3 text-sm">
            <div className="space-y-1">
              <p className="font-semibold text-slate-800">Your device is repaired!</p>
              <p className="text-slate-500">Repair cost: {formatPesos(req.repairCost)}</p>
              <p className="text-slate-500">Return shipping: {formatPesos(req.returnShippingFee)}</p>
              <p className="font-semibold text-slate-800">Total: {formatPesos(total)}</p>
            </div>
            {req.paidAt ? (
              <p className="text-xs text-green-700">Payment confirmed — we&apos;ll ship your device back shortly.</p>
            ) : (
              <>
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-blue-900">
                  <p className="font-semibold">Pay via InstaPay QR, GCash, or bank transfer</p>
                  {COURIER_PAYMENT_QR_IMAGE && (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={COURIER_PAYMENT_QR_IMAGE} alt="InstaPay QR code" className="my-2 h-auto w-full max-w-xs rounded-lg border border-blue-200 bg-white" />
                      <p className="text-xs">Scan with any bank or e-wallet app and enter {formatPesos(total)}.</p>
                    </>
                  )}
                  {COURIER_PAYMENT_ACCOUNTS.length === 0 ? (
                    <p>Please ask the branch for our payment details{branch?.contactNumber ? ` (${branch.contactNumber})` : ""}.</p>
                  ) : (
                    COURIER_PAYMENT_ACCOUNTS.map((a) => (
                      <p key={a.method}>
                        {a.method}: {a.bank ? `${a.bank} — ` : ""}
                        {a.accountName} — <span className="font-mono">{a.accountNumber}</span>
                      </p>
                    ))
                  )}
                  <p className="mt-1 text-xs">Then upload a screenshot of your receipt below.</p>
                </div>
                {req.paymentProofAt && (
                  <p className="text-xs text-slate-500">
                    Proof received {formatDateTime(req.paymentProofAt)} — waiting for us to verify it. You can upload a new one if needed.
                  </p>
                )}
                <CourierPaymentForm reference={req.reference} phone={phone} uploaded={Boolean(req.paymentProofAt)} />
              </>
            )}
          </div>
        )}

        {(req.status === "shipped" || req.status === "delivered") && (
          <div className="card space-y-1 text-sm">
            <p className="font-semibold text-slate-800">Shipped back to you</p>
            <p className="text-slate-500">
              {req.outboundCourier} — <span className="font-mono">{req.outboundTracking}</span>
            </p>
            {req.shippedAt && <p className="text-xs text-slate-400">Shipped {formatDateTime(req.shippedAt)}</p>}
            {req.status === "shipped" && (
              <div className="space-y-2 border-t border-slate-200 pt-3">
                <p className="text-xs text-slate-500">Dumating na ba ang device mo? Pindutin ito para ma-confirm.</p>
                <CourierReceivedForm reference={req.reference} phone={phone} />
              </div>
            )}
            {req.status === "delivered" && req.deliveredAt && <p className="text-xs text-green-700">Delivered {formatDateTime(req.deliveredAt)}</p>}
          </div>
        )}

        {cancelled && <p className="card text-center text-sm text-slate-500">This request was cancelled. Contact the branch if you have questions.</p>}
      </div>
    </main>
  );
}
