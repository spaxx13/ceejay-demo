"use client";

import { useActionState } from "react";
import { riderBringDevicesToBranchAction } from "@/lib/actions";

type Job = { id: string; reference: string; customerName: string; headingToShop: boolean };
export type BatchGroup = { key: string; branchName: string; jobs: Job[] };

// Shown when a rider is carrying 2+ picked-up devices that haven't reached the
// shop yet: one tap moves every device headed to the same branch to the next
// step, instead of repeating it on each job card. Per-job cards still work as
// before (e.g. to redirect a single device to a different branch).
function GroupForm({ group }: { group: BatchGroup }) {
  const [state, formAction, pending] = useActionState(riderBringDevicesToBranchAction, undefined);
  const allHeading = group.jobs.every((j) => j.headingToShop);
  const n = group.jobs.length;
  return (
    <form action={formAction} className="space-y-2 rounded-lg border border-blue-200 bg-white p-3">
      <input type="hidden" name="step" value={allHeading ? "delivered_to_branch" : "heading_to_shop"} />
      {group.jobs.map((j) => (
        <input key={j.id} type="hidden" name="requestId" value={j.id} />
      ))}
      <p className="text-sm font-semibold text-slate-900">
        {n} device{n === 1 ? "" : "s"} → {group.branchName}
      </p>
      <ul className="space-y-0.5 text-xs text-slate-500">
        {group.jobs.map((j) => (
          <li key={j.id}>
            <span className="font-mono text-slate-400">{j.reference}</span> — {j.customerName}
          </li>
        ))}
      </ul>
      <button type="submit" disabled={pending} className="btn-primary w-full text-sm">
        {pending ? "..." : allHeading ? `✅ Delivered all ${n} to ${group.branchName}` : `🛵 On the way to ${group.branchName} with all ${n}`}
      </button>
      {state && !state.ok && <p className="text-xs text-red-600">{state.error}</p>}
    </form>
  );
}

export default function RiderBatchBranchBar({ groups }: { groups: BatchGroup[] }) {
  const total = groups.reduce((sum, g) => sum + g.jobs.length, 0);
  if (total < 2) return null;
  return (
    <section className="space-y-2 rounded-xl border-2 border-blue-300 bg-blue-50 p-3">
      <div>
        <h2 className="text-sm font-semibold text-blue-900">You&apos;re carrying {total} devices</h2>
        <p className="text-xs text-blue-800">
          Pick up your other jobs first if you still have any. When you head to the branch, you can update all devices going to the same
          branch at once.
        </p>
      </div>
      {groups.map((g) => (
        <GroupForm key={g.key} group={g} />
      ))}
    </section>
  );
}
