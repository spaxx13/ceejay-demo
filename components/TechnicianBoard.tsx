"use client";

import { useState } from "react";
import Link from "next/link";
import { technicianUpdateStatus } from "@/lib/actions";
import StatusBadge from "./StatusBadge";
import Linkify from "./Linkify";
import { formatDate } from "@/lib/format";
import { directionsUrl } from "@/lib/technicianTracking";
import TechnicianLocationSharer from "./TechnicianLocationSharer";

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
  lat: number | null;
  lng: number | null;
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
  downpaymentRequired: boolean;
  downpaymentAmount: number | null;
  downpaymentStatus: "not_required" | "pending" | "paid";
  inProgress: boolean;
  onTheWay: boolean;
  hasPreAgreement: boolean;
  hasPostAgreement: boolean;
  customFieldEntries: { label: string; value: string | boolean }[];
  fulfillmentMode: "on_site" | "pickup_delivery";
  receivedAtShopAt: string | null;
  hasUnboxingVideo: boolean;
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

// Statuses a technician is never allowed to manually set from Update
// Status — "Pending Confirmation" is a customer/admin-side booking state,
// and "Completed" only ever happens automatically, once the Post-Repair
// checklist itself is submitted (lib/actions.ts submitChecklist). Kept as
// labels (not ids) since both are shop-wide fixed lookup rows, and
// enforced again server-side in technicianUpdateStatus.
const TECHNICIAN_RESTRICTED_STATUSES = new Set(["Pending Confirmation", "Completed"]);

export default function TechnicianBoard({ requests, statuses }: { requests: Req[]; statuses: Status[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [tab, setTab] = useState<"pending" | "completed">("pending");
  // The date a job is actually scheduled FOR the technician (the visit
  // date, preferredDatetime) — never the customer's booking submission
  // date, which the technician doesn't need and no longer sees below.
  // null/"" = no date picked, so every job in the current tab still shows.
  const [selectedDate, setSelectedDate] = useState("");

  if (requests.length === 0) {
    return <p className="card text-center text-sm text-slate-400">No requests assigned to you right now.</p>;
  }

  const completedStatusId = statuses.find((s) => s.label === "Completed")?.id;
  const pending = requests.filter((r) => r.statusId !== completedStatusId);
  const completed = requests.filter((r) => r.statusId === completedStatusId);
  const tabbed = tab === "pending" ? pending : completed;
  const dateFiltered = selectedDate ? tabbed.filter((r) => r.preferredDatetime.slice(0, 10) === selectedDate) : tabbed;
  const visible = [...dateFiltered].sort((a, b) => (a.preferredDatetime < b.preferredDatetime ? -1 : 1));

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
          Filter by date
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="input w-auto !py-1.5 text-xs"
          />
          {selectedDate && (
            <button type="button" onClick={() => setSelectedDate("")} className="text-blue-500 hover:underline">
              Clear
            </button>
          )}
        </label>
      </div>
      {visible.length === 0 && (
        <p className="card text-center text-sm text-slate-400">
          {selectedDate
            ? "No jobs scheduled for you on this date."
            : tab === "pending"
              ? "No pending jobs right now."
              : "No completed jobs yet."}
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

            {r.downpaymentRequired && (
              <div
                className={`rounded-lg border-2 p-3 text-sm font-semibold ${
                  r.downpaymentStatus === "paid" ? "border-green-300 bg-green-50 text-green-900" : "border-amber-300 bg-amber-50 text-amber-900"
                }`}
              >
                {r.downpaymentStatus === "paid"
                  ? `✅ Down payment paid${r.downpaymentAmount !== null ? ` (${peso(r.downpaymentAmount)})` : ""}`
                  : `⚠️ Down payment not yet paid${r.downpaymentAmount !== null ? ` (${peso(r.downpaymentAmount)})` : ""} — confirm with the customer before starting work.`}
              </div>
            )}

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
              {r.lat !== null && r.lng !== null ? (
                <a
                  href={directionsUrl(r.lat, r.lng)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary block w-full text-center text-sm"
                >
                  📍 Navigate to customer&apos;s pin (Google Maps)
                </a>
              ) : (
                <p className="text-sm text-slate-400">No map pin — use the address and landmark above.</p>
              )}
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
              {r.photoDataUrl && (
                <div>
                  <p className="text-sm text-slate-400">Photo</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.photoDataUrl} alt="Device issue" className="mt-1 max-h-72 w-full rounded-lg border border-slate-200 object-contain" />
                </div>
              )}
            </div>

            {r.onTheWay && <TechnicianLocationSharer requestId={r.id} />}

            {r.adminNotes && <p className="whitespace-pre-line rounded-md bg-slate-50 p-2 text-xs text-slate-500">{r.adminNotes}</p>}

            {r.fulfillmentMode === "pickup_delivery" && r.receivedAtShopAt && (
              <Link
                href={`/technician/requests/${r.id}/unboxing`}
                className={r.hasUnboxingVideo ? "btn-secondary block w-full text-center text-xs" : "btn-primary block w-full text-center text-xs"}
              >
                {r.hasUnboxingVideo ? "🎥 View Unboxing Video" : "🎥 Record Unboxing Video"}
              </Link>
            )}

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
                  {statuses
                    .filter((s) => !TECHNICIAN_RESTRICTED_STATUSES.has(s.label) || s.id === r.statusId)
                    .map((s) => (
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
