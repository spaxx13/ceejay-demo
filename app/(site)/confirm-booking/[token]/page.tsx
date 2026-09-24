import { redirect } from "next/navigation";
import Link from "next/link";
import { getRequestsByConfirmationToken } from "@/lib/db";
import { confirmBooking, startHomeServiceDownpayment } from "@/lib/actions";
import { processHomeServiceDownpayment } from "@/lib/paymentProcessing";
import { retrieveCheckoutSession } from "@/lib/paymongo";
import { formatDate } from "@/lib/format";

const peso = (n: number) => `₱${n.toLocaleString()}.00`;

function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() < Date.now();
}

export default async function ConfirmBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ result?: string }>;
}) {
  const { token } = await params;
  const { result } = await searchParams;

  // A multi-device booking shares one token across every device's row, so
  // this is every request confirming together from the one email link.
  let reqs = await getRequestsByConfirmationToken(token);

  // Fallback re-verification for the down payment, same reasoning as
  // check-icloud/result/[id]/page.tsx: PayMongo's webhook is the source of
  // truth, but if it hasn't landed yet by the time the customer's browser
  // returns from PayMongo, ask PayMongo directly instead of leaving them
  // stuck looking unpaid. processHomeServiceDownpayment is safe to call
  // even if the webhook races it (see claimHomeServiceDownpaymentAsPaid).
  const pendingDownpayment = reqs[0]?.downpaymentRequired && reqs[0].downpaymentStatus === "pending" ? reqs[0] : null;
  if (pendingDownpayment?.paymongoCheckoutSessionId) {
    try {
      const session = await retrieveCheckoutSession(pendingDownpayment.paymongoCheckoutSessionId);
      if (session.paid && session.paymentId) {
        reqs = await processHomeServiceDownpayment(token, session.paymentId);
      }
    } catch {
      // PayMongo lookup failed — fall through and show the still-pending
      // state below; the webhook may still land, or the customer can retry.
    }
  }

  const referenceList = reqs.map((r) => r.reference).join(", ");

  const isPickupDelivery = reqs[0]?.fulfillmentMode === "pickup_delivery";
  const expiredBody = isPickupDelivery
    ? "This confirmation window has passed and the booking was automatically cancelled. Please submit a new Pickup & Delivery request if you'd still like us to pick up your device."
    : "This confirmation window has passed and the booking was automatically cancelled. Please submit a new Home Service Request if you'd still like a technician to visit.";

  if (result === "expired") {
    return <Result icon="⏰" title="This link has expired" body={expiredBody} />;
  }
  if (result === "confirmed" || (reqs.length > 0 && reqs.every((r) => r.confirmedAt))) {
    return (
      <Result
        icon="✅"
        title="Booking confirmed!"
        body={
          reqs.length > 0
            ? `Your request${reqs.length > 1 ? "s" : ""} ${referenceList} ${reqs.length > 1 ? "are" : "is"} confirmed and now in queue for a ${isPickupDelivery ? "rider" : "technician"} to be assigned.`
            : "Your request is confirmed."
        }
      />
    );
  }

  if (reqs.length === 0) {
    return <Result icon="⚠️" title="Invalid link" body="We couldn't find a booking for this confirmation link. It may have already been used from a different link, or the link was mistyped." />;
  }

  if (isExpired(reqs[0].confirmationExpiresAt)) {
    return <Result icon="⏰" title="This link has expired" body={expiredBody} />;
  }

  async function confirm() {
    "use server";
    const res = await confirmBooking(token);
    redirect(`/confirm-booking/${token}?result=${res.ok ? "confirmed" : res.error}`);
  }

  async function payDownpayment() {
    "use server";
    const res = await startHomeServiceDownpayment(token);
    if (!res.ok) redirect(`/confirm-booking/${token}?result=${encodeURIComponent(res.error)}`);
  }

  const downpaymentDue = reqs[0].downpaymentRequired && reqs[0].downpaymentStatus !== "paid";

  return (
    <main className="grid-bg px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-md space-y-6">
        <div className="card space-y-4 text-center">
          <p className="text-3xl">📋</p>
          <h1 className="text-lg font-semibold text-slate-800">Confirm Your Booking</h1>
          <div className="space-y-1 text-left text-sm text-slate-600">
            <p>
              <span className="text-slate-400">Reference{reqs.length > 1 ? "s" : ""}:</span>{" "}
              <span className="font-mono font-semibold">{referenceList}</span>
            </p>
            <p>
              <span className="text-slate-400">Preferred Date:</span>{" "}
              {reqs[0].preferredDatetime ? formatDate(reqs[0].preferredDatetime) : "To be confirmed"}
            </p>
            {reqs[0].downpaymentAmount !== null && (
              <p>
                <span className="text-slate-400">{isPickupDelivery ? "Booking & Diagnostic Fee:" : "Down Payment:"}</span>{" "}
                <span className="font-semibold">{peso(reqs[0].downpaymentAmount)}</span>{" "}
                {reqs[0].downpaymentStatus === "paid" ? <span className="text-green-700">(Paid)</span> : <span className="text-amber-600">(Unpaid)</span>}
              </p>
            )}
          </div>

          {downpaymentDue ? (
            <>
              <p className="text-sm text-slate-400">
                {isPickupDelivery
                  ? `Pickup & Delivery bookings require a ${peso(reqs[0].downpaymentAmount ?? 0)} Booking & Diagnostic Fee via QR Ph before we can confirm your booking and assign a rider.`
                  : `Home Service bookings in your area require a ${peso(reqs[0].downpaymentAmount ?? 0)} down payment via QR Ph before we can confirm your booking${reqs.length > 1 ? "s" : ""}.`}{" "}
                Unconfirmed bookings are automatically cancelled after the confirmation window.
              </p>
              {reqs[0].paymongoCheckoutUrl ? (
                <a href={reqs[0].paymongoCheckoutUrl} className="btn-primary block w-full">
                  Resume {isPickupDelivery ? "Payment" : "Down Payment"} ({peso(reqs[0].downpaymentAmount ?? 0)})
                </a>
              ) : (
                <form action={payDownpayment}>
                  <button type="submit" className="btn-primary w-full">
                    Pay {isPickupDelivery ? "Booking & Diagnostic Fee" : "Down Payment"} via QR Ph ({peso(reqs[0].downpaymentAmount ?? 0)})
                  </button>
                </form>
              )}
              {result && result !== "confirmed" && result !== "expired" && <p className="text-sm text-red-600">{decodeURIComponent(result)}</p>}
            </>
          ) : (
            <>
              <p className="text-sm text-slate-400">
                Confirm below so we can assign a technician to your request{reqs.length > 1 ? "s" : ""}. Unconfirmed bookings are
                automatically cancelled after the confirmation window.
              </p>
              <form action={confirm}>
                <button type="submit" className="btn-primary w-full">
                  Confirm My Booking
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

function Result({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <main className="grid-bg px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-md">
        <div className="card space-y-3 text-center">
          <p className="text-3xl">{icon}</p>
          <h1 className="text-lg font-semibold text-slate-800">{title}</h1>
          <p className="text-sm text-slate-400">{body}</p>
          <Link href="/" className="btn-secondary inline-block">
            Back to Home
          </Link>
        </div>
      </div>
    </main>
  );
}
