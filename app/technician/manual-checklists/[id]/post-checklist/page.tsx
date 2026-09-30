import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getManualRepairRecordById, getManualChecklists, canViewManualRecord } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import ManualPostChecklistForm from "@/components/ManualPostChecklistForm";

export default async function TechnicianManualPostChecklistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, record, allChecklists] = await Promise.all([getCurrentUser(), getManualRepairRecordById(id), getManualChecklists()]);
  if (!record || record.deletedAt) notFound();
  if (!canViewManualRecord(user, record)) redirect("/technician/manual-checklists");

  const checklists = allChecklists.filter((c) => c.manualRecordId === id);
  if (!checklists.some((c) => c.phase === "pre_repair")) redirect(`/technician/manual-checklists/${id}`);
  const post = checklists.find((c) => c.phase === "post_repair");

  return (
    <div className="space-y-4">
      <Link href={`/technician/manual-checklists/${id}`} className="text-xs text-slate-400 hover:text-slate-600">
        ← Back to Ticket
      </Link>
      {post ? (
        // See the admin equivalent page's comment — Next.js refreshes this
        // route right after the form's own submission, so a redirect() here
        // would skip past its success screen before it's ever rendered.
        // sentToCustomerAt is persisted so this always shows the real
        // outcome regardless of which render wins that race.
        <div className="card space-y-3 text-center">
          <p className="text-3xl">✅</p>
          <h2 className="text-lg font-semibold text-slate-800">Post-repair checklist completed</h2>
          <p className="text-sm text-slate-400">
            {post.sentToCustomerAt
              ? <>Receipt emailed to <span className="text-slate-600">{record.customerEmail}</span>.</>
              : record.customerEmail
                ? "The receipt email couldn't be sent — check the ticket's activity log."
                : "No email on file — no receipt was sent."}
          </p>
          <Link href={`/technician/manual-checklists/${id}`} className="btn-primary inline-block">
            Back to Ticket
          </Link>
        </div>
      ) : (
        <ManualPostChecklistForm
          manualRecordId={record.id}
          reference={record.reference}
          customerName={record.customerName}
          customerPhone={record.customerPhone}
          customerEmail={record.customerEmail}
          deviceLabel={record.deviceLabel}
          backHref={`/technician/manual-checklists/${id}`}
        />
      )}
    </div>
  );
}
