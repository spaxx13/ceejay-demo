import { NextRequest, NextResponse } from "next/server";
import { getRequests, getLookups, query } from "@/lib/db";
import { sendAppointmentReminderEmail } from "@/lib/email";

// Runs once a day (see vercel.json) and emails every customer whose home
// service appointment is scheduled for tomorrow, as long as the request is
// still open (not Completed/Cancelled) and hasn't already been reminded.
// Protected by CRON_SECRET, same as the other crons.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [requests, lookups] = await Promise.all([getRequests(), getLookups()]);
  const closedStatusIds = new Set(
    lookups.filter((l) => l.kind === "request_status" && (l.label === "Completed" || l.label === "Cancelled")).map((l) => l.id)
  );

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  const due = requests.filter(
    (r) => r.preferredDatetime === tomorrowStr && r.email && !r.reminderSentAt && !closedStatusIds.has(r.statusId)
  );

  let sent = 0;
  let failed = 0;
  for (const r of due) {
    try {
      await sendAppointmentReminderEmail(r.email, {
        customerName: r.customerName,
        reference: r.reference,
        preferredDatetime: r.preferredDatetime,
      });
      await query("update home_service_requests set reminder_sent_at=now() where id=$1", [r.id]);
      sent++;
    } catch {
      failed++;
    }
  }

  return NextResponse.json({ date: tomorrowStr, due: due.length, sent, failed });
}
