"use client";

import { useRef, useState } from "react";
import { createTechnician, updateTechnician, toggleTechnicianActive, deleteTechnician } from "@/lib/actions";

type Opt = { id: string; name: string };
type Tech = {
  id: string;
  name: string;
  contactNumber: string;
  email: string;
  employmentStatus: string;
  branchIds: string[];
  active: boolean;
};

export default function TechnicianManager({ technicians, branches }: { technicians: Tech[]; branches: Opt[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [branchSel, setBranchSel] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = technicians.find((t) => t.id === editingId);

  function startEdit(t: Tech) {
    setEditingId(t.id);
    setBranchSel(t.branchIds);
  }
  function reset() {
    setEditingId(null);
    setBranchSel([]);
    formRef.current?.reset();
  }

  return (
    <div className="space-y-6">
      <div className="card space-y-4">
        <h3 className="text-sm font-semibold text-slate-800">{editingId ? "Edit Technician" : "Add Technician"}</h3>
        <form
          ref={formRef}
          action={(fd) => {
            if (editingId) {
              fd.set("id", editingId);
              updateTechnician(fd);
            } else {
              createTechnician(fd);
            }
            reset();
          }}
          className="space-y-3"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Name *</label>
              <input name="name" required defaultValue={editing?.name ?? ""} className="input" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Contact Number</label>
              <input name="contactNumber" defaultValue={editing?.contactNumber ?? ""} className="input" placeholder="0917 200 0001" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Email</label>
              <input name="email" type="email" defaultValue={editing?.email ?? ""} className="input" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">Employment Status</label>
            <select name="employmentStatus" defaultValue={editing?.employmentStatus ?? "full_time"} className="input max-w-xs">
              <option value="full_time">Full-time</option>
              <option value="part_time">Part-time</option>
              <option value="contractor">Contractor</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">Branch(es)</label>
            <div className="flex flex-wrap gap-2">
              {branches.map((b) => (
                <label
                  key={b.id}
                  className={`badge cursor-pointer border ${
                    branchSel.includes(b.id) ? "border-blue-300 bg-blue-100 text-blue-300" : "border-slate-300 bg-slate-100 text-slate-500"
                  }`}
                >
                  <input
                    type="checkbox"
                    name="branchIds"
                    value={b.id}
                    checked={branchSel.includes(b.id)}
                    onChange={() => setBranchSel((s) => (s.includes(b.id) ? s.filter((x) => x !== b.id) : [...s, b.id]))}
                    className="sr-only"
                  />
                  {b.name}
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary">
              {editingId ? "Save Changes" : "Add Technician"}
            </button>
            {editingId && (
              <button type="button" className="btn-secondary" onClick={reset}>
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
              <th className="pb-2 pr-3">Name</th>
              <th className="pb-2 pr-3">Contact</th>
              <th className="pb-2 pr-3">Branch(es)</th>
              <th className="pb-2 pr-3">Status</th>
              <th className="pb-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {technicians.map((t) => (
              <tr key={t.id} className="border-b border-slate-200 last:border-0">
                <td className="py-3 pr-3 font-medium text-slate-800">{t.name}</td>
                <td className="py-3 pr-3 text-slate-500">{t.contactNumber}</td>
                <td className="py-3 pr-3 text-slate-500">{branches.filter((b) => t.branchIds.includes(b.id)).map((b) => b.name).join(", ") || "—"}</td>
                <td className="py-3 pr-3">
                  <form action={toggleTechnicianActive}>
                    <input type="hidden" name="id" value={t.id} />
                    <button
                      type="submit"
                      className={`badge border ${t.active ? "border-green-200 bg-green-50 text-green-700" : "border-slate-300 bg-slate-100 text-slate-500"}`}
                    >
                      {t.active ? "Active" : "Inactive"}
                    </button>
                  </form>
                </td>
                <td className="py-3">
                  <div className="flex gap-1.5">
                    <button className="btn-secondary !px-3 !py-1 text-xs" onClick={() => startEdit(t)}>
                      Edit
                    </button>
                    <form
                      action={(fd) => {
                        if (confirm(`Delete "${t.name}"? This can't be undone. Any account linked to them stays, just unlinked.`)) deleteTechnician(fd);
                      }}
                    >
                      <input type="hidden" name="id" value={t.id} />
                      <button type="submit" className="btn-secondary !px-3 !py-1 text-xs !text-red-600">
                        Delete
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
