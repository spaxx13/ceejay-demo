import { NextRequest, NextResponse } from "next/server";
import { getRequests, getLookups, query, logActivity, notifyAdmins } from "@/lib/db";
import { sendCancellationEmail } from "@/lib/email";
import { sendSms, normalizePhone } from "@/lib/sms";

// Runs every 5 minutes (see vercel.json) and cancels any Home Service
// Request still sitting in "Pending Confirmation" past its confirmation
// window (BOOKING_CONFIRMATION_WINDOW_MINUTES) — the customer never
// clicked the confirm link in their quotation email.
// Protected by CRON_SECRET, same as the appointment-reminders cron.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [requests, lookups] = await Promise.all([getRequests(), getLookups()]);
  const pendingConfirmationStatus = lookups.find((l) => l.kind === "request_status" && l.label === "Pending Confirmation");
  const cancelledStatus = lookups.find((l) => l.kind === "request_status" && l.label === "Cancelled");
  if (!pendingConfirmationStatus || !cancelledStatus) {
    return NextResponse.json({ skipped: "Pending Confirmation or Cancelled status not found" });
  }

  const now = Date.now();
  const due = requests.filter(
    (r) => r.statusId === pendingConfirmationStatus.id && !r.confirmedAt && r.confirmationExpiresAt && new Date(r.confirmationExpiresAt).getTime() < now
  );

  let voided = 0;
  for (const r of due) {
    const statusHistory = [...r.statusHistory, { statusId: cancelledStatus.id, at: new Date().toISOString() }];
    // Auto-trash on cancel, same as a manual cancel — the linked Customer/CRM
    // record lives in a separate table and is untouched.
    await query(
      "update home_service_requests set status_id=$1, status_history=$2, admin_notes = admin_notes || $3, deleted_at=now() where id=$4",
      [cancelledStatus.id, JSON.stringify(statusHistory), (r.adminNotes ? "\n" : "") + "Auto-cancelled: customer did not confirm within the confirmation window.", r.id]
    );

    let emailNote = "";
    if (r.email) {
      try {
        await sendCancellationEmail(r.email, {
          customerName: r.customerName,
          reference: r.reference,
          reason: "The booking wasn't confirmed within the confirmation window.",
        });
        emailNote = ` — cancellation email sent to ${r.email}`;
      } catch (err) {
        emailNote = ` — cancellation email failed to send to ${r.email} (${err instanceof Error ? err.message : "unknown error"})`;
      }
    }

    let smsNote = "";
    if (r.phone) {
      try {
        await sendSms(
          normalizePhone(r.phone),
          `Hi ${r.customerName || "there"}, your Ceejay repair request ${r.reference} has been cancelled — it wasn't confirmed within the confirmation window. You're welcome to book again anytime.`
        );
        smsNote = ` — cancellation SMS sent to ${r.phone}`;
      } catch (err) {
        smsNote = ` — cancellation SMS failed to send to ${r.phone} (${err instanceof Error ? err.message : "unknown error"})`;
      }
    }

    await logActivity(
      "home_service_request",
      r.id,
      `Request ${r.reference} auto-cancelled and moved to Trash — not confirmed within the window${emailNote}${smsNote}`,
      "System"
    );
    await notifyAdmins("new_request", r.id, `Request ${r.reference} was auto-cancelled — the customer didn't confirm within the window.`);
    voided++;
  }

  return NextResponse.json({ checked: requests.length, due: due.length, voided });
}
