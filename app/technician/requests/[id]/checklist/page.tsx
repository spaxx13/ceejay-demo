import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CHECKLIST_TEMPLATE, SERVICE_AGREEMENT_TERMS } from "@/lib/checklist";
import { getRequestById, getLookups, getDeviceModels, getServiceAgreements } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import ChecklistForm from "@/components/ChecklistForm";
import type { ServiceAgreement } from "@/lib/types";

const RESULT_LABEL: Record<string, string> = { pass: "Pass", fail: "Fail", na: "N/A" };

function AgreementSummary({ agreement, title }: { agreement: ServiceAgreement; title: string }) {
  return (
    <div className="space-y-4">
      <div className="card space-y-1 text-center">
        <p className="text-2xl">✅</p>
        <p className="text-sm font-semibold text-slate-800">{title}</p>
        <p className="text-xs text-slate-400">
          Completed {new Date(agreement.completedAt).toLocaleString()}
          {agreement.sentToCustomerAt && " — sent to customer"}
        </p>
      </div>
      <div className="card space-y-3">
        {agreement.items.map((item) => (
          <div key={item.key} className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2 last:border-0 last:pb-0">
            <div>
              <p className="text-sm text-slate-800">{item.label}</p>
              {item.notes && <p className="text-xs text-slate-400">{item.notes}</p>}
            </div>
            <span className="badge shrink-0 border border-slate-300 bg-slate-100 text-slate-600">
              {RESULT_LABEL[item.result ?? ""] ?? "—"}
            </span>
          </div>
        ))}
      </div>
      {agreement.summaryNotes && (
        <div className="card space-y-1">
          <h3 className="text-sm font-semibold text-slate-800">Technician Summary</h3>
          <p className="whitespace-pre-line text-sm text-slate-600">{agreement.summaryNotes}</p>
        </div>
      )}
      <div className={`card grid grid-cols-1 gap-4 ${agreement.customerSignatureDataUrl ? "sm:grid-cols-2" : ""}`}>
        {agreement.customerSignatureDataUrl && (
          <div>
            <p className="mb-1 text-xs font-medium text-slate-500">Customer Signature</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={agreement.customerSignatureDataUrl} alt="Customer signature" className="h-24 w-full rounded-lg border border-slate-200 bg-white object-contain" />
          </div>
        )}
        <div>
          <p className="mb-1 text-xs font-medium text-slate-500">Technician Signature</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={agreement.technicianSignatureDataUrl ?? ""} alt="Technician signature" className="h-24 w-full rounded-lg border border-slate-200 bg-white object-contain" />
        </div>
      </div>
      {agreement.receiptPhotoDataUrl && (
        <div className="card space-y-1">
          <p className="text-xs font-medium text-slate-500">Receipt</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={agreement.receiptPhotoDataUrl} alt="Receipt" className="max-h-56 rounded-lg border border-slate-200 object-contain" />
        </div>
      )}
    </div>
  );
}

export default async function TechnicianChecklistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, req] = await Promise.all([getCurrentUser(), getRequestById(id)]);
  if (!req) notFound();
  if (!user || req.assignedTechnicianId !== user.technicianId) redirect("/technician");

  const [lookups, deviceModels, agreements] = await Promise.all([getLookups(), getDeviceModels(), getServiceAgreements()]);
  const brand = lookups.find((l) => l.id === req.deviceBrandId);
  const model = deviceModels.find((m) => m.id === req.deviceModelId);
  const deviceLabel = brand ? `${brand.label} ${model?.name ?? ""}`.trim() : req.deviceOther || "Device";
  const address = [req.street, req.city, req.province].filter(Boolean).join(", ") + (req.landmark ? ` (near ${req.landmark})` : "");

  const pre = agreements.find((a) => a.requestId === req.id && a.phase === "pre_repair");
  const post = agreements.find((a) => a.requestId === req.id && a.phase === "post_repair");

  const commonProps = {
    requestId: req.id,
    reference: req.reference,
    customerName: req.customerName,
    phone: req.phone,
    email: req.email,
    deviceLabel,
    address,
    items: CHECKLIST_TEMPLATE.map((t) => ({ key: t.key, label: t.label, helpText: t.helpText })),
    terms: SERVICE_AGREEMENT_TERMS,
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

      {pre && <AgreementSummary agreement={pre} title={`Pre-Repair Checklist completed — ${pre.reference}`} />}

      {!pre && <ChecklistForm phase="pre_repair" {...commonProps} />}
      {pre && !post && <ChecklistForm phase="post_repair" {...commonProps} />}

      {post && <AgreementSummary agreement={post} title={`Post-Repair Checklist completed — ${post.reference}`} />}
    </div>
  );
}
