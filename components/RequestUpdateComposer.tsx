"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createRequestUpdateUploadUrl, postRequestUpdate } from "@/lib/actions";
import { compressImage } from "@/lib/imageCompress";
import VideoCaptureInput, { MAX_VIDEO_BYTES, fmtSeconds } from "./VideoCaptureInput";
import type { RequestUpdateMedia } from "@/lib/types";

// "Post an update for the customer": a description plus any number of
// photos (compressed client-side like every other photo upload) and/or
// videos (VideoCaptureInput). Each file uploads browser → Supabase Storage
// through its own signed URL, then postRequestUpdate records the update
// and notifies the customer. Everything is previewed and removable before
// Post — the form itself is the review step.
type Item = { id: string; kind: "photo" | "video"; blob: Blob; previewUrl: string; seconds: number };

const MAX_ITEMS = 8;

export default function RequestUpdateComposer({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [showVideo, setShowVideo] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [posted, setPosted] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  // Mirrors `items` so the unmount cleanup below can revoke whatever
  // preview URLs are still alive without re-running on every change.
  const itemsRef = useRef<Item[]>([]);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  useEffect(() => {
    return () => itemsRef.current.forEach((i) => URL.revokeObjectURL(i.previewUrl));
  }, []);

  function addItem(kind: Item["kind"], blob: Blob, seconds = 0) {
    setItems((prev) => {
      if (prev.length >= MAX_ITEMS) return prev;
      return [...prev, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, kind, blob, previewUrl: URL.createObjectURL(blob), seconds }];
    });
    setPosted(false);
  }

  function removeItem(id: string) {
    setItems((prev) => {
      const gone = prev.find((i) => i.id === id);
      if (gone) URL.revokeObjectURL(gone.previewUrl);
      return prev.filter((i) => i.id !== id);
    });
  }

  async function addPhotos(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError("");
    setBusy("Processing photos…");
    try {
      for (const file of Array.from(files).slice(0, MAX_ITEMS - items.length)) {
        if (!file.type.startsWith("image/")) continue;
        const dataUrl = await compressImage(file);
        const blob = await (await fetch(dataUrl)).blob();
        addItem("photo", blob);
      }
    } catch {
      setError("Couldn't process one of those photos — please try another.");
    } finally {
      setBusy("");
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  }

  function addVideo(blob: Blob, seconds: number) {
    if (blob.size > MAX_VIDEO_BYTES) {
      setError(`That video is ${(blob.size / 1024 / 1024).toFixed(0)}MB — the limit is ${MAX_VIDEO_BYTES / 1024 / 1024}MB. Please record a shorter clip.`);
      return;
    }
    setError("");
    addItem("video", blob, seconds);
    setShowVideo(false);
  }

  async function uploadOne(item: Item, index: number): Promise<RequestUpdateMedia> {
    const contentType = item.blob.type.split(";")[0] || (item.kind === "photo" ? "image/jpeg" : "video/webm");
    const target = await createRequestUpdateUploadUrl(requestId, contentType);
    if (!target.ok) throw new Error(target.error);
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", target.uploadUrl);
      xhr.setRequestHeader("Content-Type", contentType);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setBusy(`Uploading ${index + 1} of ${items.length}… ${Math.round((e.loaded / e.total) * 100)}%`);
      };
      xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
      xhr.onerror = () => reject(new Error("Upload failed — check the connection and try again."));
      xhr.send(item.blob);
    });
    return { kind: item.kind, path: target.path, contentType };
  }

  async function post() {
    setError("");
    if (!body.trim() && items.length === 0) {
      setError("Add a description, a photo, or a video first.");
      return;
    }
    try {
      const media: RequestUpdateMedia[] = [];
      for (let i = 0; i < items.length; i++) media.push(await uploadOne(items[i], i));
      setBusy("Posting…");
      const res = await postRequestUpdate(requestId, body, media);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      items.forEach((i) => URL.revokeObjectURL(i.previewUrl));
      setItems([]);
      setBody("");
      setShowVideo(false);
      setPosted(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong — please try again.");
    } finally {
      setBusy("");
    }
  }

  const disabled = !!busy;

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 p-3">
      <div>
        <p className="text-xs font-semibold text-slate-700">Post an update for the customer</p>
        <p className="text-[11px] text-slate-400">
          What&apos;s happening with the repair — with photos or a short video. The customer sees it on their tracking page and gets a
          notification as soon as you post.
        </p>
      </div>

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        disabled={disabled}
        className="input"
        placeholder="e.g. Opened the device — battery is swollen and the screen connector is damaged. Replacing both now, ETA tomorrow."
      />

      {items.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {items.map((item) => (
            <div key={item.id} className="relative">
              {item.kind === "photo" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.previewUrl} alt="Attached" className="aspect-square w-full rounded-lg border border-slate-200 object-cover" />
              ) : (
                <div className="relative">
                  <video src={item.previewUrl} muted playsInline className="aspect-square w-full rounded-lg border border-slate-200 bg-black object-cover" />
                  <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1 text-[10px] text-white">
                    🎥 {item.seconds > 0 ? fmtSeconds(item.seconds) : "video"}
                  </span>
                </div>
              )}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  aria-label="Remove"
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-white text-xs text-slate-500 shadow-sm hover:text-red-600"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {!disabled && items.length < MAX_ITEMS && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <label className="btn-secondary cursor-pointer !px-3 text-xs">
              📷 Add Photos
              <input ref={photoInputRef} type="file" accept="image/*" multiple onChange={(e) => addPhotos(e.target.files)} className="sr-only" />
            </label>
            <button type="button" onClick={() => setShowVideo((v) => !v)} className="btn-secondary !px-3 text-xs">
              {showVideo ? "Cancel video" : "🎥 Add Video"}
            </button>
          </div>
          {showVideo && (
            <div className="rounded-lg border border-slate-200 p-2">
              <VideoCaptureInput onCapture={addVideo} startLabel="🎥 Start Recording" />
            </div>
          )}
        </div>
      )}

      {busy && <p className="text-xs text-blue-700">{busy}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {posted && !busy && (
        <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
          ✅ Update posted — the customer can see it now and has been notified.
        </p>
      )}

      <button type="button" onClick={post} disabled={disabled || (!body.trim() && items.length === 0)} className="btn-primary w-full">
        {busy ? "Working…" : "📤 Post Update to Customer"}
      </button>
    </div>
  );
}
