import { NextRequest, NextResponse } from "next/server";
import { getRequests, getLookups, query } from "@/lib/db";
import { sendSms, smsConfigured } from "@/lib/sms";

// Runs once a day (see vercel.json) and texts every customer whose home
// service appointment is scheduled for tomorrow, as long as the request is
// still open (not Completed/Cancelled) and hasn't already been reminded.
// Protected by CRON_SECRET — this sends real, billed SMS, so it must never
// be reachable by an arbitrary request even if the URL leaks.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!smsConfigured()) {
    return NextResponse.json({ skipped: "SEMAPHORE_API_KEY not configured" });
  }

  const [requests, lookups] = await Promise.all([getRequests(), getLookups()]);
  const closedStatusIds = new Set(
    lookups.filter((l) => l.kind === "request_status" && (l.label === "Completed" || l.label === "Cancelled")).map((l) => l.id)
  );

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  const due = requests.filter(
    (r) => r.preferredDatetime === tomorrowStr && r.phone && !r.reminderSentAt && !closedStatusIds.has(r.statusId)
  );

  let sent = 0;
  let failed = 0;
  for (const r of due) {
    try {
      await sendSms(
        r.phone,
        `Hi ${r.customerName || "there"}, reminder: your Ceejay home service appointment (${r.reference}) is scheduled for tomorrow. See you then!`
      );
      await query("update home_service_requests set reminder_sent_at=now() where id=$1", [r.id]);
      sent++;
    } catch {
      failed++;
    }
  }

  return NextResponse.json({ date: tomorrowStr, due: due.length, sent, failed });
}
