import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/paymongo";
import { processIcloudCheckPayment, processHomeServiceDownpayment, processRepairRecordQrPayment } from "@/lib/actions";

// PayMongo's server-to-server callback once a Checkout Session is paid —
// the ONLY source of truth for "this customer actually paid" (alongside
// each feature's own fallback re-verification against PayMongo directly —
// see app/(site)/check-icloud/result/[id]/page.tsx and
// app/(site)/confirm-booking/[token]/page.tsx). Never release a SICKW
// result, confirm a Home Service booking, or mark a repair paid, based on
// the customer's browser landing back on the success_url alone; that URL
// carries no payment/status flag.
//
// One webhook endpoint handles every checkout flow this app creates
// (lib/paymongo.ts createCheckoutSession) — `metadata.kind` (set when the
// checkout session was created) says which. The payload shape below
// (metadata location, payment id location) is confirmed against a real
// delivered live-mode event, not just PayMongo's docs.
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("paymongo-signature");

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const event = JSON.parse(rawBody);
  const eventType: string | undefined = event?.data?.attributes?.type;
  const resource = event?.data?.attributes?.data;

  if (eventType !== "checkout_session.payment.paid") {
    // Any other event type (e.g. checkout_session expiring) — acknowledge
    // and ignore, nothing else in this feature needs it yet.
    return NextResponse.json({ received: true, ignored: eventType ?? "unknown" });
  }

  const metadata: Record<string, string> | undefined = resource?.attributes?.metadata;
  const payments: Array<{ id: string }> = resource?.attributes?.payments ?? [];
  const paymongoPaymentId: string | undefined = payments[0]?.id;

  if (!metadata?.kind || !paymongoPaymentId) {
    // Verified-but-unrecognized payload shape — acknowledge with 200 so
    // PayMongo doesn't retry indefinitely, but this case needs a look;
    // each feature's own fallback re-verification is the safety net.
    return NextResponse.json({ received: true, warning: "missing metadata.kind or paymentId in payload" });
  }

  if (metadata.kind === "icloud_check" && metadata.checkId) {
    await processIcloudCheckPayment(metadata.checkId, paymongoPaymentId);
    return NextResponse.json({ received: true });
  }

  if (metadata.kind === "home_service_downpayment" && metadata.token) {
    await processHomeServiceDownpayment(metadata.token, paymongoPaymentId);
    return NextResponse.json({ received: true });
  }

  if (metadata.kind === "repair_record_payment" && metadata.repairRecordId) {
    await processRepairRecordQrPayment(metadata.repairRecordId, paymongoPaymentId);
    return NextResponse.json({ received: true });
  }

  return NextResponse.json({ received: true, warning: `unrecognized metadata.kind "${metadata.kind}"` });
}
