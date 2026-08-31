import { getLookups, getRequests, getDeviceModels, getServiceAgreements, getCustomFormFields } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import TechnicianBoard from "@/components/TechnicianBoard";

export default async function TechnicianPage() {
  const [user, lookups, allRequests, deviceModels, agreements, customFormFields] = await Promise.all([
    getCurrentUser(),
    getLookups(),
    getRequests(),
    getDeviceModels(),
    getServiceAgreements(),
    getCustomFormFields(),
  ]);
  const statuses = lookups.filter((l) => l.kind === "request_status").sort((a, b) => a.order - b.order);

  const myRequests = allRequests
    .filter((r) => r.assignedTechnicianId === user?.technicianId)
    .sort((a, b) => (a.preferredDatetime < b.preferredDatetime ? -1 : 1))
    .map((r) => {
      const brand = lookups.find((l) => l.id === r.deviceBrandId);
      const model = deviceModels.find((m) => m.id === r.deviceModelId);
      const serviceType = lookups.find((l) => l.id === r.serviceTypeId);
      const status = statuses.find((s) => s.id === r.statusId);
      return {
        id: r.id,
        reference: r.reference,
        customerName: r.customerName,
        phone: r.phone,
        street: r.street,
        city: r.city,
        province: r.province,
        landmark: r.landmark,
        issueDescription: r.issueDescription,
        photoDataUrl: r.photoDataUrl,
        deviceLabel: brand ? `${brand.label} ${model?.name ?? ""}`.trim() : r.deviceOther || "—",
        serviceTypeLabel: serviceType?.label ?? "Service",
        preferredDatetime: r.preferredDatetime,
        statusId: r.statusId,
        adminNotes: r.adminNotes,
        inProgress: status?.label === "In Progress",
        hasPreAgreement: agreements.some((a) => a.requestId === r.id && a.phase === "pre_repair"),
        hasPostAgreement: agreements.some((a) => a.requestId === r.id && a.phase === "post_repair"),
        customFieldEntries: Object.entries(r.customFields)
          .map(([key, value]) => ({ label: customFormFields.find((f) => f.key === key)?.label, value }))
          .filter((e): e is { label: string; value: string | boolean } => !!e.label),
      };
    });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-slate-900">My Assigned Jobs</h1>
        <p className="text-sm text-slate-400">{myRequests.length} request(s) assigned to you.</p>
      </div>
      <TechnicianBoard requests={myRequests} statuses={statuses.map((s) => ({ id: s.id, label: s.label }))} />
    </div>
  );
}
