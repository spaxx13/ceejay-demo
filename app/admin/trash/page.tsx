import Link from "next/link";
import { redirect } from "next/navigation";
import { getDeletedRequests, getDeletedRepairRecords, getBranches, canDeleteHomeServiceRequests, isBranchHidden } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { restoreHomeServiceRequest, permanentlyDeleteHomeServiceRequest, restoreRepairRecord, permanentlyDeleteRepairRecord } from "@/lib/actions";
import DeleteButton from "@/components/DeleteButton";
import { formatDateTime } from "@/lib/format";

const peso = (n: number) => `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function RestoreButton({ id, action, label = "Restore", className = "btn-secondary !px-3 !py-1 text-xs" }: { id: string; action: (formData: FormData) => void; label?: string; className?: string }) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" className={className}>
        {label}
      </button>
    </form>
  );
}

export default async function TrashPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await getCurrentUser();
  const canPos = user?.role === "owner_admin";
  const canRequests = canDeleteHomeServiceRequests(user);
  if (!canPos && !canRequests) redirect("/admin");

  const { tab: rawTab } = await searchParams;
  const defaultTab = canRequests ? "requests" : "pos";
  const tab = rawTab === "pos" && canPos ? "pos" : rawTab === "requests" && canRequests ? "requests" : defaultTab;

  const [allBranches, deletedRequestsRaw, deletedRecordsRaw] = await Promise.all([
    getBranches(),
    canRequests ? getDeletedRequests() : Promise.resolve([]),
    canPos ? getDeletedRepairRecords() : Promise.resolve([]),
  ]);
  const deletedRequests = deletedRequestsRaw.filter((r) => !isBranchHidden(user, r.queueBranchId));
  const deletedRecords = deletedRecordsRaw.filter((r) => !isBranchHidden(user, r.branchId));
  const branchName = (branchId: string | null) => allBranches.find((b) => b.id === branchId)?.name ?? "—";

  const tabLink = (t: string) => `/admin/trash?tab=${t}`;
  const tabClass = (active: boolean) =>
    `rounded-md px-4 py-2 text-sm font-medium transition-colors ${active ? "bg-blue-200 text-blue-300" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Trash</h1>
        <p className="mt-1 text-sm text-slate-400">
          Deleted home service requests and POS repair records land here first — restore one back to normal, or delete it permanently
          (which can&apos;t be undone).
        </p>
      </div>

      {canRequests && canPos && (
        <div className="flex gap-1 border-b border-slate-200">
          <Link href={tabLink("requests")} className={tabClass(tab === "requests")}>
            Home Service ({deletedRequests.length})
          </Link>
          <Link href={tabLink("pos")} className={tabClass(tab === "pos")}>
            POS ({deletedRecords.length})
          </Link>
        </div>
      )}

      {tab === "requests" && canRequests && (
        <section className="space-y-3">
          <div className="space-y-3 sm:hidden">
            {deletedRequests.length === 0 && <p className="card text-center text-sm text-slate-400">Trash is empty.</p>}
            {deletedRequests.map((r) => (
              <div key={r.id} className="card space-y-2">
                <div>
                  <p className="font-mono text-xs text-blue-300">{r.reference}</p>
                  <p className="mt-0.5 text-sm font-medium text-slate-800">{r.customerName}</p>
                </div>
                <div className="grid grid-cols-2 gap-y-1 text-xs">
                  <span className="text-slate-400">Phone</span>
                  <span className="text-right text-slate-600">{r.phone || "—"}</span>
                  <span className="text-slate-400">Deleted</span>
                  <span className="text-right text-slate-600">{r.deletedAt ? formatDateTime(r.deletedAt) : "—"}</span>
                </div>
                <div className="flex gap-1.5 pt-1">
                  <RestoreButton id={r.id} action={restoreHomeServiceRequest} className="btn-secondary flex-1 !py-1.5 text-xs" />
                  <DeleteButton
                    id={r.id}
                    action={permanentlyDeleteHomeServiceRequest}
                    confirmMessage={`Permanently delete home service request ${r.reference}? This can't be undone.`}
                    label="Delete Permanently"
                    className="btn-secondary flex-1 !py-1.5 text-xs !text-red-600"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="hidden card overflow-x-auto sm:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                  <th className="pb-2 pr-3">Reference</th>
                  <th className="pb-2 pr-3">Customer</th>
                  <th className="pb-2 pr-3">Phone</th>
                  <th className="pb-2 pr-3">Deleted</th>
                  <th className="pb-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {deletedRequests.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-400">
                      Trash is empty.
                    </td>
                  </tr>
                )}
                {deletedRequests.map((r) => (
                  <tr key={r.id} className="border-b border-slate-200 last:border-0">
                    <td className="py-3 pr-3 font-mono text-xs text-blue-300">{r.reference}</td>
                    <td className="py-3 pr-3 text-slate-800">{r.customerName}</td>
                    <td className="py-3 pr-3 text-slate-500">{r.phone || "—"}</td>
                    <td className="py-3 pr-3 text-slate-500">{r.deletedAt ? formatDateTime(r.deletedAt) : "—"}</td>
                    <td className="py-3">
                      <div className="flex gap-1.5">
                        <RestoreButton id={r.id} action={restoreHomeServiceRequest} />
                        <DeleteButton
                          id={r.id}
                          action={permanentlyDeleteHomeServiceRequest}
                          confirmMessage={`Permanently delete home service request ${r.reference}? This can't be undone.`}
                          label="Delete Permanently"
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "pos" && canPos && (
        <section className="space-y-3">
          <div className="space-y-3 sm:hidden">
            {deletedRecords.length === 0 && <p className="card text-center text-sm text-slate-400">Trash is empty.</p>}
            {deletedRecords.map((r) => (
              <div key={r.id} className="card space-y-2">
                <div>
                  <p className="font-mono text-xs text-blue-300">{r.reference}</p>
                  <p className="mt-0.5 text-sm font-medium text-slate-800">{r.customerName}</p>
                </div>
                <div className="grid grid-cols-2 gap-y-1 text-xs">
                  <span className="text-slate-400">Branch</span>
                  <span className="text-right text-slate-600">{branchName(r.branchId)}</span>
                  <span className="text-slate-400">Device</span>
                  <span className="text-right text-slate-600">{r.deviceModel || "—"}</span>
                  <span className="text-slate-400">Cost</span>
                  <span className="text-right font-semibold text-slate-800">{peso(r.cost)}</span>
                  <span className="text-slate-400">Deleted</span>
                  <span className="text-right text-slate-600">{r.deletedAt ? formatDateTime(r.deletedAt) : "—"}</span>
                </div>
                <div className="flex gap-1.5 pt-1">
                  <RestoreButton id={r.id} action={restoreRepairRecord} className="btn-secondary flex-1 !py-1.5 text-xs" />
                  <DeleteButton
                    id={r.id}
                    action={permanentlyDeleteRepairRecord}
                    confirmMessage={`Permanently delete repair record ${r.reference}? This can't be undone.`}
                    label="Delete Permanently"
                    className="btn-secondary flex-1 !py-1.5 text-xs !text-red-600"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="hidden card overflow-x-auto sm:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                  <th className="pb-2 pr-3">Reference</th>
                  <th className="pb-2 pr-3">Branch</th>
                  <th className="pb-2 pr-3">Customer</th>
                  <th className="pb-2 pr-3">Device</th>
                  <th className="pb-2 pr-3">Cost</th>
                  <th className="pb-2 pr-3">Deleted</th>
                  <th className="pb-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {deletedRecords.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-slate-400">
                      Trash is empty.
                    </td>
                  </tr>
                )}
                {deletedRecords.map((r) => (
                  <tr key={r.id} className="border-b border-slate-200 last:border-0">
                    <td className="py-3 pr-3 font-mono text-xs text-blue-300">{r.reference}</td>
                    <td className="py-3 pr-3 text-slate-500">{branchName(r.branchId)}</td>
                    <td className="py-3 pr-3 text-slate-800">{r.customerName}</td>
                    <td className="py-3 pr-3 text-slate-500">{r.deviceModel || "—"}</td>
                    <td className="py-3 pr-3 font-semibold text-slate-800">{peso(r.cost)}</td>
                    <td className="py-3 pr-3 text-slate-500">{r.deletedAt ? formatDateTime(r.deletedAt) : "—"}</td>
                    <td className="py-3">
                      <div className="flex gap-1.5">
                        <RestoreButton id={r.id} action={restoreRepairRecord} />
                        <DeleteButton
                          id={r.id}
                          action={permanentlyDeleteRepairRecord}
                          confirmMessage={`Permanently delete repair record ${r.reference}? This can't be undone.`}
                          label="Delete Permanently"
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
