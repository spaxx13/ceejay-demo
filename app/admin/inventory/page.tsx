import { getLookups, getBranches, getInventory, getStockMovements } from "@/lib/db";
import SimpleLookupTable from "@/components/SimpleLookupTable";
import InventoryItemManager from "@/components/InventoryItemManager";
import { createLookup, toggleLookupActive, updateLookupLabel } from "@/lib/actions";

export default async function InventoryPage() {
  const [lookups, allBranches, items, stockMovements] = await Promise.all([
    getLookups(),
    getBranches(),
    getInventory(),
    getStockMovements(),
  ]);
  const categories = lookups.filter((l) => l.kind === "inventory_category").sort((a, b) => a.order - b.order);
  const branches = allBranches.filter((b) => b.active).map((b) => ({ id: b.id, label: b.name }));
  const lowStock = items.filter((i) => i.active && i.quantityOnHand <= i.reorderLevel);
  const recentMovements = [...stockMovements].sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 8);

  function itemName(id: string) {
    return items.find((i) => i.id === id)?.name ?? "—";
  }
  function branchName(id: string) {
    return allBranches.find((b) => b.id === id)?.name ?? "—";
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Inventory</h1>
        <p className="mt-1 text-sm text-slate-400">Parts stock levels per branch, restocks, and usage tracking.</p>
      </div>

      {lowStock.length > 0 && (
        <div className="card border-amber-200 bg-amber-50/50">
          <p className="text-sm font-semibold text-amber-700">⚠ {lowStock.length} item(s) at or below reorder level</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {lowStock.map((i) => (
              <li key={i.id} className="badge border border-amber-200 bg-amber-50 text-amber-700">
                {i.name} ({i.quantityOnHand} left, {branchName(i.branchId)})
              </li>
            ))}
          </ul>
        </div>
      )}

      <SimpleLookupTable
        title="Categories"
        items={categories}
        createAction={createLookup}
        hiddenFields={{ kind: "inventory_category" }}
        toggleAction={toggleLookupActive}
        updateAction={updateLookupLabel}
        placeholder="Add category..."
      />

      <InventoryItemManager
        items={items}
        branches={branches}
        categories={categories.filter((c) => c.active).map((c) => ({ id: c.id, label: c.label }))}
      />

      <div className="card space-y-3">
        <h3 className="text-sm font-semibold text-slate-800">Recent Stock Movements</h3>
        <ul className="space-y-2 text-sm">
          {recentMovements.length === 0 && <li className="text-slate-400">No stock movements yet.</li>}
          {recentMovements.map((m) => (
            <li key={m.id} className="flex items-center justify-between border-b border-slate-200 pb-2 last:border-0">
              <div>
                <p className="text-slate-700">
                  {itemName(m.itemId)} · <span className={m.quantity < 0 ? "text-red-600" : "text-green-700"}>{m.quantity > 0 ? "+" : ""}{m.quantity}</span> ({m.type})
                </p>
                <p className="text-[11px] text-slate-400">
                  {m.reason} — {branchName(m.branchId)} · {m.actor} · {new Date(m.at).toLocaleString()}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
