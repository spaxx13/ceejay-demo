"use client";

import { useRef, useState } from "react";
import { createRider, updateRider, toggleRiderActive, adminSetRiderOnDuty, deleteRider } from "@/lib/actions";

type Opt = { id: string; name: string };
type RiderRow = {
  id: string;
  name: string;
  contactNumber: string;
  email: string;
  branchId: string | null;
  vehicle: string;
  active: boolean;
  onDuty: boolean;
};

const VEHICLES = [
  { value: "motorcycle", label: "Motorcycle" },
  { value: "car", label: "Car" },
  { value: "bicycle", label: "Bicycle" },
];


function OnDutyBadge({ riderId, onDuty }: { riderId: string; onDuty: boolean }) {
  return (
    <form action={adminSetRiderOnDuty}>
      <input type="hidden" name="id" value={riderId} />
      <button
        type="submit"
        className={`badge border ${onDuty ? "border-green-200 bg-green-50 text-green-700" : "border-slate-300 bg-slate-100 text-slate-500"}`}
        title="Admin override — the rider normally toggles this themselves from My Jobs."
      >
        {onDuty ? "🟢 On Duty" : "⚪ Off Duty"}
      </button>
    </form>
  );
}

export default function RiderManager({ riders, branches }: { riders: RiderRow[]; branches: Opt[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = riders.find((r) => r.id === editingId);

  function startEdit(r: RiderRow) {
    setEditingId(r.id);
  }
  function reset() {
    setEditingId(null);
    formRef.current?.reset();
  }

  const branchName = (id: string | null) => branches.find((b) => b.id === id)?.name ?? "—";
  const vehicleLabel = (v: string) => VEHICLES.find((x) => x.value === v)?.label ?? v;

  return (
    <div className="space-y-6">
      <div className="card space-y-4">
        <h3 className="text-sm font-semibold text-slate-800">{editingId ? "Edit Rider" : "Add Rider"}</h3>
        <form
          ref={formRef}
          action={(fd) => {
            if (editingId) {
              fd.set("id", editingId);
              updateRider(fd);
            } else {
              createRider(fd);
            }
            reset();
          }}
          className="space-y-3"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Name *</label>
              <input name="name" required defaultValue={editing?.name ?? ""} className="input" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Contact Number</label>
              <input name="contactNumber" defaultValue={editing?.contactNumber ?? ""} className="input" placeholder="0917 200 0001" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Home Branch</label>
              <select name="branchId" defaultValue={editing?.branchId ?? ""} className="input">
                <option value="">Unassigned</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400">For roster/display only — a rider can be assigned to any request, any branch.</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Vehicle</label>
              <select name="vehicle" defaultValue={editing?.vehicle ?? "motorcycle"} className="input">
                {VEHICLES.map((v) => (
                  <option key={v.value} value={v.value}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">Email</label>
            <input name="email" type="email" defaultValue={editing?.email ?? ""} className="input max-w-sm" />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary">
              {editingId ? "Save Changes" : "Add Rider"}
            </button>
            {editingId && (
              <button type="button" className="btn-secondary" onClick={reset}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Mobile: one card per rider. */}
      <div className="space-y-3 sm:hidden">
        {riders.map((r) => (
          <div key={r.id} className="card space-y-2">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-slate-800">{r.name}</p>
              <div className="flex flex-wrap justify-end gap-1.5">
                <OnDutyBadge riderId={r.id} onDuty={r.onDuty} />
                <form action={toggleRiderActive}>
                  <input type="hidden" name="id" value={r.id} />
                  <button
                    type="submit"
                    className={`badge border ${r.active ? "border-green-200 bg-green-50 text-green-700" : "border-slate-300 bg-slate-100 text-slate-500"}`}
                  >
                    {r.active ? "Active" : "Inactive"}
                  </button>
                </form>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-y-1 text-xs">
              <span className="text-slate-400">Contact</span>
              <span className="text-right text-slate-600">{r.contactNumber || "—"}</span>
              <span className="text-slate-400">Home Branch</span>
              <span className="text-right text-slate-600">{branchName(r.branchId)}</span>
              <span className="text-slate-400">Vehicle</span>
              <span className="text-right text-slate-600">{vehicleLabel(r.vehicle)}</span>
            </div>
            <div className="flex gap-1.5 pt-1">
              <button className="btn-secondary flex-1 !py-1.5 text-xs" onClick={() => startEdit(r)}>
                Edit
              </button>
              <form
                className="flex-1"
                action={(fd) => {
                  if (confirm(`Delete "${r.name}"? This can't be undone. Any account linked to them stays, just unlinked.`)) deleteRider(fd);
                }}
              >
                <input type="hidden" name="id" value={r.id} />
                <button type="submit" className="btn-secondary w-full !py-1.5 text-xs !text-red-600">
                  Delete
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop/tablet: full table. */}
      <div className="hidden card overflow-x-auto sm:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
              <th className="pb-2 pr-3">Name</th>
              <th className="pb-2 pr-3">Contact</th>
              <th className="pb-2 pr-3">Home Branch</th>
              <th className="pb-2 pr-3">Vehicle</th>
              <th className="pb-2 pr-3">On Duty</th>
              <th className="pb-2 pr-3">Status</th>
              <th className="pb-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {riders.map((r) => (
              <tr key={r.id} className="border-b border-slate-200 last:border-0">
                <td className="py-3 pr-3 font-medium text-slate-800">{r.name}</td>
                <td className="py-3 pr-3 text-slate-500">{r.contactNumber}</td>
                <td className="py-3 pr-3 text-slate-500">{branchName(r.branchId)}</td>
                <td className="py-3 pr-3 text-slate-500">{vehicleLabel(r.vehicle)}</td>
                <td className="py-3 pr-3">
                  <OnDutyBadge riderId={r.id} onDuty={r.onDuty} />
                </td>
                <td className="py-3 pr-3">
                  <form action={toggleRiderActive}>
                    <input type="hidden" name="id" value={r.id} />
                    <button
                      type="submit"
                      className={`badge border ${r.active ? "border-green-200 bg-green-50 text-green-700" : "border-slate-300 bg-slate-100 text-slate-500"}`}
                    >
                      {r.active ? "Active" : "Inactive"}
                    </button>
                  </form>
                </td>
                <td className="py-3">
                  <div className="flex gap-1.5">
                    <button className="btn-secondary !px-3 !py-1 text-xs" onClick={() => startEdit(r)}>
                      Edit
                    </button>
                    <form
                      action={(fd) => {
                        if (confirm(`Delete "${r.name}"? This can't be undone. Any account linked to them stays, just unlinked.`)) deleteRider(fd);
                      }}
                    >
                      <input type="hidden" name="id" value={r.id} />
                      <button type="submit" className="btn-secondary !px-3 !py-1 text-xs !text-red-600">
                        Delete
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {riders.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-sm text-slate-400">
                  No riders yet — add one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
