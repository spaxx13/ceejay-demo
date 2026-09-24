import "server-only";
import { revalidatePath } from "next/cache";
import {
  query,
  getLookups,
  logActivity,
  notifyAdmins,
  getRequestsByConfirmationToken,
  getRepairRecordById,
  getIcloudCheckById,
  claimHomeServiceDownpaymentAsPaid,
  claimRepairRecordQrPaymentAsPaid,
  claimIcloudCheckAsPaid,
  markIcloudCheckChecked,
  markIcloudCheckFailed,
} from "./db";
import { checkIcloudStatus } from "./sickw";
import { sendPickupDeliveryBookingConfirmedEmail, emailConfigured } from "./email";
import { formatDate } from "./format";
import type { HomeServiceRequest } from "./types";

// Payment settlement, kept OUT of lib/actions.ts on purpose: every export
// of a "use server" module is a server action the browser can call
// directly, and these mark things paid given just a PayMongo payment id.
// They must only run after that payment was verified server-side — by the
// PayMongo webhook (signature-checked) or a page that re-fetched the
// checkout session from PayMongo — never from client input.

export type ConfirmBookingResult =
  | { ok: true; references: string[]; alreadyConfirmed: boolean }
  | { ok: false; error: "not_found" | "expired" | "downpayment_required" };

// Shared by confirmBooking (the customer clicking "Confirm My Booking")
// and processHomeServiceDownpayment (the down payment clearing, which IS
// the confirmation step for DOWNPAYMENT_PROVINCES bookings) — moves every
// row in the group from "Pending Confirmation" to "Pending" (ready for an
// admin to assign). Idempotent: skips any row already confirmed, since
// email clients/scanners sometimes pre-fetch links and a customer might
// click twice, or the webhook and a fallback re-verification might race.
export async function confirmBookingRows(reqs: HomeServiceRequest[]): Promise<ConfirmBookingResult> {
  const lookups = await getLookups();
  const pendingStatus = lookups.find((l) => l.kind === "request_status" && l.label === "Pending");
  const now = new Date().toISOString();

  const newlyConfirmed: HomeServiceRequest[] = [];
  for (const req of reqs) {
    if (req.confirmedAt) continue;
    newlyConfirmed.push(req);
    const statusHistory = pendingStatus ? [...req.statusHistory, { statusId: pendingStatus.id, at: now }] : req.statusHistory;
    await query(
      `update home_service_requests set confirmed_at=now()${pendingStatus ? ", status_id=$2, status_history=$3" : ""} where id=$1`,
      pendingStatus ? [req.id, pendingStatus.id, JSON.stringify(statusHistory)] : [req.id]
    );
    await logActivity("home_service_request", req.id, `Request ${req.reference} confirmed by customer — moved to the Unassigned queue`, "System");
    await notifyAdmins("new_request", req.id, `${req.customerName || "A customer"} confirmed Home Service Request ${req.reference} — now in the Unassigned queue.`);
  }

  // Pickup & Delivery has no other "your booking is confirmed" moment —
  // paying its Booking & Diagnostic Fee IS what confirms it, unlike the
  // on-site flow where a plain click can confirm without any payment. One
  // email per booking (not per device row) — every row shares the same
  // token, phone, and downpaymentAmount (the flat fee is charged once for
  // the whole booking, not per device), so looping the send per row would
  // show the customer the same amount "paid" once for each of their devices.
  const first = newlyConfirmed[0];
  if (first?.fulfillmentMode === "pickup_delivery" && first.email && emailConfigured()) {
    try {
      // opts.reference doubles as the /track lookup key (a single-reference
      // lookup, see app/(site)/track/page.tsx), so it must stay the first
      // device's reference alone — every device's reference is still listed
      // in deviceLabel below for a multi-device booking.
      await sendPickupDeliveryBookingConfirmedEmail(first.email, {
        customerName: first.customerName,
        reference: first.reference,
        phone: first.phone,
        deviceLabel: newlyConfirmed.map((r) => `${r.deviceOther || "Device not specified"} (${r.reference})`).join(", "),
        preferredDate: first.preferredDatetime ? formatDate(first.preferredDatetime) : "To be scheduled",
        address: [first.street, first.barangay, first.city, first.province].filter(Boolean).join(", "),
        amountPaid: first.downpaymentAmount ?? 0,
      });
    } catch {
      // Best-effort — never blocks booking confirmation.
    }
  }

  revalidatePath("/admin/requests");
  revalidatePath("/admin");
  return { ok: true, references: reqs.map((r) => r.reference), alreadyConfirmed: false };
}

// The only place a repair record's QR Ph payment is ever marked paid — see
// claimRepairRecordQrPaymentAsPaid's comment (lib/db.ts) for why. Called
// from both the PayMongo webhook and the POS detail page's own fallback
// re-verification, so either one racing ahead of the other is safe.
export async function processRepairRecordQrPayment(recordId: string, paymongoPaymentId: string) {
  const claimed = await claimRepairRecordQrPaymentAsPaid(recordId, paymongoPaymentId);
  if (claimed) {
    if (claimed.customerId) {
      await logActivity("customer", claimed.customerId, `Repair ${claimed.reference} paid online via QR Ph (₱${claimed.qrPaymentAmount})`, "System");
    }
    revalidatePath(`/admin/pos/${recordId}`);
    revalidatePath("/admin/pos");
  }
  return getRepairRecordById(recordId);
}

// The only place a Home Service down payment is ever marked paid — see
// claimHomeServiceDownpaymentAsPaid's comment (lib/db.ts) for why. Called
// from both the PayMongo webhook (app/api/webhooks/paymongo/route.ts) and
// the confirm-booking page's own fallback re-verification, so either one
// racing ahead of the other is safe.
export async function processHomeServiceDownpayment(token: string, paymongoPaymentId: string) {
  const claimed = await claimHomeServiceDownpaymentAsPaid(token, paymongoPaymentId);
  if (claimed.length === 0) {
    // Already claimed (duplicate webhook delivery, or the other caller won
    // the race) — do NOT confirm again, just report current state.
    return getRequestsByConfirmationToken(token);
  }

  // Edge case: the 2-hour confirmation window lapsed and the
  // void-unconfirmed-requests cron already auto-cancelled this booking
  // between the customer starting checkout and PayMongo confirming
  // payment. Record the payment (already done above) but don't revive a
  // cancelled booking — flag it for a human to sort out (refund or manual
  // re-confirm) instead.
  if (claimed.some((r) => r.deletedAt)) {
    for (const r of claimed) {
      await logActivity(
        "home_service_request",
        r.id,
        `Down payment received for ${r.reference} after the booking was already auto-cancelled — needs manual review (refund or re-confirm).`,
        "System"
      );
      await notifyAdmins("new_request", r.id, `Down payment received for ${r.reference} after auto-cancellation — needs manual review.`);
    }
    return claimed;
  }

  await confirmBookingRows(claimed);
  return getRequestsByConfirmationToken(token);
}

// The only place SICKW is ever called for a given payment — see
// claimIcloudCheckAsPaid's comment (lib/db.ts) for why. Called from both
// the PayMongo webhook (app/api/webhooks/paymongo/route.ts) and the
// result page's own fallback re-verification, so either one racing ahead
// of the other is safe.
export async function processIcloudCheckPayment(checkId: string, paymongoPaymentId: string) {
  const claimed = await claimIcloudCheckAsPaid(checkId, paymongoPaymentId);
  if (!claimed) {
    // Already claimed (duplicate webhook delivery, or the other caller
    // won the race) — do NOT call SICKW again, just report current state.
    return getIcloudCheckById(checkId);
  }

  const result = await checkIcloudStatus(claimed.imei);
  if (result.ok) {
    await markIcloudCheckChecked(claimed.id, result.icloudStatus, result.summary, result.rawResponse);
  } else {
    await markIcloudCheckFailed(claimed.id, result.error, result.rawResponse);
  }
  revalidatePath("/admin/tools/icloud-checks");
  return getIcloudCheckById(checkId);
}
