import type { BookingDetailRow } from "@/lib/bookingDetails";

// The customer's own answers from the booking form (device, service
// needed, problem, extra details, photo) — so admins and riders can see what
// was picked up and what is to be repaired. `compact` is the rider-card
// variant (no outer card chrome).
export default function BookingDetailsCard({
  rows,
  photoDataUrl,
  compact = false,
}: {
  rows: BookingDetailRow[];
  photoDataUrl?: string | null;
  compact?: boolean;
}) {
  if (rows.length === 0 && !photoDataUrl) return null;
  return (
    <div className={compact ? "space-y-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2" : "card space-y-2"}>
      <h3 className={compact ? "text-xs font-semibold uppercase tracking-wide text-slate-500" : "text-sm font-semibold text-slate-800"}>
        What the customer booked
      </h3>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        {rows.map((r, i) => (
          <div key={`${r.label}-${i}`} className="contents">
            <dt className="text-slate-400">{r.label}</dt>
            <dd className="whitespace-pre-line text-right text-slate-700">{r.value}</dd>
          </div>
        ))}
      </dl>
      {photoDataUrl && (
        <div>
          <p className="mb-1 text-xs text-slate-400">Photo from customer</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoDataUrl} alt="Device issue" className="max-h-60 rounded-lg border border-slate-200 object-contain" />
        </div>
      )}
    </div>
  );
}
