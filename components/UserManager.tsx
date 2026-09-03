"use client";

import { useRef, useState } from "react";
import { createUser, updateUser, toggleUserActive } from "@/lib/actions";
import type { Role } from "@/lib/types";

type Technician = { id: string; name: string };
type Branch = { id: string; name: string };
type UserRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  technicianId: string | null;
  assignedBranchIds: string[];
  canManageRequests: boolean;
  canViewAllBranches: boolean;
  active: boolean;
};

const ROLE_LABELS: Record<Role, string> = {
  owner_admin: "Owner Admin",
  branch_admin: "Branch Admin",
  technician: "Technician",
};

export default function UserManager({
  users,
  technicians,
  branches,
  currentUserId,
}: {
  users: UserRow[];
  technicians: Technician[];
  branches: Branch[];
  currentUserId: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [role, setRole] = useState<Role>("branch_admin");
  const [showPassword, setShowPassword] = useState(false);
  const editing = users.find((u) => u.id === editingId);

  function startEdit(u: UserRow) {
    setEditingId(u.id);
    setRole(u.role);
  }
  function reset() {
    setEditingId(null);
    setRole("branch_admin");
    setShowPassword(false);
    formRef.current?.reset();
  }

  return (
    <div className="space-y-6">
      <div className="card space-y-4">
        <h3 className="text-sm font-semibold text-slate-800">{editingId ? `Edit "${editing?.name}"` : "Add Staff Account"}</h3>
        <form
          ref={formRef}
          action={(fd) => {
            if (editingId) {
              fd.set("id", editingId);
              updateUser(fd);
            } else {
              createUser(fd);
            }
            reset();
          }}
          className="space-y-3"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Name *</label>
              <input name="name" required defaultValue={editing?.name ?? ""} className="input" placeholder="Juan Dela Cruz" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Email *</label>
              <input name="email" type="email" required defaultValue={editing?.email ?? ""} className="input" placeholder="juan@ceejay.ph" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">
                Password {editingId ? <span className="text-slate-400">(leave blank to keep current)</span> : "*"}
              </label>
              <div className="relative">
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required={!editingId}
                  className="input pr-10"
                  placeholder={editingId ? "••••••••" : "Set a password"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c6.5 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                      <path d="M6.61 6.61A13.53 13.53 0 0 0 2 11s3.5 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                      <line x1="2" y1="2" x2="22" y2="22" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Role *</label>
              <select name="role" required value={role} onChange={(e) => setRole(e.target.value as Role)} className="input">
                <option value="owner_admin">Owner Admin</option>
                <option value="branch_admin">Branch Admin</option>
                <option value="technician">Technician</option>
              </select>
            </div>
          </div>
          {role === "technician" && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Linked Technician</label>
              <select name="technicianId" defaultValue={editing?.technicianId ?? ""} className="input">
                <option value="">Not linked</option>
                {technicians.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              {technicians.length === 0 && (
                <p className="text-[11px] text-amber-700">No technician records yet — add one from Settings &gt; Technicians first.</p>
              )}
              <p className="text-[11px] text-slate-400">Links this login to a Technician record so they only see jobs assigned to them.</p>
            </div>
          )}
          {role === "branch_admin" && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Assigned Branch(es)</label>
              <div className="flex flex-wrap gap-3 rounded-md border border-slate-200 p-2.5">
                {branches.map((b) => (
                  <label key={b.id} className="flex items-center gap-1.5 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      name="assignedBranchIds"
                      value={b.id}
                      defaultChecked={editing?.assignedBranchIds.includes(b.id) ?? false}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    {b.name}
                  </label>
                ))}
                {branches.length === 0 && <p className="text-xs text-slate-400">No branches set up yet.</p>}
              </div>
              <p className="text-[11px] text-slate-400">
                Check the branch(es) this account is allowed to access — they&apos;ll only see tickets, sales, and branch options for those
                branches. Leave all unchecked to allow access to every branch (no restriction).
              </p>
            </div>
          )}
          {role === "branch_admin" && (
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name="canManageRequests"
                  defaultChecked={editing?.canManageRequests ?? true}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Can access and manage Home Service Requests
              </label>
              <p className="text-[11px] text-slate-400">
                Uncheck to hide the Home Service Requests section from this account entirely — no viewing, reassigning, or updating request
                status or notes.
              </p>
            </div>
          )}
          {role === "branch_admin" && (
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name="canViewAllBranches"
                  defaultChecked={editing?.canViewAllBranches ?? false}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Can view combined Sales &amp; income for all branches
              </label>
              <p className="text-[11px] text-slate-400">
                Off by default: this account only sees the individual card(s) for their own assigned branch(es) on Branch Sales — never the
                combined &quot;All Branches&quot; totals or the Owner Deductions section. Check this to grant that combined view.
              </p>
            </div>
          )}
          <div className="flex gap-2">
            <button type="submit" className="btn-primary">
              {editingId ? "Save Changes" : "Add Account"}
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
              <th className="pb-2 pr-3">Email</th>
              <th className="pb-2 pr-3">Role</th>
              <th className="pb-2 pr-3">Linked Technician</th>
              <th className="pb-2 pr-3">Status</th>
              <th className="pb-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-slate-400">
                  No staff accounts yet.
                </td>
              </tr>
            )}
            {users.map((u) => (
              <tr key={u.id} className="border-b border-slate-200 last:border-0">
                <td className="py-3 pr-3 font-medium text-slate-800">
                  {u.name}
                  {u.id === currentUserId && <span className="ml-1.5 text-[11px] text-slate-400">(you)</span>}
                </td>
                <td className="py-3 pr-3 text-slate-500">{u.email}</td>
                <td className="py-3 pr-3 text-slate-500">{ROLE_LABELS[u.role]}</td>
                <td className="py-3 pr-3 text-slate-500">{technicians.find((t) => t.id === u.technicianId)?.name ?? "—"}</td>
                <td className="py-3 pr-3">
                  {u.id === currentUserId ? (
                    <span className="badge border border-green-200 bg-green-50 text-green-700">Active</span>
                  ) : (
                    <form action={toggleUserActive}>
                      <input type="hidden" name="id" value={u.id} />
                      <button
                        type="submit"
                        className={`badge border ${u.active ? "border-green-200 bg-green-50 text-green-700" : "border-slate-300 bg-slate-100 text-slate-500"}`}
                      >
                        {u.active ? "Active" : "Inactive"}
                      </button>
                    </form>
                  )}
                </td>
                <td className="py-3">
                  <button className="btn-secondary !px-3 !py-1 text-xs" onClick={() => startEdit(u)}>
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
