import { assignPickupRider, assignDeliveryRider } from "@/lib/actions";
import { formatDateTime } from "@/lib/format";
import type { PickupDeliveryStage } from "@/lib/db";

type Job = {
  id: string;
  reference: string;
  customerName: string;
  street: string;
  city: string;
  province: string;
  deviceOther: string;
  stage: PickupDeliveryStage;
  statusLabel: string;
  technicianName: string | null;
  pickupRiderId: string | null;
  pickupRiderName: string | null;
  deliveryRiderId: string | null;
  deliveryRiderName: string | null;
  pickedUpAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
};
type Rider = { id: string; name: string };

const COLUMNS: { key: string; label: string; stages: PickupDeliveryStage[] }[] = [
  { key: "awaiting_pickup", label: "Awaiting Pickup", stages: ["requested", "pickup_assigned"] },
  { key: "at_shop", label: "At Shop", stages: ["picked_up"] },
  { key: "awaiting_delivery", label: "Awaiting Delivery", stages: ["ready_for_delivery", "delivery_assigned"] },
  { key: "completed", label: "Completed", stages: ["out_for_delivery", "delivered"] },
];

function RiderAssignForm({
  action,
  requestId,
  riders,
  currentRiderName,
  label,
}: {
  action: (formData: FormData) => void;
  requestId: string;
  riders: Rider[];
  currentRiderName: string | null;
  label: string;
}) {
  return (
    <form action={action} className="space-y-1.5">
      <input type="hidden" name="requestId" value={requestId} />
      <label className="text-[11px] font-semibold text-slate-500">{label}</label>
      <div className="flex gap-1.5">
        <select name="riderId" defaultValue="" required className="input !py-1.5 text-xs">
          <option value="" disabled>
            {currentRiderName ? `Reassign (currently ${currentRiderName})` : "Select a rider…"}
          </option>
          {riders.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <button type="submit" className="btn-primary shrink-0 !px-3 !py-1.5 text-xs">
          {currentRiderName ? "Reassign" : "Assign"}
        </button>
      </div>
    </form>
  );
}

export default function PickupDeliveryBoard({ jobs, riders }: { jobs: Job[]; riders: Rider[] }) {
  if (jobs.length === 0) {
    return (
      <p className="card text-center text-sm text-slate-400">
        No Pickup &amp; Delivery requests yet. Once the public form has it enabled (or a request is submitted while testing it locally),
        they&apos;ll show up here.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
      {COLUMNS.map((col) => {
        const colJobs = jobs.filter((j) => col.stages.includes(j.stage));
        return (
          <div key={col.key} className="space-y-3">
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-slate-800">{col.label}</p>
              <span className="text-xs text-slate-400">· {colJobs.length}</span>
            </div>
            <div className="space-y-3">
              {colJobs.map((job) => (
                <div key={job.id} className="card space-y-2 !p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] text-slate-400">{job.reference}</span>
                    <span className="badge border border-slate-200 bg-slate-50 text-slate-500">{job.statusLabel}</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-800">
                    {job.customerName} — {job.deviceOther || "Device"}
                  </p>
                  <p className="text-xs text-slate-400">
                    {job.street}, {job.city}
                    {job.province ? `, ${job.province}` : ""}
                  </p>

                  {(job.stage === "requested" || job.stage === "pickup_assigned") && (
                    <RiderAssignForm
                      action={assignPickupRider}
                      requestId={job.id}
                      riders={riders}
                      currentRiderName={job.pickupRiderName}
                      label="Pickup rider"
                    />
                  )}

                  {job.stage === "picked_up" && (
                    <div className="space-y-0.5 text-xs text-slate-500">
                      <p>
                        Picked up by <span className="font-medium text-slate-700">{job.pickupRiderName}</span>
                        {job.pickedUpAt ? `, ${formatDateTime(job.pickedUpAt)}` : ""}
                      </p>
                      <p>Technician: {job.technicianName ? <span className="font-medium text-slate-700">{job.technicianName}</span> : "Not yet assigned"}</p>
                    </div>
                  )}

                  {(job.stage === "ready_for_delivery" || job.stage === "delivery_assigned") && (
                    <>
                      <p className="text-xs text-slate-500">
                        Repaired by <span className="font-medium text-slate-700">{job.technicianName ?? "—"}</span>
                      </p>
                      <RiderAssignForm
                        action={assignDeliveryRider}
                        requestId={job.id}
                        riders={riders}
                        currentRiderName={job.deliveryRiderName}
                        label="Delivery rider (can differ from pickup)"
                      />
                    </>
                  )}

                  {(job.stage === "out_for_delivery" || job.stage === "delivered") && (
                    <div className="space-y-0.5 text-xs text-slate-500">
                      <p>
                        Pickup: <span className="font-medium text-slate-700">{job.pickupRiderName ?? "—"}</span>
                      </p>
                      <p>
                        Delivery: <span className="font-medium text-slate-700">{job.deliveryRiderName ?? "—"}</span>
                      </p>
                      {job.deliveredAt && <p className="font-medium text-green-700">Delivered {formatDateTime(job.deliveredAt)}</p>}
                    </div>
                  )}
                </div>
              ))}
              {colJobs.length === 0 && <p className="text-center text-xs text-slate-300">—</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
