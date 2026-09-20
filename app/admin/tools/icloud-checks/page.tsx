import { getIcloudChecksForAdmin } from "@/lib/db";
import { retryIcloudCheck, markIcloudRefundNeeded } from "@/lib/actions";
import StatusBadge from "@/components/StatusBadge";
import { formatDateTime } from "@/lib/format";

const peso = (n: number) => `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function IcloudChecksPage() {
  const checks = await getIcloudChecksForAdmin();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">iCloud Status Checks</h1>
        <p className="mt-1 text-sm text-slate-400">
          Every attempt on the public ₱10 iCloud ON/OFF checker. A customer has already paid by the time a row shows here as
          &quot;check_failed&quot; — use Retry Check before considering a refund.
        </p>
      </div>

      {checks.length === 0 ? (
        <p className="card text-center text-sm text-slate-400">No checks yet.</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                <th className="pb-2 pr-3 font-medium">Created</th>
                <th className="pb-2 pr-3 font-medium">IMEI/Serial</th>
                <th className="pb-2 pr-3 font-medium">Status</th>
                <th className="pb-2 pr-3 font-medium">Amount</th>
                <th className="pb-2 pr-3 font-medium">Result / Failure</th>
                <th className="pb-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {checks.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 last:border-0 align-top">
                  <td className="py-2 pr-3 whitespace-nowrap text-slate-500">{formatDateTime(c.createdAt)}</td>
                  <td className="py-2 pr-3 font-mono text-xs text-slate-700">{c.imei}</td>
                  <td className="py-2 pr-3">
                    <StatusBadge label={c.status} />
                  </td>
                  <td className="py-2 pr-3 text-slate-800">{peso(c.amount)}</td>
                  <td className="py-2 pr-3 text-slate-600">
                    {c.status === "checked" && (
                      <span>
                        {c.icloudStatus} — {c.resultSummary}
                      </span>
                    )}
                    {(c.status === "check_failed" || c.status === "refund_needed") && (
                      <span className="text-red-700">{c.failureReason}</span>
                    )}
                    {c.status === "refund_needed" && c.adminNote && <p className="mt-1 text-xs text-slate-400">Note: {c.adminNote}</p>}
                  </td>
                  <td className="py-2">
                    {c.status === "check_failed" && (
                      <div className="flex flex-wrap gap-2">
                        <form action={retryIcloudCheck}>
                          <input type="hidden" name="id" value={c.id} />
                          <button type="submit" className="btn-secondary !px-3 !py-1 text-xs">
                            Retry Check
                          </button>
                        </form>
                        <form action={markIcloudRefundNeeded} className="flex items-center gap-1">
                          <input type="hidden" name="id" value={c.id} />
                          <input name="adminNote" placeholder="Note (optional)" className="input !w-32 !py-1 text-xs" />
                          <button type="submit" className="btn-secondary !px-3 !py-1 text-xs">
                            Mark Refund Needed
                          </button>
                        </form>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
