"use client";

import { useEffect, useRef, useState } from "react";

// A live-camera-only selfie capture for Check-In — deliberately never
// offers picking an existing photo. The getUserMedia preview+snapshot path
// is the normal route; the <input capture="user"> fallback (used only when
// getUserMedia is unsupported or denied) still forces the device's own
// camera on iOS Safari/Android Chrome rather than showing a photo library
// picker, so there's no path to an old or borrowed photo either way.
export default function SelfieCapture({
  name,
  disabled = false,
  onCapture,
}: {
  name: string;
  disabled?: boolean;
  onCapture?: (dataUrl: string | null) => void;
}) {
  const [photo, setPhotoState] = useState<string | null>(null);
  const setPhoto = (v: string | null) => {
    setPhotoState(v);
    onCapture?.(v);
  };
  const [canUseCamera, setCanUseCamera] = useState(true);
  const [cameraFailed, setCameraFailed] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    // Feature detection reads window, so it's done in an effect.
    const id = setTimeout(() => setCanUseCamera(!!navigator.mediaDevices?.getUserMedia), 0);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    return () => stopStream();
  }, []);

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStreaming(false);
  }

  async function startCamera() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 480 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setStreaming(true);
    } catch {
      setCameraFailed(true);
      setError("Couldn't open the front camera — allow camera access, or use the camera option below.");
    }
  }

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    setPhoto(canvas.toDataURL("image/jpeg", 0.85));
    stopStream();
  }

  function retake() {
    setPhoto(null);
    setError("");
    if (canUseCamera && !cameraFailed) startCamera();
  }

  function pickFile(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(file);
  }

  const showCameraUi = canUseCamera && !cameraFailed;

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={photo ?? ""} />
      {photo ? (
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo} alt="Your selfie" className="h-20 w-20 rounded-lg border border-slate-200 object-cover" />
          <button type="button" onClick={retake} disabled={disabled} className="btn-secondary !px-3 !py-1.5 text-xs">
            Retake
          </button>
        </div>
      ) : showCameraUi ? (
        <div className="space-y-1.5">
          <video ref={videoRef} muted playsInline className={`h-32 w-32 rounded-lg bg-black object-cover ${streaming ? "" : "hidden"}`} />
          {streaming ? (
            <button type="button" onClick={capture} disabled={disabled} className="btn-primary !px-3 !py-1.5 text-xs">
              📸 Take Selfie
            </button>
          ) : (
            <button type="button" onClick={startCamera} disabled={disabled} className="btn-secondary !px-3 !py-1.5 text-xs">
              📷 Open Camera
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-slate-500">Take a selfie</label>
          <input
            type="file"
            accept="image/*"
            capture="user"
            disabled={disabled}
            onChange={(e) => {
              pickFile(e.target.files?.[0]);
              e.target.value = "";
            }}
            className="input cursor-pointer file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-slate-200 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-700"
          />
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
