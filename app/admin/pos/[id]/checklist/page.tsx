import Link from "next/link";
import { notFound } from "next/navigation";
import { CHECKLIST_TEMPLATE, SERVICE_AGREEMENT_TERMS } from "@/lib/checklist";
import { getRepairRecordById, getServiceAgreements } from "@/lib/db";
import ChecklistForm from "@/components/ChecklistForm";
import AgreementSummary from "@/components/AgreementSummary";

export default async function RepairRecordChecklistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = await getRepairRecordById(id);
  if (!record) notFound();

  const agreements = await getServiceAgreements();
  const pre = agreements.find((a) => a.repairRecordId === record.id && a.phase === "pre_repair");
  const post = agreements.find((a) => a.repairRecordId === record.id && a.phase === "post_repair");

  const commonProps = {
    target: { type: "repairRecord" as const, id: record.id },
    reference: record.reference,
    customerName: record.customerName,
    phone: record.contactNumber,
    email: record.email,
    deviceLabel: record.deviceModel || "Device",
    items: CHECKLIST_TEMPLATE.map((t) => ({ key: t.key, label: t.label, helpText: t.helpText })),
    terms: SERVICE_AGREEMENT_TERMS,
    backHref: `/admin/pos/${record.id}`,
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Pre/Post-Repair Checklist</h1>
          <p className="text-sm text-slate-400">{record.reference} — {record.customerName}</p>
        </div>
        <Link href={`/admin/pos/${record.id}`} className="text-xs text-blue-500 hover:underline">
          &larr; Back
        </Link>
      </div>

      {post && (
        <div className="card border-green-200 bg-green-50/60 text-center text-sm font-semibold text-green-700">
          ✅ Both checklists completed for this repair.
        </div>
      )}

      {pre && <AgreementSummary agreement={pre} title={`Pre-Repair Checklist completed — ${pre.reference}`} />}

      {!pre && <ChecklistForm phase="pre_repair" {...commonProps} />}
      {pre && !post && <ChecklistForm phase="post_repair" {...commonProps} />}

      {post && <AgreementSummary agreement={post} title={`Post-Repair Checklist completed — ${post.reference}`} />}
    </div>
  );
}
