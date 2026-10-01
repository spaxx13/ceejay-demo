import { NextRequest, NextResponse } from "next/server";
import { getLookups, query, logActivity, notifyAdmins } from "@/lib/db";
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

  const lookups = await getLookups();
  const pendingConfirmationStatus = lookups.find((l) => l.kind === "request_status" && l.label === "Pending Confirmation");
  const cancelledStatus = lookups.find((l) => l.kind === "request_status" && l.label === "Cancelled");
  if (!pendingConfirmationStatus || !cancelledStatus) {
    return NextResponse.json({ skipped: "Pending Confirmation or Cancelled status not found" });
  }

  // This runs every 5 minutes — ask Postgres for just the handful of rows
  // that are actually due (and only the columns used below) instead of
  // pulling every request each time.
  const due = (
    await query<{ id: string; reference: string; customer_name: string; email: string; phone: string; admin_notes: string | null; status_history: { statusId: string; at: string }[] }>(
      `select id, reference, customer_name, email, phone, admin_notes, status_history
       from home_service_requests
       where deleted_at is null and status_id=$1 and confirmed_at is null and confirmation_expires_at is not null and confirmation_expires_at < now()`,
      [pendingConfirmationStatus.id]
    )
  ).map((r) => ({
    id: r.id,
    reference: r.reference,
    customerName: r.customer_name,
    email: r.email,
    phone: r.phone,
    adminNotes: r.admin_notes ?? "",
    statusHistory: r.status_history ?? [],
  }));

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

  return NextResponse.json({ due: due.length, voided });
}
