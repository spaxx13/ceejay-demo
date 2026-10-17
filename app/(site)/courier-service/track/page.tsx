import Link from "next/link";
import { getCourierRequestByReference, getBranches } from "@/lib/db";
import { normalizePhone } from "@/lib/sms";
import {
  courierStatusLabel,
  COURIER_STATUS_ORDER,
  COURIER_LIST,
  COURIER_PACKING_TIPS,
  COURIER_PAYMENT_ACCOUNTS,
  COURIER_SELF_SHIP_NOTICE,
  COURIER_PAYMENT_QR_IMAGE,
  SELF_BOOK_LINKS,
  SELF_BOOK_NOTICE,
  SELF_BOOK_PACKING_TIPS,
  SELF_BOOK_RETURN_NOTICE,
  formatPesos,
} from "@/lib/courierService";
import CourierInboundForm from "@/components/site/CourierInboundForm";
import CourierPaymentForm from "@/components/site/CourierPaymentForm";
import CourierReceivedForm from "@/components/site/CourierReceivedForm";
import CourierReturnBookingForm from "@/components/site/CourierReturnBookingForm";
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
  const selfBook = req.deliveryMode === "self_book";
  const kicker = selfBook ? "Pickup & Delivery" : "Courier Service";
  const cancelled = req.status === "cancelled";
  const currentIdx = COURIER_STATUS_ORDER.indexOf(req.status);
  const total = req.repairCost !== null && req.returnShippingFee !== null ? req.repairCost + req.returnShippingFee : null;

  return (
    <main className="grid-bg px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-md space-y-4">
        <div className="text-center">
          <p className="kicker">{kicker}</p>
          <h1 className="mt-1 font-mono text-xl font-bold text-slate-900">{req.reference}</h1>
          <p className="mt-1 text-sm font-semibold text-slate-700">{courierStatusLabel(req.deliveryMode, req.status)}</p>
        </div>

        {selfBook && req.handoverCode && !cancelled && req.status !== "delivered" && (
          <div className="card text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Hand-over code</p>
            <p className="font-mono text-3xl font-bold tracking-widest text-slate-900">{req.handoverCode}</p>
            <p className="mt-1 text-xs text-slate-500">Ibigay sa driver mo. Hihingin ito ng branch kasama ang plate number bago ilabas ang device.</p>
          </div>
        )}

        {!cancelled && (
          <ol className="card space-y-2 text-sm">
            {COURIER_STATUS_ORDER.map((s, i) => (
              <li key={s} className={i <= currentIdx ? "font-medium text-slate-800" : "text-slate-300"}>
                {i <= currentIdx ? "✅" : "○"} {courierStatusLabel(req.deliveryMode, s)}
              </li>
            ))}
          </ol>
        )}

        {req.status === "awaiting_unit" && branch && (
          <div className="card space-y-3">
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
              <p className="font-semibold">{selfBook ? "Drop-off address para sa driver mo:" : "Ship your device to:"}</p>
              <p>Ceejay Cellphone Repair Shop — {branch.name}</p>
              <p>{branch.address}</p>
              {branch.contactNumber && <p>Contact: {branch.contactNumber}</p>}
              <p>{selfBook ? "Sa notes ng booking ilagay:" : "Attn:"} {req.reference}</p>
            </div>
            <ul className="list-disc space-y-1 pl-5 text-xs text-slate-500">
              {(selfBook ? SELF_BOOK_PACKING_TIPS : COURIER_PACKING_TIPS).map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm font-medium text-amber-900">
              {selfBook ? SELF_BOOK_NOTICE : COURIER_SELF_SHIP_NOTICE}
            </p>
            {selfBook ? (
              <div className="flex flex-wrap gap-2">
                {SELF_BOOK_LINKS.map((l) => (
                  <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" className="btn-secondary !px-3 !py-1.5 text-xs">
                    Mag-book sa {l.label}
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">Couriers na pwede mong gamitin: {COURIER_LIST.join(", ")}.</p>
            )}
            {req.inboundTracking ? (
              <p className="text-sm text-slate-600">
                {selfBook ? "Your booking:" : "Your shipment:"} {req.inboundCourier} — <span className="font-mono">{req.inboundTracking}</span>
              </p>
            ) : (
              <div className="space-y-2 border-t border-slate-200 pt-3">
                <p className="text-sm font-semibold text-slate-800">{selfBook ? "Kailangan ang booking details" : "Kailangan ang tracking number"}</p>
                <p className="text-xs text-slate-500">
                  {selfBook
                    ? "Pagkatapos mong mag-book, ilagay ang tracking link o booking number at ang plate number ng driver."
                    : "Pagkatapos mong ipadala, ilagay ang courier at ang tracking number na ibinigay nila sa iyo."}
                </p>
                <CourierInboundForm reference={req.reference} phone={phone} mode={req.deliveryMode} />
              </div>
            )}
          </div>
        )}

        {req.status === "ready_to_ship" && (
          <div className="card space-y-3 text-sm">
            <div className="space-y-1">
              <p className="font-semibold text-slate-800">Your device is repaired!</p>
              <p className="text-slate-500">Repair cost: {formatPesos(req.repairCost)}</p>
              <p className="text-slate-500">{selfBook ? "Delivery fee (binabayaran mo sa Lalamove/Grab)" : "Return shipping"}: {formatPesos(req.returnShippingFee)}</p>
              <p className="font-semibold text-slate-800">Total: {formatPesos(total)}</p>
            </div>
            {req.paidAt ? (
              selfBook ? (
                <div className="space-y-3">
                  <p className="text-xs text-green-700">Payment confirmed.</p>
                  <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 font-medium text-amber-900">{SELF_BOOK_RETURN_NOTICE}</p>
                  <div className="flex flex-wrap gap-2">
                    {SELF_BOOK_LINKS.map((l) => (
                      <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" className="btn-secondary !px-3 !py-1.5 text-xs">
                        Mag-book sa {l.label}
                      </a>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500">
                    Pickup: Ceejay {branch?.name ?? "branch"}{branch?.address ? `, ${branch.address}` : ""}. Drop-off:{" "}
                    {[req.street, req.barangay, req.city, req.province].filter(Boolean).join(", ")}. Sa notes: {req.reference}.
                  </p>
                  <CourierReturnBookingForm reference={req.reference} phone={phone} defaultCourier={req.outboundCourier} defaultTracking={req.outboundTracking} />
                </div>
              ) : (
                <p className="text-xs text-green-700">Payment confirmed — we&apos;ll ship your device back shortly.</p>
              )
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
            <p className="font-semibold text-slate-800">{selfBook ? "Released to your driver" : "Shipped back to you"}</p>
            <p className="text-slate-500">
              {req.outboundCourier} — <span className="font-mono">{req.outboundTracking}</span>
            </p>
            {req.shippedAt && <p className="text-xs text-slate-400">{selfBook ? "Released" : "Shipped"} {formatDateTime(req.shippedAt)}</p>}
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
