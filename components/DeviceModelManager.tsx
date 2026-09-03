"use client";

import { useRef, useState } from "react";
import { createDeviceModel, deleteDeviceModel } from "@/lib/actions";

type Brand = { id: string; label: string };
type Model = { id: string; brandId: string; name: string; active: boolean };

export default function DeviceModelManager({ brands, models }: { brands: Brand[]; models: Model[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [brandId, setBrandId] = useState(brands[0]?.id ?? "");

  return (
    <div className="card space-y-4">
      <h3 className="text-sm font-semibold text-slate-800">Device Models</h3>
      <form
        ref={formRef}
        action={(fd) => {
          createDeviceModel(fd);
          formRef.current?.reset();
        }}
        className="flex flex-wrap gap-2"
      >
        <select name="brandId" value={brandId} onChange={(e) => setBrandId(e.target.value)} className="input w-40">
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.label}
            </option>
          ))}
        </select>
        <input name="name" required placeholder="Model name, e.g. iPhone 16" className="input flex-1" />
        <button className="btn-primary shrink-0" type="submit">
          Add Model
        </button>
      </form>

      <div className="space-y-4">
        {brands.map((b) => {
          const brandModels = models.filter((m) => m.brandId === b.id);
          if (brandModels.length === 0) return null;
          return (
            <div key={b.id}>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">{b.label}</p>
              <ul className="divide-y divide-slate-200">
                {brandModels.map((m) => (
                  <li key={m.id} className="flex items-center justify-between py-2">
                    <span className="text-sm text-slate-800">{m.name}</span>
                    <form
                      action={(fd) => {
                        if (confirm(`Delete "${m.name}"? This can't be undone.`)) deleteDeviceModel(fd);
                      }}
                    >
                      <input type="hidden" name="id" value={m.id} />
                      <button type="submit" className="btn-secondary !px-3 !py-1 text-xs !text-red-600">
                        Delete
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
