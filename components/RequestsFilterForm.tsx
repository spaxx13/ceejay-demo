"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";

type StatusOption = { id: string; label: string };
type TechnicianOption = { id: string; name: string };
type Filters = { status?: string; technician?: string; date?: string; unassigned?: string; province?: string; downpayment?: string };

const DOWNPAYMENT_OPTIONS: { value: string; label: string }[] = [
  { value: "paid", label: "Paid" },
  { value: "pending", label: "Pending" },
  { value: "not_required", label: "Not Required" },
];

// Client component so each dropdown/date can auto-apply on change via
// router.push — a soft (RSC) navigation, not a full page reload — instead
// of requiring a separate "Filter" button tap. Keeps the exact same
// query-string shape the rest of the page (qs()) already reads from
// searchParams, so every other filter/link on the page keeps working.
export default function RequestsFilterForm({
  statuses,
  technicians,
  provinces,
  current,
}: {
  statuses: StatusOption[];
  technicians: TechnicianOption[];
  provinces: string[];
  current: Filters;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function apply(next: Partial<Filters>) {
    const merged: Filters = { ...current, ...next };
    const usp = new URLSearchParams();
    Object.entries(merged).forEach(([k, v]) => {
      if (v) usp.set(k, v);
    });
    const qs = usp.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  return (
    <form className={`card flex flex-wrap gap-3 transition-opacity ${isPending ? "opacity-60" : ""}`}>
      <select
        name="status"
        defaultValue={current.status ?? ""}
        onChange={(e) => apply({ status: e.target.value || undefined })}
        className="input w-full sm:w-44"
      >
        <option value="">All statuses</option>
        {statuses.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
      <select
        name="technician"
        defaultValue={current.technician ?? ""}
        onChange={(e) => apply({ technician: e.target.value || undefined })}
        className="input w-full sm:w-44"
      >
        <option value="">All technicians</option>
        {technicians.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <input
        type="date"
        name="date"
        defaultValue={current.date ?? ""}
        onChange={(e) => apply({ date: e.target.value || undefined })}
        className="input w-full sm:w-44"
      />
      <select
        name="province"
        defaultValue={current.province ?? ""}
        onChange={(e) => apply({ province: e.target.value || undefined })}
        className="input w-full sm:w-44"
      >
        <option value="">All provinces</option>
        {provinces.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
      <select
        name="downpayment"
        defaultValue={current.downpayment ?? ""}
        onChange={(e) => apply({ downpayment: e.target.value || undefined })}
        className="input w-full sm:w-44"
      >
        <option value="">All Down Payments</option>
        {DOWNPAYMENT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <Link href={pathname} className="btn-secondary flex-1 text-center sm:flex-none">
        Clear
      </Link>
    </form>
  );
}
