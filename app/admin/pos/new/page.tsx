import Link from "next/link";
import { getBranches, getInventory, getSales, getRequests, getTechnicians } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import SaleBuilder from "@/components/SaleBuilder";

export default async function NewSalePage() {
  const [user, allBranches, inventory, sales, allRequests, technicians] = await Promise.all([
    getCurrentUser(),
    getBranches(),
    getInventory(),
    getSales(),
    getRequests(),
    getTechnicians(),
  ]);
  const branches = allBranches.filter((b) => b.active).map((b) => ({ id: b.id, label: b.name }));
  const inventoryItems = inventory
    .filter((i) => i.active)
    .map((i) => ({ id: i.id, branchId: i.branchId, name: i.name, unitPrice: i.unitPrice, quantityOnHand: i.quantityOnHand }));

  const linkedRequestIds = new Set(sales.map((s) => s.homeServiceRequestId).filter(Boolean));
  const openRequests = [...allRequests]
    .filter((r) => !linkedRequestIds.has(r.id))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 30)
    .map((r) => ({ id: r.id, reference: r.reference, customerName: r.customerName }));

  const defaultBranchId = user?.technicianId
    ? technicians.find((t) => t.id === user.technicianId)?.branchIds[0] ?? branches[0]?.id ?? ""
    : branches[0]?.id ?? "";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/pos" className="text-xs text-slate-400 hover:text-slate-600">
            ← Back to sales
          </Link>
          <h1 className="mt-1 text-xl font-bold text-slate-900">New Sale</h1>
        </div>
      </div>
      <SaleBuilder branches={branches} inventoryItems={inventoryItems} openRequests={openRequests} defaultBranchId={defaultBranchId} />
    </div>
  );
}
