import { NextRequest, NextResponse } from "next/server";
import { getDueCrmBroadcasts, getCrmBroadcastRecipients, markCrmBroadcastSent } from "@/lib/db";
import { sendBroadcastEmail } from "@/lib/email";

// Runs every 5 minutes (see vercel.json) and delivers any CRM > Send
// Announcement broadcast scheduled for the past — the recipient list is
// recomputed fresh here (not the estimate stored when it was queued), so a
// broadcast scheduled a day ahead still reaches whoever is in the CRM by
// the time it actually goes out. Protected by CRON_SECRET, same as the
// other cron routes.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const due = await getDueCrmBroadcasts();
  const results: { id: string; sent: number; failed: number }[] = [];

  for (const broadcast of due) {
    const recipients = await getCrmBroadcastRecipients();
    let sent = 0;
    let failed = 0;
    for (const email of recipients) {
      try {
        await sendBroadcastEmail(email, { subject: broadcast.subject, message: broadcast.message, photos: broadcast.photos });
        sent++;
      } catch {
        failed++;
      }
    }
    await markCrmBroadcastSent(broadcast.id, failed === recipients.length && recipients.length > 0 ? "failed" : "sent", sent, failed);
    results.push({ id: broadcast.id, sent, failed });
  }

  return NextResponse.json({ processed: due.length, results });
}
