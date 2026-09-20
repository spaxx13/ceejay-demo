import { redirect } from "next/navigation";
import { getLookups, getDeviceModels, getServicePrices } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { saveServicePrices, createDeviceModel } from "@/lib/actions";
import SettingsTabs from "@/components/SettingsTabs";

const COLUMNS = [
  { field: "battery", label: "Battery" },
  { field: "backhousing", label: "Backhousing" },
  { field: "back_camera", label: "Back Camera" },
  { field: "front_camera", label: "Front Camera" },
  { field: "camera_lens", label: "Camera Lens" },
  { field: "reglass", label: "Reglass (Walk-in only)" },
  { field: "charging_port", label: "Charging Port (Walk-in only)" },
  { field: "screen_hq", label: "Screen (High Quality)" },
  { field: "screen_orig", label: "Screen (Original)" },
] as const;

export default async function ServicePricesPage() {
  if (!(await requireRole("owner_admin"))) redirect("/admin");

  const [lookups, allModels, prices] = await Promise.all([getLookups(), getDeviceModels(), getServicePrices()]);
  const brands = lookups.filter((l) => l.kind === "device_brand" && l.active).sort((a, b) => a.order - b.order);
  const models = allModels.filter((m) => m.active);

  const priceFor = (deviceModelId: string, category: string, quality: string) =>
    prices.find((p) => p.deviceModelId === deviceModelId && p.category === category && p.quality === quality)?.price;

  const cellValue = (modelId: string, field: (typeof COLUMNS)[number]["field"]) => {
    if (field === "battery") return priceFor(modelId, "battery", "");
    if (field === "backhousing") return priceFor(modelId, "backhousing", "");
    if (field === "back_camera") return priceFor(modelId, "back_camera", "");
    if (field === "front_camera") return priceFor(modelId, "front_camera", "");
    if (field === "camera_lens") return priceFor(modelId, "camera_lens", "");
    if (field === "reglass") return priceFor(modelId, "reglass", "");
    if (field === "charging_port") return priceFor(modelId, "charging_port", "");
    if (field === "screen_hq") return priceFor(modelId, "screen", "high_quality");
    return priceFor(modelId, "screen", "original");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Repair Pricing</h1>
        <p className="mt-1 text-sm text-slate-400">
          Sets the repair cost used to compute the automatic quotation emailed to a customer after they submit a Home Service Request.
          Leave a cell blank if you don&apos;t have a price for it yet — the quotation will say the exact cost will be confirmed by the
          technician upon inspection instead of showing a number. &quot;Backhousing&quot; covers both Backhousing service type labels;
          &quot;Back Camera&quot; covers both Camera service type labels — one price applies to both.
        </p>
      </div>
      <SettingsTabs />

      <form action={createDeviceModel} className="card flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500">Brand</label>
          <select name="brandId" required defaultValue={brands[0]?.id ?? ""} className="input w-48">
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500">New Model Name</label>
          <input name="name" required placeholder="e.g. iPhone 18 Pro" className="input w-56" />
        </div>
        <button type="submit" className="btn-secondary">
          Add Model
        </button>
        <p className="w-full text-[11px] text-slate-400">
          Adds a new device model (also shows up on Device Catalog) so it appears below, ready for you to fill in its prices.
        </p>
      </form>

      <form action={saveServicePrices} className="card space-y-4">
        {brands.map((brand) => {
          const brandModels = models.filter((m) => m.brandId === brand.id);
          if (brandModels.length === 0) return null;
          return (
            <div key={brand.id} className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-800">{brand.label}</h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                      <th className="py-2 pr-3 font-medium">Model</th>
                      {COLUMNS.map((c) => (
                        <th key={c.field} className="py-2 pr-3 font-medium">
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {brandModels.map((m) => (
                      <tr key={m.id} className="border-b border-slate-100 last:border-0">
                        <td className="py-2 pr-3 text-slate-700">{m.name}</td>
                        {COLUMNS.map((c) => (
                          <td key={c.field} className="py-2 pr-3">
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              name={`price_${c.field}_${m.id}`}
                              defaultValue={cellValue(m.id, c.field) ?? ""}
                              placeholder="—"
                              className="input w-28 !py-1"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
        <button type="submit" className="btn-primary">
          Save Changes
        </button>
      </form>
    </div>
  );
}
