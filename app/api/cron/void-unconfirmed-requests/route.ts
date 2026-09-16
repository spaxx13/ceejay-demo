import { NextRequest, NextResponse } from "next/server";
import { getRequests, getLookups, query, logActivity, notifyAdmins } from "@/lib/db";
import { sendCancellationEmail } from "@/lib/email";

// Runs every 15 minutes (see vercel.json) and cancels any Home Service
// Request still sitting in "Pending Confirmation" past its 2-hour window —
// the customer never clicked the confirm link in their quotation email.
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
    await query("update home_service_requests set status_id=$1, status_history=$2, admin_notes = admin_notes || $3 where id=$4", [
      cancelledStatus.id,
      JSON.stringify(statusHistory),
      (r.adminNotes ? "\n" : "") + "Auto-cancelled: customer did not confirm within the 2-hour window.",
      r.id,
    ]);

    let emailNote = "";
    if (r.email) {
      try {
        await sendCancellationEmail(r.email, {
          customerName: r.customerName,
          reference: r.reference,
          reason: "The booking wasn't confirmed within the 2-hour window.",
        });
        emailNote = ` — cancellation email sent to ${r.email}`;
      } catch (err) {
        emailNote = ` — cancellation email failed to send to ${r.email} (${err instanceof Error ? err.message : "unknown error"})`;
      }
    }

    await logActivity("home_service_request", r.id, `Request ${r.reference} auto-cancelled — not confirmed within the window${emailNote}`, "System");
    await notifyAdmins("new_request", r.id, `Request ${r.reference} was auto-cancelled — the customer didn't confirm within the window.`);
    voided++;
  }

  return NextResponse.json({ checked: requests.length, due: due.length, voided });
}
