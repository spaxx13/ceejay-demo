import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CHECKLIST_TEMPLATE, SERVICE_AGREEMENT_TERMS } from "@/lib/checklist";
import { getRequestById, getLookups, getDeviceModels, getServiceAgreements, getRepairProgressByRequestId } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import ChecklistForm from "@/components/ChecklistForm";
import RepairProgressForm from "@/components/RepairProgressForm";
import AgreementSummary from "@/components/AgreementSummary";

export default async function TechnicianChecklistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, req] = await Promise.all([getCurrentUser(), getRequestById(id)]);
  if (!req) notFound();
  if (!user || req.assignedTechnicianId !== user.technicianId) redirect("/technician");

  const [lookups, deviceModels, agreements, repairProgress] = await Promise.all([
    getLookups(),
    getDeviceModels(),
    getServiceAgreements(),
    getRepairProgressByRequestId(id),
  ]);
  const brand = lookups.find((l) => l.id === req.deviceBrandId);
  const model = deviceModels.find((m) => m.id === req.deviceModelId);
  const deviceLabel = brand ? `${brand.label} ${model?.name ?? ""}`.trim() : req.deviceOther || "Device";
  const address = [req.street, req.city, req.province].filter(Boolean).join(", ") + (req.landmark ? ` (near ${req.landmark})` : "");

  const pre = agreements.find((a) => a.requestId === req.id && a.phase === "pre_repair");
  const post = agreements.find((a) => a.requestId === req.id && a.phase === "post_repair");

  const commonProps = {
    target: { type: "request" as const, id: req.id },
    reference: req.reference,
    customerName: req.customerName,
    phone: req.phone,
    email: req.email,
    deviceLabel,
    address,
    items: CHECKLIST_TEMPLATE.map((t) => ({ key: t.key, label: t.label, helpText: t.helpText })),
    terms: SERVICE_AGREEMENT_TERMS,
    backHref: "/technician",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Post-Repair Checklists</h1>
          <p className="text-sm text-slate-400">{req.reference} — {req.customerName}</p>
        </div>
        <Link href="/technician" className="text-xs text-blue-500 hover:underline">
          &larr; Back
        </Link>
      </div>

      {post && (
        <div className="card border-green-200 bg-green-50/60 text-center text-sm font-semibold text-green-700">
          ✅ This job is Completed — both checklists were saved and sent to the customer.
        </div>
      )}

      <RepairProgressForm requestId={req.id} progress={repairProgress} />

      {pre && <AgreementSummary agreement={pre} title={`Pre-Repair Checklist completed — ${pre.reference}`} />}

      {!pre && <ChecklistForm phase="pre_repair" {...commonProps} />}
      {pre && !post && <ChecklistForm phase="post_repair" {...commonProps} />}

      {post && <AgreementSummary agreement={post} title={`Post-Repair Checklist completed — ${post.reference}`} allowPriceEdit />}
    </div>
  );
}
