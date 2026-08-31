"use client";

import { useRef, useState } from "react";
import { createCustomField, updateCustomField, toggleCustomFieldActive, reorderCustomField } from "@/lib/actions";
import type { CustomFieldType, SystemFieldKey } from "@/lib/types";

type Field = {
  id: string;
  key: string;
  systemKey: SystemFieldKey | null;
  label: string;
  placeholder: string;
  type: CustomFieldType;
  required: boolean;
  options: string[];
  order: number;
  active: boolean;
};

const TYPE_LABELS: Record<CustomFieldType, string> = {
  text: "Text",
  textarea: "Long Text",
  select: "Dropdown",
  checkbox: "Checkbox",
  date: "Date",
  datetime: "Date & Time",
};

// These built-ins keep a catalog-backed picker (options come from Device
// Catalog / Service Types, not a typed list) whenever their type is
// "select" — their natural default. Switching them to any other type
// falls back to a plain field instead, still capturing a real value.
const CATALOG_KEYS = new Set<SystemFieldKey>(["device_brand", "device_model", "service_type"]);
// Photo always renders the upload widget — a photo can't become text.
const INERT_KEYS = new Set<SystemFieldKey>(["photo"]);

export default function FieldManager({ fields }: { fields: Field[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [type, setType] = useState<CustomFieldType>("text");
  const editing = fields.find((f) => f.id === editingId);
  const sorted = [...fields].sort((a, b) => a.order - b.order);

  function startEdit(f: Field) {
    setEditingId(f.id);
    setType(f.type);
  }
  function reset() {
    setEditingId(null);
    setType("text");
    formRef.current?.reset();
  }

  const editingSystemKey = editing?.systemKey ?? null;
  const isInert = editingSystemKey ? INERT_KEYS.has(editingSystemKey) : false;
  const isCatalog = editingSystemKey ? CATALOG_KEYS.has(editingSystemKey) : false;
  const showOptions = type === "select" && !isCatalog && !isInert;

  return (
    <div className="space-y-6">
      <div className="card space-y-4">
        <h3 className="text-sm font-semibold text-slate-800">
          {editingId ? (editingSystemKey ? `Edit "${editing?.label}"` : "Edit Custom Field") : "Add Custom Field"}
        </h3>
        {isInert && (
          <p className="text-xs text-slate-400">
            This field always renders as a photo upload regardless of the Type below — a photo can&apos;t become text, a dropdown, etc.
          </p>
        )}
        {isCatalog && !isInert && (
          <p className="text-xs text-slate-400">
            At type <span className="font-medium text-slate-600">Dropdown</span>, this pulls its options from{" "}
            {editingSystemKey === "service_type" ? "Service Types" : "Device Catalog"} — not the list below. Switch it to any other type to
            capture a free-text value instead.
          </p>
        )}
        <form
          ref={formRef}
          action={(fd) => {
            if (editingId) {
              fd.set("id", editingId);
              updateCustomField(fd);
            } else {
              createCustomField(fd);
            }
            reset();
          }}
          className="space-y-3"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Field Label *</label>
              <input name="label" required defaultValue={editing?.label ?? ""} className="input" placeholder="e.g. Preferred Contact Time" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Type</label>
              <select name="type" value={type} onChange={(e) => setType(e.target.value as CustomFieldType)} className="input">
                {Object.entries(TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Placeholder</label>
              <input name="placeholder" defaultValue={editing?.placeholder ?? ""} className="input" />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" name="required" defaultChecked={editing?.required ?? false} className="h-4 w-4 rounded border-slate-300" />
                Required
              </label>
            </div>
          </div>
          {showOptions && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Dropdown Options (comma-separated)</label>
              <input name="options" defaultValue={editing?.options.join(", ") ?? ""} className="input" placeholder="Morning, Afternoon, Evening" />
            </div>
          )}
          <div className="flex gap-2">
            <button type="submit" className="btn-primary">
              {editingId ? "Save Changes" : "Add Field"}
            </button>
            {editingId && (
              <button type="button" className="btn-secondary" onClick={reset}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
              <th className="pb-2 pr-3">Field</th>
              <th className="pb-2 pr-3">Type</th>
              <th className="pb-2 pr-3">Required</th>
              <th className="pb-2 pr-3">Status</th>
              <th className="pb-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-slate-400">
                  No fields at all — the public form will show a placeholder message until at least one is active.
                </td>
              </tr>
            )}
            {sorted.map((f, i) => (
              <tr key={f.id} className="border-b border-slate-200 last:border-0">
                <td className="py-3 pr-3">
                  <div className="flex items-center gap-1.5">
                    <p className="font-medium text-slate-800">{f.label}</p>
                    {f.systemKey && <span className="badge border border-slate-200 bg-slate-50 text-slate-400">Built-in</span>}
                  </div>
                  {f.type === "select" && !CATALOG_KEYS.has(f.systemKey as SystemFieldKey) && (
                    <p className="text-[11px] text-slate-400">{f.options.join(" · ") || "no options set"}</p>
                  )}
                </td>
                <td className="py-3 pr-3 text-slate-500">{TYPE_LABELS[f.type]}</td>
                <td className="py-3 pr-3 text-slate-500">{f.required ? "Yes" : "No"}</td>
                <td className="py-3 pr-3">
                  <form action={toggleCustomFieldActive}>
                    <input type="hidden" name="id" value={f.id} />
                    <button
                      type="submit"
                      className={`badge border ${f.active ? "border-green-200 bg-green-50 text-green-700" : "border-slate-300 bg-slate-100 text-slate-500"}`}
                    >
                      {f.active ? "Active" : "Inactive"}
                    </button>
                  </form>
                </td>
                <td className="py-3">
                  <div className="flex items-center gap-2">
                    <form action={reorderCustomField}>
                      <input type="hidden" name="id" value={f.id} />
                      <input type="hidden" name="direction" value="up" />
                      <button type="submit" disabled={i === 0} className="btn-secondary !px-2 !py-1 text-xs disabled:opacity-30">
                        ↑
                      </button>
                    </form>
                    <form action={reorderCustomField}>
                      <input type="hidden" name="id" value={f.id} />
                      <input type="hidden" name="direction" value="down" />
                      <button type="submit" disabled={i === sorted.length - 1} className="btn-secondary !px-2 !py-1 text-xs disabled:opacity-30">
                        ↓
                      </button>
                    </form>
                    <button className="btn-secondary !px-3 !py-1 text-xs" onClick={() => startEdit(f)}>
                      Edit
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
