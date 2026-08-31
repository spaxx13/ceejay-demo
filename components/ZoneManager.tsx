"use client";

import { useRef, useState } from "react";
import { createZone, updateZone, toggleZoneActive } from "@/lib/actions";

type Technician = { id: string; name: string; active: boolean };
type Zone = {
  id: string;
  name: string;
  city: string;
  province: string;
  notes: string;
  active: boolean;
  technicianIds: string[];
};

export default function ZoneManager({ zones, technicians }: { zones: Zone[]; technicians: Technician[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  function startEdit(zone: Zone) {
    setEditingId(zone.id);
    setSelected(zone.technicianIds);
  }

  return (
    <div className="space-y-6">
      <div className="card space-y-4">
        <h3 className="text-sm font-semibold text-slate-800">{editingId ? "Edit Zone" : "Add Zone"}</h3>
        <form
          ref={formRef}
          action={(fd) => {
            if (editingId) {
              fd.set("id", editingId);
              updateZone(fd);
            } else {
              createZone(fd);
            }
            formRef.current?.reset();
            setSelected([]);
            setEditingId(null);
          }}
          className="space-y-3"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Zone Name *</label>
              <input name="name" required defaultValue={editingId ? zones.find((z) => z.id === editingId)?.name : ""} className="input" placeholder="e.g. North Quezon City" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">City / Municipality</label>
              <input name="city" defaultValue={editingId ? zones.find((z) => z.id === editingId)?.city : ""} className="input" placeholder="Must match customer entry" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Province</label>
              <input name="province" defaultValue={editingId ? zones.find((z) => z.id === editingId)?.province : ""} className="input" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">Notes</label>
            <input name="notes" defaultValue={editingId ? zones.find((z) => z.id === editingId)?.notes : ""} className="input" placeholder="Coverage notes, barangays, etc." />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">Technicians covering this zone</label>
            <div className="flex flex-wrap gap-2">
              {technicians.length === 0 && <p className="text-xs text-slate-400">No technicians yet — add one first.</p>}
              {technicians.map((t) => (
                <label
                  key={t.id}
                  className={`badge cursor-pointer border ${
                    selected.includes(t.id) ? "border-blue-300 bg-blue-100 text-blue-300" : "border-slate-300 bg-slate-100 text-slate-500"
                  }`}
                >
                  <input type="checkbox" name="technicianIds" value={t.id} checked={selected.includes(t.id)} onChange={() => toggle(t.id)} className="sr-only" />
                  {t.name}
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary">
              {editingId ? "Save Changes" : "Add Zone"}
            </button>
            {editingId && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setEditingId(null);
                  setSelected([]);
                  formRef.current?.reset();
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
              <th className="pb-2 pr-3">Zone</th>
              <th className="pb-2 pr-3">City / Province</th>
              <th className="pb-2 pr-3">Technicians</th>
              <th className="pb-2 pr-3">Status</th>
              <th className="pb-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {zones.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-slate-400">
                  No zones yet. Add the first one above — the system starts with zero zones.
                </td>
              </tr>
            )}
            {zones.map((z) => (
              <tr key={z.id} className="border-b border-slate-200 last:border-0">
                <td className="py-3 pr-3 font-medium text-slate-800">{z.name}</td>
                <td className="py-3 pr-3 text-slate-500">
                  {z.city}
                  {z.province ? `, ${z.province}` : ""}
                </td>
                <td className="py-3 pr-3 text-slate-500">
                  {technicians.filter((t) => z.technicianIds.includes(t.id)).map((t) => t.name).join(", ") || (
                    <span className="text-amber-700">none assigned</span>
                  )}
                </td>
                <td className="py-3 pr-3">
                  <form action={toggleZoneActive}>
                    <input type="hidden" name="id" value={z.id} />
                    <button
                      type="submit"
                      className={`badge border ${z.active ? "border-green-200 bg-green-50 text-green-700" : "border-slate-300 bg-slate-100 text-slate-500"}`}
                    >
                      {z.active ? "Active" : "Inactive"}
                    </button>
                  </form>
                </td>
                <td className="py-3">
                  <button className="btn-secondary !px-3 !py-1 text-xs" onClick={() => startEdit(z)}>
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
