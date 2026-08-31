"use client";

import { useRef } from "react";

type Item = { id: string; label: string; active: boolean };

export default function SimpleLookupTable({
  title,
  items,
  createAction,
  toggleAction,
  updateAction,
  hiddenFields,
  placeholder = "Add new...",
}: {
  title: string;
  items: Item[];
  createAction: (formData: FormData) => void;
  toggleAction: (formData: FormData) => void;
  updateAction?: (formData: FormData) => void;
  hiddenFields?: Record<string, string>;
  placeholder?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="card space-y-4">
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      <form
        ref={formRef}
        action={(fd) => {
          createAction(fd);
          formRef.current?.reset();
        }}
        className="flex gap-2"
      >
        {hiddenFields &&
          Object.entries(hiddenFields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        <input name="label" required placeholder={placeholder} className="input flex-1" />
        <button className="btn-primary shrink-0" type="submit">
          Add
        </button>
      </form>
      <ul className="divide-y divide-slate-200">
        {items.length === 0 && <li className="py-3 text-sm text-slate-400">Nothing yet — add the first one above.</li>}
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-3 py-2.5">
            {updateAction ? (
              <form
                action={updateAction}
                className="flex flex-1 items-center gap-2"
                onBlur={(e) => {
                  const form = e.currentTarget;
                  if (form.requestSubmit) form.requestSubmit();
                }}
              >
                <input type="hidden" name="id" value={item.id} />
                <input
                  name="label"
                  defaultValue={item.label}
                  className={`input flex-1 !py-1 text-sm ${item.active ? "" : "opacity-50"}`}
                />
              </form>
            ) : (
              <span className={`text-sm ${item.active ? "text-slate-800" : "text-slate-400 line-through"}`}>{item.label}</span>
            )}
            <form action={toggleAction}>
              <input type="hidden" name="id" value={item.id} />
              <button
                type="submit"
                className={`badge border ${item.active ? "border-green-200 bg-green-50 text-green-700" : "border-slate-300 bg-slate-100 text-slate-500"}`}
              >
                {item.active ? "Active" : "Inactive"}
              </button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
