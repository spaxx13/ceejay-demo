import Link from "next/link";
import { redirect } from "next/navigation";
import { getMailInRequestByToken, getLookups, getBranches } from "@/lib/db";
import { submitMailInShipment, startMailInPayment, processMailInPayment } from "@/lib/actions";
import { retrieveCheckoutSession } from "@/lib/paymongo";
import { COURIERS, courierUrl } from "@/lib/couriers";
import { formatDateTime } from "@/lib/format";

const peso = (n: number) => `₱${n.toLocaleString()}.00`;

export default async function MailInTrackPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { token } = await params;
  const { error, saved } = await searchParams;

  let req = await getMailInRequestByToken(token);
  if (!req) {
    return (
      <Shell>
        <div className="card space-y-3 text-center">
          <p className="text-3xl">⚠️</p>
          <h1 className="text-lg font-semibold text-slate-800">Invalid link</h1>
          <p className="text-sm text-slate-400">We couldn&apos;t find a repair request for this link. Please check the link in your email.</p>
          <Link href="/mail-in" className="btn-secondary inline-block">
            Start a Repair by Courier
          </Link>
        </div>
      </Shell>
    );
  }

  // Fallback re-verification, same reasoning as confirm-booking: PayMongo's
  // webhook is the source of truth, but if it hasn't landed by the time the
  // customer returns from PayMongo, ask PayMongo directly.
  if (req.qrPaymentStatus === "pending" && req.paymongoCheckoutSessionId) {
    try {
      const session = await retrieveCheckoutSession(req.paymongoCheckoutSessionId);
      if (session.paid && session.paymentId) req = (await processMailInPayment(req.id, session.paymentId)) ?? req;
    } catch {
      // PayMongo lookup failed — show the still-pending state below.
    }
  }

  const [lookups, branches] = await Promise.all([getLookups(), getBranches()]);
  const statuses = lookups.filter((l) => l.kind === "mailin_status").sort((a, b) => a.order - b.order);
  const current = statuses.find((s) => s.id === req!.statusId);
  const label = current?.label ?? "";
  const branch = branches.find((b) => b.id === req!.branchId);
  const cancelled = label === "Cancelled";
  const timeline = statuses.filter((s) => s.label !== "Cancelled");
  const currentIdx = timeline.findIndex((s) => s.id === req!.statusId);

  const r = req;

  async function saveShipment(formData: FormData) {
    "use server";
    const res = await submitMailInShipment(token, formData);
    redirect(`/mail-in/track/${token}?${res.ok ? "saved=1" : `error=${encodeURIComponent(res.error)}`}`);
  }

  async function pay() {
    "use server";
    const res = await startMailInPayment(token);
    redirect(`/mail-in/track/${token}?error=${encodeURIComponent(res.error)}`);
  }

  const canEditShipment = label === "Awaiting Shipment" || label === "In Transit";
  const outboundUrl = courierUrl(r.outboundCourier);
  const returnUrl = courierUrl(r.returnCourier);

  return (
    <Shell>
      <div className="card space-y-1 text-center">
        <p className="font-mono text-xs text-slate-400">{r.reference}</p>
        <h1 className="text-xl font-bold text-slate-900">{cancelled ? "Request cancelled" : label}</h1>
        <p className="text-sm text-slate-400">Hi {r.name}, here&apos;s where your repair stands.</p>
      </div>

      {!cancelled && (
        <ol className="card space-y-2 text-sm">
          {timeline.map((s, i) => (
            <li key={s.id} className={i < currentIdx ? "text-green-700" : i === currentIdx ? "font-semibold text-blue-700" : "text-slate-400"}>
              {i < currentIdx ? "✓" : i === currentIdx ? "●" : "○"} {s.label}
            </li>
          ))}
        </ol>
      )}

      {cancelled && (
        <div className="card text-sm text-slate-500">
          This request was cancelled{r.cancelledReason ? `: ${r.cancelledReason}` : "."} Contact the shop if you have questions.
        </div>
      )}

      {label === "Pending Review" && (
        <div className="card space-y-1 text-sm text-slate-600">
          <h2 className="text-sm font-semibold text-slate-800">We&apos;re reviewing your request</h2>
          <p>
            Please <strong>don&apos;t ship your phone yet</strong>. We&apos;ll check that we can repair it and email you once it&apos;s approved — the address to
            ship to will show up here.
          </p>
        </div>
      )}

      {canEditShipment && r.estimateNote && (
        <div className="card space-y-1 text-sm text-slate-600">
          <h2 className="text-sm font-semibold text-slate-800">From the shop</h2>
          <p className="whitespace-pre-line">{r.estimateNote}</p>
        </div>
      )}

      {canEditShipment && branch && (
        <div className="card space-y-3">
          <h2 className="text-sm font-semibold text-slate-800">1. Ship your phone to</h2>
          <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">
            <p className="font-semibold">Ceejay Cellphone Repair Shop — {branch.name}</p>
            <p>{branch.address}</p>
            {branch.contactNumber && <p>Contact: {branch.contactNumber}</p>}
            <p className="mt-1 text-xs text-slate-500">
              Write <span className="font-mono font-semibold">{r.reference}</span> and your name on the parcel.
            </p>
          </div>
          <ul className="list-disc space-y-1 pl-5 text-xs text-slate-500">
            <li>Remove your SIM card and memory card, and turn off Find My / screen lock if you can.</li>
            <li>Wrap the phone in bubble wrap and use a sturdy box. Don&apos;t include the case or charger unless needed.</li>
            <li>Declare the phone&apos;s value and consider courier insurance — we aren&apos;t liable for loss during shipping.</li>
            <li>
              Put a note inside the box with your name, mobile number and reference number ({r.reference}), so we can identify your phone.
            </li>
            <li>Keep your receipt and tracking number.</li>
          </ul>

          <h2 className="pt-2 text-sm font-semibold text-slate-800">2. Add your tracking number</h2>
          <form action={saveShipment} className="space-y-3">
            <select name="courier" required defaultValue={COURIERS.find((c) => c.label === r.outboundCourier)?.id ?? (r.outboundCourier ? "other" : "")} className="input">
              <option value="" disabled>
                Select your courier
              </option>
              {COURIERS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
              <option value="other">Other</option>
            </select>
            <input name="courierOther" className="input" placeholder="Courier name (only if you chose Other)" defaultValue={COURIERS.some((c) => c.label === r.outboundCourier) ? "" : r.outboundCourier} />
            <input name="tracking" required className="input" placeholder="Tracking number" defaultValue={r.outboundTracking} />
            <button type="submit" className="btn-primary w-full">
              {r.outboundTracking ? "Update Tracking Number" : "Save Tracking Number"}
            </button>
            {saved && <p className="text-sm text-green-700">Saved — thank you! We&apos;ll watch for your parcel.</p>}
            {error && <p className="text-sm text-red-600">{decodeURIComponent(error)}</p>}
          </form>
        </div>
      )}

      {!canEditShipment && r.outboundTracking && (
        <div className="card space-y-1 text-sm">
          <h2 className="text-sm font-semibold text-slate-800">Your shipment to us</h2>
          <p className="text-slate-600">
            {r.outboundCourier} · <span className="font-mono">{r.outboundTracking}</span>
          </p>
          {outboundUrl && (
            <a href={outboundUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">
              Open {r.outboundCourier}&apos;s website to track
            </a>
          )}
        </div>
      )}

      {canEditShipment && r.outboundTracking && outboundUrl && (
        <div className="card text-sm">
          <a href={outboundUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">
            Open {r.outboundCourier}&apos;s website to track your parcel
          </a>
        </div>
      )}

      {r.receivedAt && (
        <div className="card space-y-2 text-sm">
          <h2 className="text-sm font-semibold text-slate-800">Received at the shop</h2>
          <p className="text-slate-500">{formatDateTime(r.receivedAt)}</p>
          {r.receivedConditionNotes && <p className="whitespace-pre-line rounded-md bg-slate-50 p-3 text-slate-600">{r.receivedConditionNotes}</p>}
          {r.receivedPhotoDataUrls.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {r.receivedPhotoDataUrls.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={src} alt={`Phone condition on arrival ${i + 1}`} className="h-24 w-24 rounded-lg border border-slate-200 object-cover" />
              ))}
            </div>
          )}
        </div>
      )}

      {label === "Awaiting Payment" && r.finalCost && (
        <div className="card space-y-3 text-center">
          <h2 className="text-sm font-semibold text-slate-800">Your phone is repaired</h2>
          {r.diagnosis && <p className="whitespace-pre-line text-left text-sm text-slate-500">{r.diagnosis}</p>}
          <p className="text-2xl font-bold text-slate-900">{peso(r.finalCost)}</p>
          <p className="text-xs text-slate-400">Pay by QR Ph (GCash, Maya, and most banking apps) — we ship your phone back right after we receive your payment.</p>
          {r.paymongoCheckoutUrl && r.qrPaymentStatus === "pending" ? (
            <a href={r.paymongoCheckoutUrl} className="btn-primary block w-full">
              Resume Payment ({peso(r.finalCost)})
            </a>
          ) : (
            <form action={pay}>
              <button type="submit" className="btn-primary w-full">
                Pay {peso(r.finalCost)} via QR Ph
              </button>
            </form>
          )}
          {error && <p className="text-sm text-red-600">{decodeURIComponent(error)}</p>}
        </div>
      )}

      {r.qrPaymentStatus === "paid" && r.finalCost && (
        <div className="card text-sm text-slate-600">
          <span className="text-green-700">✓ Paid</span> {peso(r.finalCost)}
          {r.paidAt ? ` on ${formatDateTime(r.paidAt)}` : ""}
        </div>
      )}

      {r.returnTracking && (
        <div className="card space-y-1 text-sm">
          <h2 className="text-sm font-semibold text-slate-800">Your phone is on its way back</h2>
          <p className="text-slate-600">
            {r.returnCourier} · <span className="font-mono">{r.returnTracking}</span>
          </p>
          {returnUrl && (
            <a href={returnUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">
              Open {r.returnCourier}&apos;s website to track
            </a>
          )}
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid-bg px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-md space-y-4">{children}</div>
    </main>
  );
}
