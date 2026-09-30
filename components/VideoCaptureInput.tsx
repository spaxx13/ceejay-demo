"use client";

import { useEffect, useRef, useState } from "react";

// In-app video capture: records with the browser's own MediaRecorder at
// 720p / ~1.5 Mbps (≈11MB per minute, capped at 2 minutes) so the file
// stays small without anyone touching their phone's camera settings, and
// hands the finished clip to the parent via onCapture. Browsers without
// MediaRecorder fall back to the native camera via a file input. Used by
// UnboxingVideoRecorder and RequestUpdateComposer.
export const MAX_VIDEO_SECONDS = 120;
export const MAX_VIDEO_BYTES = 45 * 1024 * 1024;
const MIME_CANDIDATES = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];

export function fmtSeconds(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function VideoCaptureInput({
  onCapture,
  disabled = false,
  startLabel = "🎥 Start Recording",
}: {
  onCapture: (blob: Blob, seconds: number) => void;
  disabled?: boolean;
  startLabel?: string;
}) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const [canRecordInApp, setCanRecordInApp] = useState(true);

  const previewRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const secondsRef = useRef(0);

  useEffect(() => {
    // Feature detection reads window, so it's done in an effect.
    const id = setTimeout(() => setCanRecordInApp(typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia), 0);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
    };
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
        stopStream();
        setRecording(false);
        onCapture(new Blob(chunksRef.current, { type }), secondsRef.current);
      };
      recorderRef.current = recorder;
      recorder.start(1000);
      secondsRef.current = 0;
      setSeconds(0);
      setRecording(true);
      timerRef.current = setInterval(() => {
        secondsRef.current += 1;
        setSeconds(secondsRef.current);
        if (secondsRef.current >= MAX_VIDEO_SECONDS) stop();
      }, 1000);
    } catch {
      stopStream();
      setError("Couldn't open the camera — allow camera and microphone access, or use the file option.");
    }
  }

  function stop() {
    stopTimer();
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    else {
      stopStream();
      setRecording(false);
    }
  }

  function pickFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      setError("Please choose a video file.");
      return;
    }
    setError("");
    onCapture(file, 0);
  }

  return (
    <div className="space-y-2">
      {canRecordInApp && (
        <>
          <video ref={previewRef} muted playsInline autoPlay className={`w-full rounded-lg bg-black ${recording ? "" : "hidden"}`} />
          {recording ? (
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-red-600">
                <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-red-600" /> REC {fmtSeconds(seconds)} /{" "}
                {fmtSeconds(MAX_VIDEO_SECONDS)}
              </span>
              <button type="button" onClick={stop} className="btn-primary !bg-red-600 !px-4">
                ■ Stop
              </button>
            </div>
          ) : (
            <button type="button" onClick={start} disabled={disabled} className="btn-primary w-full">
              {startLabel}
            </button>
          )}
        </>
      )}
      {!recording && (
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-slate-500">{canRecordInApp ? "Or upload a video you already recorded" : "Record with your camera app"}</label>
          <input
            type="file"
            accept="video/*"
            capture="environment"
            disabled={disabled}
            onChange={(e) => {
              pickFile(e.target.files?.[0]);
              e.target.value = "";
            }}
            className="input cursor-pointer file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-slate-200 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-700"
          />
          {!canRecordInApp && (
            <p className="text-[11px] text-amber-700">
              This browser can&apos;t record in-app — set your camera to 720p / 30 fps first so the file stays small (limit{" "}
              {MAX_VIDEO_BYTES / 1024 / 1024} MB).
            </p>
          )}
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
