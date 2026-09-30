import { formatDateTime } from "@/lib/format";
import { publishUnboxingVideo, deleteUnboxingVideo } from "@/lib/actions";
import DeleteButton from "./DeleteButton";

// The current unboxing video with its draft/sent state and the actions on
// it — shared by the technician unboxing page and the admin job page so
// both read the same. Retaking is the recorder rendered underneath.
export default function UnboxingVideoReview({
  requestId,
  reference,
  videoUrl,
  recordedBy,
  recordedAt,
  publishedAt,
  canDelete,
}: {
  requestId: string;
  reference: string;
  videoUrl: string;
  recordedBy: string | null;
  recordedAt: string | null;
  publishedAt: string | null;
  canDelete: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-slate-700">Current video</p>
        {publishedAt ? (
          <span className="badge border border-green-200 bg-green-50 text-green-700">Sent to customer — {formatDateTime(publishedAt)}</span>
        ) : (
          <span className="badge border border-amber-200 bg-amber-50 text-amber-700">Draft — not yet visible to the customer</span>
        )}
      </div>
      <video controls playsInline preload="metadata" src={videoUrl} className="w-full rounded-lg border border-slate-200 bg-black" />
      <p className="text-[11px] text-slate-400">
        Recorded by {recordedBy ?? "—"}
        {recordedAt ? ` — ${formatDateTime(recordedAt)}` : ""}.
      </p>
      <div className="flex flex-wrap gap-2">
        {!publishedAt && (
          <form action={publishUnboxingVideo}>
            <input type="hidden" name="id" value={requestId} />
            <button type="submit" className="btn-primary">
              📤 Send to Customer
            </button>
          </form>
        )}
        {canDelete && (
          <DeleteButton
            id={requestId}
            action={deleteUnboxingVideo}
            confirmMessage={
              publishedAt
                ? `Delete the unboxing video for ${reference}? The customer will no longer be able to watch it.`
                : `Delete this draft video for ${reference}? You can record a new one afterwards.`
            }
            label="Delete video"
            className="btn-secondary !text-red-600"
          />
        )}
      </div>
      {!publishedAt && (
        <p className="text-[11px] text-slate-400">
          Watch it back first. Not happy with it? Delete it or record a replacement below — the customer only sees it after Send to Customer.
        </p>
      )}
    </div>
  );
}
