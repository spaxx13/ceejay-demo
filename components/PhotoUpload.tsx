"use client";

import { useRef, useState } from "react";
import { compressImage } from "@/lib/imageCompress";
import { captureNativePhoto } from "@/lib/nativePhotoCapture";
import { useIsNativePlatform } from "@/lib/useLiveLocationSharing";

export default function PhotoUpload({
  name = "photoDataUrl",
  label = "Photo of the Issue (optional)",
  required = false,
}: {
  name?: string;
  label?: string;
  required?: boolean;
}) {
  const isNative = useIsNativePlatform();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dataUrl, setDataUrl] = useState<string>("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File | undefined | null) {
    setError("");
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setError("That image is too large (max 15MB).");
      return;
    }
    setBusy(true);
    try {
      const compressed = await compressImage(file);
      setPreview(compressed);
      setDataUrl(compressed);
    } catch {
      setError("Couldn't process that image — please try another.");
    } finally {
      setBusy(false);
    }
  }

  // On the native app, use the OS camera/photo-library picker instead of the
  // <input type="file"> below — see lib/nativePhotoCapture.ts for why that
  // input can make the app appear to close when the camera opens.
  async function handleNativeCapture() {
    setError("");
    setBusy(true);
    try {
      const file = await captureNativePhoto();
      if (file) await handleFile(file);
      else setBusy(false);
    } catch {
      setBusy(false);
      setError("Couldn't get that photo — please try again.");
    }
  }

  function clear() {
    setPreview(null);
    setDataUrl("");
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={dataUrl} />
      <label className="text-xs font-medium text-slate-500">
        {label} {required && <span className="text-red-600">*</span>}
      </label>

      {preview ? (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Selected device issue" className="h-20 w-20 rounded-lg border border-slate-200 object-cover" />
          <div className="space-y-1">
            <p className="text-xs text-slate-500">Photo attached.</p>
            <button type="button" onClick={clear} className="text-xs text-red-600 hover:underline">
              Remove
            </button>
          </div>
        </div>
      ) : isNative ? (
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
          disabled={busy}
          onChange={(e) => handleFile(e.target.files?.[0])}
          className="input cursor-pointer file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-slate-200 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-700"
        />
      )}
      {busy && <p className="text-[11px] text-slate-400">Processing photo...</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
