"use client";

import { useRef, useState } from "react";
import { compressImage } from "@/lib/imageCompress";
import { captureNativePhoto } from "@/lib/nativePhotoCapture";
import { useIsNativePlatform } from "@/lib/useLiveLocationSharing";

const MAX_PHOTOS = 4;

export default function BroadcastPhotoUpload({ name = "photos" }: { name?: string }) {
  const isNative = useIsNativePlatform();
  const inputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleFiles(files: FileList | File[] | null) {
    setError("");
    if (!files || files.length === 0) return;
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) {
      setError(`You can attach at most ${MAX_PHOTOS} photos.`);
      return;
    }
    const picked = Array.from(files).slice(0, room);
    setBusy(true);
    try {
      const compressed: string[] = [];
      for (const file of picked) {
        if (!file.type.startsWith("image/")) {
          setError("Please choose image files only.");
          continue;
        }
        if (file.size > 15 * 1024 * 1024) {
          setError("One of those images is too large (max 15MB).");
          continue;
        }
        compressed.push(await compressImage(file));
      }
      setPhotos((prev) => [...prev, ...compressed]);
    } catch {
      setError("Couldn't process one of those images — please try another.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  // On the native app, use the OS camera/photo-library picker instead of the
  // <input type="file"> below — see lib/nativePhotoCapture.ts for why that
  // input can make the app appear to close when the camera opens.
  async function handleNativeCapture() {
    setError("");
    if (photos.length >= MAX_PHOTOS) {
      setError(`You can attach at most ${MAX_PHOTOS} photos.`);
      return;
    }
    try {
      const file = await captureNativePhoto();
      if (file) await handleFiles([file]);
    } catch {
      setError("Couldn't get that photo — please try again.");
    }
  }

  function remove(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-2">
      {photos.map((p) => (
        <input key={p} type="hidden" name={name} value={p} />
      ))}
      <label className="text-xs font-medium text-slate-500">Photos (optional, up to {MAX_PHOTOS})</label>

      {photos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {photos.map((p, i) => (
            <div key={p} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p} alt={`Attached photo ${i + 1}`} className="h-20 w-20 rounded-lg border border-slate-200 object-cover" />
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label="Remove photo"
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-white text-xs text-slate-500 shadow-sm hover:text-red-600"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {photos.length < MAX_PHOTOS &&
        (isNative ? (
          <button
            type="button"
            disabled={busy}
            onClick={handleNativeCapture}
            className="rounded-full border-0 bg-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 disabled:opacity-50"
          >
            Add Photo
          </button>
        ) : (
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            disabled={busy}
            onChange={(e) => handleFiles(e.target.files)}
            className="input cursor-pointer file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-slate-200 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-700"
          />
        ))}
      {busy && <p className="text-[11px] text-slate-400">Processing photo...</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
