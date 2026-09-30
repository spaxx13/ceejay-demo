import { NextRequest, NextResponse } from "next/server";
import { getRequestsByConfirmationToken } from "@/lib/db";
import { processHomeServiceDownpayment } from "@/lib/paymentProcessing";
import { retrieveCheckoutSession } from "@/lib/paymongo";

// Polled by the native app after returning from the PayMongo checkout
// sheet. Mirrors the same fallback re-verification the web confirm-booking
// page does (app/(site)/confirm-booking/[token]/page.tsx) — the webhook is
// the real source of truth, but if it hasn't landed yet by the time the
// customer's app comes back to the foreground, ask PayMongo directly
// instead of leaving the booking looking unpaid.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let reqs = await getRequestsByConfirmationToken(token);
  if (reqs.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const pendingDownpayment = reqs[0].downpaymentRequired && reqs[0].downpaymentStatus === "pending" ? reqs[0] : null;
  if (pendingDownpayment?.paymongoCheckoutSessionId) {
    try {
      const session = await retrieveCheckoutSession(pendingDownpayment.paymongoCheckoutSessionId);
      if (session.paid && session.paymentId) {
        reqs = await processHomeServiceDownpayment(token, session.paymentId);
      }
    } catch {
      // PayMongo lookup failed — fall through with the still-pending state;
      // the webhook may still land, or the client can poll again.
    }
  }

  const first = reqs[0];
  return NextResponse.json(
    {
      references: reqs.map((r) => r.reference),
      confirmedAt: first.confirmedAt,
      confirmationExpiresAt: first.confirmationExpiresAt,
      downpaymentRequired: first.downpaymentRequired,
      downpaymentStatus: first.downpaymentStatus,
      downpaymentAmount: first.downpaymentAmount,
      fulfillmentMode: first.fulfillmentMode,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
