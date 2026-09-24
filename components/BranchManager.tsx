"use client";

import { useRef, useState } from "react";
import { createBranch, updateBranch, toggleBranchActive } from "@/lib/actions";
import MapPinPicker from "./MapPinPicker";

const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

type Branch = { id: string; name: string; address: string; contactNumber: string; active: boolean; lat: number | null; lng: number | null };

export default function BranchManager({ branches }: { branches: Branch[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = branches.find((b) => b.id === editingId);

  function reset() {
    setEditingId(null);
    formRef.current?.reset();
  }

  return (
    <div className="space-y-6">
      <div className="card space-y-4">
        <h3 className="text-sm font-semibold text-slate-800">{editingId ? "Edit Branch" : "Add Branch"}</h3>
        <form
          ref={formRef}
          action={(fd) => {
            if (editingId) {
              fd.set("id", editingId);
              updateBranch(fd);
            } else {
              createBranch(fd);
            }
            reset();
          }}
          className="space-y-3"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Branch Name *</label>
              <input name="name" required defaultValue={editing?.name ?? ""} className="input" placeholder="e.g. Ceejay - SM Downtown" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Address</label>
              <input name="address" defaultValue={editing?.address ?? ""} className="input" placeholder="e.g. SM Downtown Premier, Ground Flr" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Contact Number</label>
              <input name="contactNumber" defaultValue={editing?.contactNumber ?? ""} className="input" placeholder="0917-100-0001" />
            </div>
          </div>
          {GOOGLE_MAPS_KEY ? (
            <MapPinPicker
              latName="lat"
              lngName="lng"
              defaultLat={editing?.lat ?? undefined}
              defaultLng={editing?.lng ?? undefined}
              label="Exact Pin (optional, recommended for Pickup & Delivery's live tracking map)"
            />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-500">Exact Pin — Latitude</label>
                  <input name="lat" type="number" step="any" defaultValue={editing?.lat ?? ""} className="input" placeholder="e.g. 14.6197" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-500">Exact Pin — Longitude</label>
                  <input name="lng" type="number" step="any" defaultValue={editing?.lng ?? ""} className="input" placeholder="e.g. 121.0529" />
                </div>
              </div>
              <p className="text-[11px] text-slate-400">
                Optional, but recommended for Pickup &amp; Delivery&apos;s live tracking map — a plain address can geocode to the wrong
                nearby landmark. On Google Maps, right-click the branch&apos;s exact spot → click the coordinates shown at the top to copy
                them, then paste the two numbers above (separated by the comma) into Latitude and Longitude.
              </p>
            </>
          )}
          <div className="flex gap-2">
            <button type="submit" className="btn-primary">
              {editingId ? "Save Changes" : "Add Branch"}
            </button>
            {editingId && (
              <button type="button" className="btn-secondary" onClick={reset}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Mobile: one card per branch — a 5-column table doesn't fit a phone
          screen, so this reflows the same fields as a stacked summary. */}
      <div className="space-y-3 sm:hidden">
        {branches.length === 0 && <p className="card text-center text-sm text-slate-400">No branches yet. Add the first one above.</p>}
        {branches.map((b) => (
          <div key={b.id} className="card space-y-2">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-slate-800">{b.name}</p>
              <form action={toggleBranchActive}>
                <input type="hidden" name="id" value={b.id} />
                <button
                  type="submit"
                  className={`badge border ${b.active ? "border-green-200 bg-green-50 text-green-700" : "border-slate-300 bg-slate-100 text-slate-500"}`}
                >
                  {b.active ? "Active" : "Inactive"}
                </button>
              </form>
            </div>
            <div className="grid grid-cols-2 gap-y-1 text-xs">
              <span className="text-slate-400">Address</span>
              <span className="text-right text-slate-600">{b.address || "—"}</span>
              <span className="text-slate-400">Contact</span>
              <span className="text-right text-slate-600">{b.contactNumber || "—"}</span>
            </div>
            <button className="btn-secondary block w-full !py-1.5 text-xs" onClick={() => setEditingId(b.id)}>
              Edit
            </button>
          </div>
        ))}
      </div>

      {/* Desktop/tablet: full table, same fields. */}
      <div className="hidden card overflow-x-auto sm:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
              <th className="pb-2 pr-3">Branch</th>
              <th className="pb-2 pr-3">Address</th>
              <th className="pb-2 pr-3">Contact</th>
              <th className="pb-2 pr-3">Status</th>
              <th className="pb-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {branches.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-slate-400">
                  No branches yet. Add the first one above.
                </td>
              </tr>
            )}
            {branches.map((b) => (
              <tr key={b.id} className="border-b border-slate-200 last:border-0">
                <td className="py-3 pr-3 font-medium text-slate-800">{b.name}</td>
                <td className="py-3 pr-3 text-slate-500">{b.address || "—"}</td>
                <td className="py-3 pr-3 text-slate-500">{b.contactNumber || "—"}</td>
                <td className="py-3 pr-3">
                  <form action={toggleBranchActive}>
                    <input type="hidden" name="id" value={b.id} />
                    <button
                      type="submit"
                      className={`badge border ${b.active ? "border-green-200 bg-green-50 text-green-700" : "border-slate-300 bg-slate-100 text-slate-500"}`}
                    >
                      {b.active ? "Active" : "Inactive"}
                    </button>
                  </form>
                </td>
                <td className="py-3">
                  <button className="btn-secondary !px-3 !py-1 text-xs" onClick={() => setEditingId(b.id)}>
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
