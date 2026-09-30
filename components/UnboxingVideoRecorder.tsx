"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createUnboxingUploadUrl, saveUnboxingVideo } from "@/lib/actions";
import VideoCaptureInput, { MAX_VIDEO_BYTES, MAX_VIDEO_SECONDS, fmtSeconds } from "./VideoCaptureInput";

// Unboxing recorder for a Pickup & Delivery job at the shop: capture
// (VideoCaptureInput), preview, then upload straight to Supabase Storage
// via a signed URL from createUnboxingUploadUrl and attach it as a draft
// with saveUnboxingVideo — the customer only sees it after "Send to
// Customer" (UnboxingVideoReview).
type Phase = "capture" | "review" | "uploading" | "done";

export default function UnboxingVideoRecorder({ requestId, existing }: { requestId: string; existing: boolean }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("capture");
  const [seconds, setSeconds] = useState(0);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [blob, setBlob] = useState<Blob | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  function captured(next: Blob, recordedSeconds: number) {
    setBlob(next);
    setBlobUrl(URL.createObjectURL(next));
    setSeconds(recordedSeconds);
    setError("");
    setPhase("review");
  }

  function retake() {
    setBlob(null);
    setBlobUrl(null);
    setProgress(0);
    setError("");
    setPhase("capture");
  }

  async function upload() {
    if (!blob) return;
    setError("");
    if (blob.size > MAX_VIDEO_BYTES) {
      setError(`That video is ${(blob.size / 1024 / 1024).toFixed(0)}MB — the limit is ${MAX_VIDEO_BYTES / 1024 / 1024}MB. Please record a shorter clip.`);
      return;
    }
    setPhase("uploading");
    setProgress(0);
    const contentType = blob.type.split(";")[0] || "video/webm";
    const target = await createUnboxingUploadUrl(requestId, contentType);
    if (!target.ok) {
      setError(target.error);
      setPhase("review");
      return;
    }
    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", target.uploadUrl);
        xhr.setRequestHeader("Content-Type", contentType);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
        xhr.onerror = () => reject(new Error("Upload failed — check the connection and try again."));
        xhr.send(blob);
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed — please try again.");
      setPhase("review");
      return;
    }
    const saved = await saveUnboxingVideo(requestId, target.path, contentType, seconds);
    if (!saved.ok) {
      setError(saved.error);
      setPhase("review");
      return;
    }
    setPhase("done");
    router.refresh();
  }

  if (phase === "done") {
    return (
      <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
        ✅ Saved as a draft — watch it back above, then tap <span className="font-semibold">Send to Customer</span> when you&apos;re happy with it (or
        Retake / Delete).
      </p>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 p-3">
      <div>
        <p className="text-xs font-semibold text-slate-700">{existing ? "Record a replacement unboxing video" : "Record the unboxing video"}</p>
        <p className="text-[11px] text-slate-400">
          Start recording before opening the package: show the sealed package and seal number, open it, then show the device from all sides
          and the IMEI/serial. Up to {fmtSeconds(MAX_VIDEO_SECONDS)}. Good light, steady hands, no zoom.
        </p>
      </div>

      {phase === "capture" && <VideoCaptureInput onCapture={captured} />}

      {(phase === "review" || phase === "uploading") && blob && blobUrl && (
        <div className="space-y-2">
          <video src={blobUrl} controls playsInline className="w-full rounded-lg bg-black" />
          <p className="text-[11px] text-slate-400">
            {seconds > 0 ? `${fmtSeconds(seconds)} · ` : ""}
            {(blob.size / 1024 / 1024).toFixed(1)} MB
          </p>
          {phase === "uploading" ? (
            <div className="space-y-1">
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div className="h-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-xs text-slate-500">Uploading… {progress}% — keep this page open.</p>
            </div>
          ) : (
            <div className="flex gap-2">
              <button type="button" onClick={upload} className="btn-primary flex-1">
                ⬆ Upload & Attach
              </button>
              <button type="button" onClick={retake} className="btn-secondary">
                Retake
              </button>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
