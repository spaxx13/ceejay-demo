"use client";

import { useRef } from "react";

type Item = { id: string; label: string; active: boolean };

export default function StatusTable({
  title,
  kind,
  items,
  createAction,
  toggleAction,
  reorderAction,
}: {
  title: string;
  kind: string;
  items: Item[];
  createAction: (formData: FormData) => void;
  toggleAction: (formData: FormData) => void;
  reorderAction: (formData: FormData) => void;
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
        <input type="hidden" name="kind" value={kind} />
        <input name="label" required placeholder="Add new status..." className="input flex-1" />
        <button className="btn-primary shrink-0" type="submit">
          Add
        </button>
      </form>
      <ol className="divide-y divide-slate-200">
        {items.length === 0 && <li className="py-3 text-sm text-slate-400">No statuses yet.</li>}
        {items.map((item, i) => (
          <li key={item.id} className="flex items-center justify-between gap-3 py-2.5">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-slate-400">{i + 1}.</span>
              <span className={`text-sm ${item.active ? "text-slate-800" : "text-slate-400 line-through"}`}>{item.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <form action={reorderAction}>
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="direction" value="up" />
                <button type="submit" disabled={i === 0} className="btn-secondary !px-2 !py-1 text-xs disabled:opacity-30">
                  ↑
                </button>
              </form>
              <form action={reorderAction}>
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="direction" value="down" />
                <button type="submit" disabled={i === items.length - 1} className="btn-secondary !px-2 !py-1 text-xs disabled:opacity-30">
                  ↓
                </button>
              </form>
              <form action={toggleAction}>
                <input type="hidden" name="id" value={item.id} />
                <button
                  type="submit"
                  className={`badge border ${item.active ? "border-green-200 bg-green-50 text-green-700" : "border-slate-300 bg-slate-100 text-slate-500"}`}
                >
                  {item.active ? "Active" : "Inactive"}
                </button>
              </form>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
