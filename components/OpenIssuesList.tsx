import { resolveRequestException } from "@/lib/actions";
import { formatDateTime } from "@/lib/format";
import { REQUEST_EXCEPTION_LABELS, type RequestException } from "@/lib/types";

type Issue = RequestException & { reference: string; customerName: string };

// Admin's view into Pickup & Delivery's Exception Handling (FINAL FLOW
// spec item 31 + the "Cancellations, Disputes, Incidents" line of item
// 35's dashboard) — every unresolved request_exceptions row, across every
// job, in one place instead of having to open each request individually.
export default function OpenIssuesList({ issues }: { issues: Issue[] }) {
  if (issues.length === 0) return null;

  return (
    <div className="card space-y-3">
      <h3 className="text-sm font-bold text-slate-800">Open Issues ({issues.length})</h3>
      <div className="space-y-2">
        {issues.map((issue) => (
          <div key={issue.id} className="space-y-1.5 rounded-lg border border-red-200 bg-red-50 p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-red-700">{REQUEST_EXCEPTION_LABELS[issue.kind]}</p>
                <p className="text-xs text-slate-500">
                  <span className="font-mono">{issue.reference}</span> — {issue.customerName}
                </p>
              </div>
              <form action={resolveRequestException}>
                <input type="hidden" name="exceptionId" value={issue.id} />
                <button type="submit" className="btn-secondary shrink-0 !px-2.5 !py-1 text-xs">
                  Resolve
                </button>
              </form>
            </div>
            <p className="text-xs text-slate-600">{issue.reason}</p>
            {issue.evidencePhotoDataUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={issue.evidencePhotoDataUrl} alt="Evidence" className="h-16 w-16 rounded-lg border border-slate-200 object-cover" />
            )}
            <p className="text-[11px] text-slate-400">
              Reported by {issue.reportedBy} ({issue.reportedByRole}) — {formatDateTime(issue.createdAt)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
