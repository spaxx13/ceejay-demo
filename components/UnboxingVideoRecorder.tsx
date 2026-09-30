"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createUnboxingUploadUrl, saveUnboxingVideo } from "@/lib/actions";

// In-app unboxing recorder for a Pickup & Delivery job at the shop. Records
// with the browser's own MediaRecorder at 720p / ~1.5 Mbps (≈11MB per
// minute, capped at 2 minutes) so the file stays small without the
// technician touching their phone's camera settings, previews it, then
// uploads it straight to Supabase Storage via a signed URL from
// createUnboxingUploadUrl and attaches it with saveUnboxingVideo. Browsers
// without MediaRecorder fall back to the native camera via a file input.
const MAX_SECONDS = 120;
const MAX_BYTES = 45 * 1024 * 1024;
const MIME_CANDIDATES = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];

type Phase = "idle" | "recording" | "review" | "uploading" | "done";

function fmt(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function UnboxingVideoRecorder({ requestId, existing }: { requestId: string; existing: boolean }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [blob, setBlob] = useState<Blob | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [canRecordInApp, setCanRecordInApp] = useState(true);

  const previewRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const secondsRef = useRef(0);

  useEffect(() => {
    // Feature detection is impure (reads window), so it's done in an effect.
    const id = setTimeout(() => {
      setCanRecordInApp(typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia);
    }, 0);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (previewRef.current) previewRef.current.srcObject = null;
  }

  function stopTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }

  function adoptBlob(next: Blob) {
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    setBlob(next);
    setBlobUrl(URL.createObjectURL(next));
    setPhase("review");
  }

  async function start() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 }, facingMode: "environment" },
        audio: true,
      });
      streamRef.current = stream;
      if (previewRef.current) {
        previewRef.current.srcObject = stream;
        previewRef.current.play().catch(() => {});
      }
      const mimeType = MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m));
      const recorder = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        videoBitsPerSecond: 1_500_000,
        audioBitsPerSecond: 64_000,
      });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const type = (recorder.mimeType || mimeType || "video/webm").split(";")[0];
        adoptBlob(new Blob(chunksRef.current, { type }));
        stopStream();
      };
      recorderRef.current = recorder;
      recorder.start(1000);
      secondsRef.current = 0;
      setSeconds(0);
      setPhase("recording");
      timerRef.current = setInterval(() => {
        secondsRef.current += 1;
        setSeconds(secondsRef.current);
        if (secondsRef.current >= MAX_SECONDS) stop();
      }, 1000);
    } catch {
      stopStream();
      setError("Couldn't open the camera — allow camera and microphone access, or use the file option below.");
    }
  }

  function stop() {
    stopTimer();
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    else stopStream();
  }

  function retake() {
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    setBlob(null);
    setBlobUrl(null);
    setProgress(0);
    setError("");
    setPhase("idle");
  }

  function pickFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      setError("Please choose a video file.");
      return;
    }
    secondsRef.current = 0;
    setSeconds(0);
    adoptBlob(file);
  }

  async function upload() {
    if (!blob) return;
    setError("");
    if (blob.size > MAX_BYTES) {
      setError(`That video is ${(blob.size / 1024 / 1024).toFixed(0)}MB — the limit is ${MAX_BYTES / 1024 / 1024}MB. Please record a shorter clip.`);
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
    const saved = await saveUnboxingVideo(requestId, target.path, contentType, secondsRef.current);
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
          and the IMEI/serial. Up to {fmt(MAX_SECONDS)}. Good light, steady hands, no zoom.
        </p>
      </div>

      {(phase === "idle" || phase === "recording") && canRecordInApp && (
        <div className="space-y-2">
          <video ref={previewRef} muted playsInline autoPlay className={`w-full rounded-lg bg-black ${phase === "recording" ? "" : "hidden"}`} />
          {phase === "recording" ? (
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-red-600">
                <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-red-600" /> REC {fmt(seconds)} / {fmt(MAX_SECONDS)}
              </span>
              <button type="button" onClick={stop} className="btn-primary !bg-red-600 !px-4">
                ■ Stop
              </button>
            </div>
          ) : (
            <button type="button" onClick={start} className="btn-primary w-full">
              🎥 Start Recording
            </button>
          )}
        </div>
      )}

      {phase === "idle" && (
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-slate-500">{canRecordInApp ? "Or upload a video you already recorded" : "Record with your camera app"}</label>
          <input
            type="file"
            accept="video/*"
            capture="environment"
            onChange={(e) => pickFile(e.target.files?.[0])}
            className="input cursor-pointer file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-slate-200 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-700"
          />
          {!canRecordInApp && (
            <p className="text-[11px] text-amber-700">
              This browser can&apos;t record in-app — set your camera to 720p / 30 fps first so the file stays small (limit {MAX_BYTES / 1024 / 1024}
              MB).
            </p>
          )}
        </div>
      )}

      {(phase === "review" || phase === "uploading") && blob && blobUrl && (
        <div className="space-y-2">
          <video src={blobUrl} controls playsInline className="w-full rounded-lg bg-black" />
          <p className="text-[11px] text-slate-400">
            {seconds > 0 ? `${fmt(seconds)} · ` : ""}
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
