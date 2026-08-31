"use client";

import { useState } from "react";
import Link from "next/link";
import { technicianUpdateStatus } from "@/lib/actions";
import StatusBadge from "./StatusBadge";
import { formatDate } from "@/lib/format";

type Status = { id: string; label: string };
type Req = {
  id: string;
  reference: string;
  customerName: string;
  phone: string;
  street: string;
  city: string;
  province: string;
  landmark: string;
  issueDescription: string;
  photoDataUrl: string | null;
  deviceLabel: string;
  serviceTypeLabel: string;
  preferredDatetime: string;
  statusId: string;
  adminNotes: string;
  inProgress: boolean;
  hasPreAgreement: boolean;
  hasPostAgreement: boolean;
  customFieldEntries: { label: string; value: string | boolean }[];
};

export default function TechnicianBoard({ requests, statuses }: { requests: Req[]; statuses: Status[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (requests.length === 0) {
    return <p className="card text-center text-sm text-slate-400">No requests assigned to you right now.</p>;
  }

  return (
    <div className="space-y-4">
      {requests.map((r) => {
        const status = statuses.find((s) => s.id === r.statusId);
        const open = openId === r.id;
        return (
          <div key={r.id} className="card space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-blue-300">{r.reference}</span>
              {status && <StatusBadge label={status.label} />}
            </div>
            <div>
              <p className="font-semibold text-slate-800">{r.customerName}</p>
              <p className="text-xs text-slate-400">{r.phone}</p>
            </div>
            <p className="text-sm text-slate-600">
              {r.street}, {r.city}
              {r.province ? `, ${r.province}` : ""}
              {r.landmark ? ` (near ${r.landmark})` : ""}
            </p>
            <p className="text-sm text-slate-600">
              <span className="text-slate-400">{r.serviceTypeLabel}:</span> {r.issueDescription}
            </p>
            {r.photoDataUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={r.photoDataUrl} alt="Device issue" className="max-h-56 w-full rounded-lg border border-slate-200 object-contain" />
            )}
            <p className="text-xs text-slate-400">Device: {r.deviceLabel}</p>
            <p className="text-xs text-slate-400">Preferred: {formatDate(r.preferredDatetime)}</p>
            {r.customFieldEntries.map((e) => (
              <p key={e.label} className="text-xs text-slate-400">
                {e.label}: {typeof e.value === "boolean" ? (e.value ? "Yes" : "No") : e.value || "—"}
              </p>
            ))}
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
