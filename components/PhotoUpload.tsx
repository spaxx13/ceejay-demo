"use client";

import { useRef, useState } from "react";

const MAX_DIMENSION = 1280;
const JPEG_QUALITY = 0.75;

// Downscales/recompresses the photo client-side before it goes into the
// form submission as base64 — there's no file storage in this in-memory
// demo, so the image travels inside the server action's request body, and
// keeping it small matters (see next.config.ts bodySizeLimit).
function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.onload = () => {
      img.onerror = () => reject(new Error("Could not decode image"));
      img.onload = () => {
        const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas not supported"));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export default function PhotoUpload({
  name = "photoDataUrl",
  label = "Photo of the Issue (optional)",
  required = false,
}: {
  name?: string;
  label?: string;
  required?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dataUrl, setDataUrl] = useState<string>("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File | undefined) {
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
      ) : (
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
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
