import Link from "next/link";
import { redirect } from "next/navigation";
import { getBranches, getCourierRequests, canManageCourier, isBranchHidden } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import StatusBadge from "@/components/StatusBadge";
import { COURIER_STATUS_LABELS, COURIER_STATUS_ORDER, courierStatusLabel } from "@/lib/courierService";
import type { CourierStatus } from "@/lib/types";
import { formatDateTime } from "@/lib/format";
import DeleteButton from "@/components/DeleteButton";
import { deleteCourierRequest } from "@/lib/actions";

export default async function CourierRequestsPage({ searchParams }: { searchParams: Promise<{ status?: string; branch?: string }> }) {
  const user = await getCurrentUser();
  if (!canManageCourier(user)) redirect("/admin");

  const sp = await searchParams;
  const [branches, all] = await Promise.all([getBranches(), getCourierRequests()]);
  // A branch admin only sees shipments headed to their own branch(es).
  const visible = all.filter((r) => !isBranchHidden(user, r.branchId));
  let requests = visible;
  if (sp.status) requests = requests.filter((r) => r.status === sp.status);
  if (sp.branch) requests = requests.filter((r) => r.branchId === sp.branch);
  const isOwner = user?.role === "owner_admin";
  const statuses: CourierStatus[] = [...COURIER_STATUS_ORDER, "cancelled"];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Courier Service</h1>
        <p className="mt-1 text-sm text-slate-400">
          Mail-in repairs from customers anywhere in the Philippines — they ship the device to a branch, we repair it and ship it back. Requests marked Lalamove / Grab are Pickup &amp; Delivery option 2: the customer books and pays their own driver both ways.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        {statuses.map((s) => (
          <Link
            key={s}
            href={sp.status === s ? "/admin/courier" : `/admin/courier?status=${s}`}
            className={sp.status === s ? "btn-primary !px-3 !py-1" : "btn-secondary !px-3 !py-1"}
          >
            {COURIER_STATUS_LABELS[s]} ({visible.filter((r) => r.status === s).length})
          </Link>
        ))}
      </div>

      <form className="card flex flex-wrap gap-3">
        <input type="hidden" name="status" value={sp.status ?? ""} />
        <select name="branch" defaultValue={sp.branch ?? ""} className="input w-full sm:w-52">
          <option value="">All branches</option>
          {branches
            .filter((b) => b.active && b.address.trim())
            .map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
        </select>
        <button type="submit" className="btn-secondary">
          Filter
        </button>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-slate-400">
            <tr>
              <th className="py-2 pr-3">Reference</th>
              <th className="py-2 pr-3">Customer</th>
              <th className="py-2 pr-3">Return To</th>
              <th className="py-2 pr-3">Ships To</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Booked</th>
              {isOwner && <th className="py-2 pr-3" />}
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 && (
              <tr>
                <td colSpan={isOwner ? 7 : 6} className="py-6 text-center text-slate-400">
                  No courier requests yet.
                </td>
              </tr>
            )}
            {requests.map((r) => (
              <tr key={r.id} className="border-t border-slate-200">
                <td className="py-2 pr-3 font-mono">
                  <Link href={`/admin/courier/${r.id}`} className="text-blue-500 hover:underline">
                    {r.reference}
                  </Link>
                  {r.deliveryMode === "self_book" && <span className="block font-sans text-[11px] text-blue-600">Lalamove / Grab (self-book)</span>}
                </td>
                <td className="py-2 pr-3">
                  {r.name}
                  <span className="block text-xs text-slate-400">{r.phone}</span>
                </td>
                <td className="py-2 pr-3">{[r.city, r.province].filter(Boolean).join(", ")}</td>
                <td className="py-2 pr-3">{branches.find((b) => b.id === r.branchId)?.name ?? "—"}</td>
                <td className="py-2 pr-3">
                  <StatusBadge label={courierStatusLabel(r.deliveryMode, r.status)} />
                </td>
                <td className="py-2 pr-3 text-xs text-slate-400">{formatDateTime(r.createdAt)}</td>
                {isOwner && (
                  <td className="py-2 pr-3">
                    <DeleteButton
                      id={r.id}
                      action={deleteCourierRequest}
                      confirmMessage={`Move courier request ${r.reference} to Trash? You can restore it later from Trash.`}
                      label="Move to Trash"
                    />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
