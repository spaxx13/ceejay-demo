import { formatDateTime } from "@/lib/format";
import { getSignedMediaUrl, UPDATES_BUCKET } from "@/lib/storage";
import { deleteRequestUpdate } from "@/lib/actions";
import DeleteButton from "./DeleteButton";
import type { RequestUpdate } from "@/lib/types";

// The repair-update timeline, newest first — shared by the technician
// updates page, the admin job page and the customer's /track page (which
// passes no deletable ids). Media URLs are signed here, per render.
export default async function RequestUpdatesList({
  updates,
  deletableIds = [],
  emptyText = "No updates posted yet.",
}: {
  updates: RequestUpdate[];
  deletableIds?: string[];
  emptyText?: string;
}) {
  if (updates.length === 0) return emptyText ? <p className="text-sm text-slate-400">{emptyText}</p> : null;

  const resolved = await Promise.all(
    updates.map(async (u) => ({
      update: u,
      media: await Promise.all(u.media.map(async (m) => ({ ...m, url: await getSignedMediaUrl(m.path, UPDATES_BUCKET) }))),
    }))
  );
  const deletable = new Set(deletableIds);

  return (
    <div className="space-y-3">
      {resolved.map(({ update, media }) => (
        <div key={update.id} className="space-y-2 rounded-lg border border-slate-200 p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="text-xs text-slate-400">
              <span className="font-medium text-slate-700">{update.postedBy || "Ceejay"}</span> · {formatDateTime(update.createdAt)}
            </p>
            {deletable.has(update.id) && (
              <DeleteButton
                id={update.id}
                action={deleteRequestUpdate}
                confirmMessage="Delete this update? The customer will no longer see it."
                label="Delete"
                className="text-xs text-red-600 hover:underline"
              />
            )}
          </div>
          {update.body && <p className="whitespace-pre-line text-sm text-slate-700">{update.body}</p>}
          {media.some((m) => m.kind === "photo" && m.url) && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {media
                .filter((m) => m.kind === "photo" && m.url)
                .map((m) => (
                  <a key={m.path} href={m.url!} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.url!} alt="Repair update photo" className="aspect-square w-full rounded-lg border border-slate-200 object-cover" />
                  </a>
                ))}
            </div>
          )}
          {media
            .filter((m) => m.kind === "video" && m.url)
            .map((m) => (
              <video key={m.path} controls playsInline preload="metadata" src={m.url!} className="w-full rounded-lg border border-slate-200 bg-black" />
            ))}
          {media.some((m) => !m.url) && <p className="text-[11px] text-amber-700">Some attachments couldn&apos;t be loaded right now.</p>}
        </div>
      ))}
    </div>
  );
}
