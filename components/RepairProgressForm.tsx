import { saveRepairProgress } from "@/lib/actions";
import { formatDateTime } from "@/lib/format";
import type { RepairProgress } from "@/lib/types";

export default function RepairProgressForm({ requestId, progress }: { requestId: string; progress: RepairProgress | null }) {
  return (
    <div className="card space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-slate-800">Repair Progress Notes</h3>
        <p className="text-xs text-slate-400">
          Document inspection results, what&apos;s been done so far, and parts replaced. Save again anytime to update as work continues.
        </p>
        {progress && (
          <p className="mt-1 text-[11px] text-slate-400">
            Last updated by {progress.updatedBy || "—"} on {formatDateTime(progress.updatedAt)}
          </p>
        )}
      </div>
      <form action={saveRepairProgress} className="space-y-3">
        <input type="hidden" name="requestId" value={requestId} />
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500">Inspection Results</label>
          <textarea
            name="inspectionResults"
            rows={2}
            defaultValue={progress?.inspectionResults ?? ""}
            className="input"
            placeholder="What did you find when you opened up / examined the device?"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500">Repair Progress</label>
          <textarea
            name="progressNotes"
            rows={2}
            defaultValue={progress?.progressNotes ?? ""}
            className="input"
            placeholder="What's been done so far..."
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500">Parts Replaced</label>
          <input
            name="partsReplaced"
            defaultValue={progress?.partsReplaced ?? ""}
            className="input"
            placeholder="e.g. Screen assembly, battery"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500">Other Important Details</label>
          <textarea
            name="otherDetails"
            rows={2}
            defaultValue={progress?.otherDetails ?? ""}
            className="input"
            placeholder="Anything else worth noting..."
          />
        </div>
        <button type="submit" className="btn-secondary w-full">
          Save Progress Notes
        </button>
      </form>
    </div>
  );
}
