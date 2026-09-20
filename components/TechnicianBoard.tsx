"use client";

import { useState } from "react";
import Link from "next/link";
import { technicianUpdateStatus } from "@/lib/actions";
import StatusBadge from "./StatusBadge";
import Linkify from "./Linkify";
import { formatDate, formatDateTime } from "@/lib/format";

type Status = { id: string; label: string };
type Req = {
  id: string;
  reference: string;
  customerName: string;
  phone: string;
  email: string;
  street: string;
  barangay: string;
  city: string;
  province: string;
  landmark: string;
  issueDescription: string;
  photoDataUrl: string | null;
  deviceLabel: string;
  serviceTypeLabel: string;
  preferredDatetime: string;
  vlogConsent: boolean;
  vlogBlurPreference: "blurred" | "not_blurred" | "";
  createdAt: string;
  statusId: string;
  adminNotes: string;
  confirmedAt: string | null;
  repairCost: number | null;
  serviceFee: number | null;
  inProgress: boolean;
  hasPreAgreement: boolean;
  hasPostAgreement: boolean;
  customFieldEntries: { label: string; value: string | boolean }[];
};

// One stacked label-over-value row for the Request Details block — bigger
// and more spaced out than the rest of the admin UI on purpose, since
// technicians read this in the field, often on a phone in bright sunlight.
function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-sm text-slate-400">{label}</p>
      <p className="text-lg text-slate-900">{children}</p>
    </div>
  );
}

const peso = (n: number) => `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function TechnicianBoard({ requests, statuses }: { requests: Req[]; statuses: Status[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [tab, setTab] = useState<"pending" | "completed">("pending");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  if (requests.length === 0) {
    return <p className="card text-center text-sm text-slate-400">No requests assigned to you right now.</p>;
  }

  const completedStatusId = statuses.find((s) => s.label === "Completed")?.id;
  const pending = requests.filter((r) => r.statusId !== completedStatusId);
  const completed = requests.filter((r) => r.statusId === completedStatusId);
  const tabbed = tab === "pending" ? pending : completed;
  const visible = [...tabbed].sort((a, b) =>
    sortOrder === "asc" ? (a.preferredDatetime < b.preferredDatetime ? -1 : 1) : a.preferredDatetime < b.preferredDatetime ? 1 : -1
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <button
            className={`badge cursor-pointer border px-3 py-1.5 text-sm ${
              tab === "pending" ? "border-blue-300 bg-blue-50 text-blue-700" : "border-slate-300 bg-slate-100 text-slate-500"
            }`}
            onClick={() => setTab("pending")}
          >
            Pending ({pending.length})
          </button>
          <button
            className={`badge cursor-pointer border px-3 py-1.5 text-sm ${
              tab === "completed" ? "border-green-300 bg-green-50 text-green-700" : "border-slate-300 bg-slate-100 text-slate-500"
            }`}
            onClick={() => setTab("completed")}
          >
            Completed ({completed.length})
          </button>
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-500">
          Sort by date
          <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")} className="input w-auto !py-1.5 text-xs">
            <option value="asc">Soonest first</option>
            <option value="desc">Latest first</option>
          </select>
        </label>
      </div>

      {visible.length === 0 && (
        <p className="card text-center text-sm text-slate-400">
          {tab === "pending" ? "No pending jobs right now." : "No completed jobs yet."}
        </p>
      )}

      {visible.map((r) => {
        const status = statuses.find((s) => s.id === r.statusId);
        const open = openId === r.id;
        return (
          <div key={r.id} className="card space-y-5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-blue-300">{r.reference}</span>
              {status && <StatusBadge label={status.label} />}
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-bold text-slate-900">Request Details</h3>
              <DetailRow label="Customer">{r.customerName}</DetailRow>
              <DetailRow label="Phone">{r.phone}</DetailRow>
              {r.email && <DetailRow label="Email">{r.email}</DetailRow>}
              <DetailRow label="Device">{r.deviceLabel}</DetailRow>
              <DetailRow label="Service Type">{r.serviceTypeLabel}</DetailRow>
              <DetailRow label="Issue">{r.issueDescription}</DetailRow>
              <DetailRow label="Quotation">
                {r.repairCost !== null ? peso(r.repairCost) : "Confirmed upon inspection"}
                {r.serviceFee !== null && <span className="text-sm text-slate-400"> + {peso(r.serviceFee)} service fee</span>}
                {r.repairCost !== null && r.serviceFee !== null && (
                  <span className="block text-sm text-slate-400">Total: {peso(r.repairCost + r.serviceFee)}</span>
                )}
              </DetailRow>
              <DetailRow label="Address">
                <Linkify
                  text={`${r.street}${r.barangay ? `, Brgy. ${r.barangay}` : ""}, ${r.city}${r.province ? `, ${r.province}` : ""}${r.landmark ? ` (near ${r.landmark})` : ""}`}
                />
              </DetailRow>
              <DetailRow label="Preferred">{formatDate(r.preferredDatetime)}</DetailRow>
              <DetailRow label="Vlog Consent">
                {r.vlogConsent
                  ? `Yes — ${r.vlogBlurPreference === "blurred" ? "face blurred" : r.vlogBlurPreference === "not_blurred" ? "face not blurred" : "preference not set"}`
                  : "No"}
              </DetailRow>
              {r.customFieldEntries.map((e) => (
                <DetailRow key={e.label} label={e.label}>
                  {typeof e.value === "boolean" ? (e.value ? "Yes" : "No") : e.value || "—"}
                </DetailRow>
              ))}
              <DetailRow label="Submitted">{formatDateTime(r.createdAt)}</DetailRow>
              {r.photoDataUrl && (
                <div>
                  <p className="text-sm text-slate-400">Photo</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.photoDataUrl} alt="Device issue" className="mt-1 max-h-72 w-full rounded-lg border border-slate-200 object-contain" />
                </div>
              )}
            </div>

            {r.adminNotes && <p className="whitespace-pre-line rounded-md bg-slate-50 p-2 text-xs text-slate-500">{r.adminNotes}</p>}

            {(r.inProgress || r.hasPostAgreement) && (
              <Link
                href={`/technician/requests/${r.id}/checklist`}
                className={r.hasPostAgreement ? "btn-secondary block w-full text-center text-xs" : "btn-primary block w-full text-center text-xs"}
              >
                {r.hasPostAgreement
                  ? "✅ View Completed Checklists"
                  : r.hasPreAgreement
                  ? "🔧 Open Post-Repair Checklist"
                  : "📋 Open Pre-Repair Checklist"}
              </Link>
            )}

            <button className="btn-secondary w-full text-xs" onClick={() => setOpenId(open ? null : r.id)}>
              {open ? "Cancel" : "Update Status / Add Note"}
            </button>
            {open && (
              <form
                action={(fd) => {
                  technicianUpdateStatus(fd);
                  setOpenId(null);
                }}
                className="space-y-2"
              >
                <input type="hidden" name="id" value={r.id} />
                <select name="statusId" defaultValue={r.statusId} className="input">
                  {statuses.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <textarea name="note" rows={2} className="input" placeholder="Job note (optional)" />
                <button type="submit" className="btn-primary w-full">
                  Save
                </button>
              </form>
            )}
          </div>
        );
      })}
    </div>
  );
}
