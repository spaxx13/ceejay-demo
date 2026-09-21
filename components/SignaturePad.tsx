"use client";

import { useEffect, useRef, useState } from "react";

// Captures a signature by drawing on a canvas (mouse or touch) and exposes
// it as a base64 PNG via a hidden input — same "no file storage, just
// in-memory data URLs" approach as PhotoUpload.
export default function SignaturePad({ name, label }: { name: string; label: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [dataUrl, setDataUrl] = useState("");
  const [hasDrawn, setHasDrawn] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const dataUrlRef = useRef(dataUrl);
  useEffect(() => {
    dataUrlRef.current = dataUrl;
  }, [dataUrl]);

  // Sizes the canvas's backing bitmap to match its current CSS layout size.
  // Re-checked (not just run once on mount) because if this component
  // mounts before layout has settled — e.g. a still-hidden/backgrounded
  // tab — clientWidth/clientHeight can read 0 at mount time, permanently
  // leaving the bitmap at 0px wide with no later recovery otherwise.
  function ensureSized(canvas: HTMLCanvasElement) {
    const ratio = window.devicePixelRatio || 1;
    const targetWidth = Math.round(canvas.clientWidth * ratio);
    const targetHeight = Math.round(canvas.clientHeight * ratio);
    if (targetWidth === 0 || targetHeight === 0) return false;
    if (canvas.width === targetWidth && canvas.height === targetHeight) return true;
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#1d1d1f";
    return true;
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    ensureSized(canvas);
  }, []);

  // Entering/leaving full screen changes the canvas's CSS size, which resets
  // its bitmap — repaint whatever was already signed so switching modes
  // mid-signature doesn't lose the stroke.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    ensureSized(canvas);
    if (!dataUrlRef.current) return;
    const img = new Image();
    img.onload = () => {
      canvasRef.current?.getContext("2d")?.drawImage(img, 0, 0, canvas.clientWidth, canvas.clientHeight);
    };
    img.src = dataUrlRef.current;
  }, [isFullscreen]);

  // Keeps the page from scrolling behind the overlay while signing full screen.
  useEffect(() => {
    if (!isFullscreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isFullscreen]);

  function pointFromEvent(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    ensureSized(canvas);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    e.preventDefault();
    // Keeps receiving pointermove/pointerup for this pointer even if the
    // cursor briefly drifts outside the canvas mid-stroke — a trackpad's
    // acceleration makes that easy to trigger on a compact box, and without
    // capture the stroke would otherwise cut off right there (see the old
    // onPointerLeave-ends-the-stroke behavior this replaces).
    canvas.setPointerCapture(e.pointerId);
    drawing.current = true;
    const { x, y } = pointFromEvent(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = pointFromEvent(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasDrawn(true);
  }
  function end(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    drawing.current = false;
    if (canvasRef.current?.hasPointerCapture(e.pointerId)) canvasRef.current.releasePointerCapture(e.pointerId);
    setDataUrl(canvasRef.current?.toDataURL("image/png") ?? "");
  }
  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setDataUrl("");
    setHasDrawn(false);
  }

  return (
    <div className={isFullscreen ? "fixed inset-0 z-50 flex flex-col gap-2 bg-white p-4" : "space-y-1.5"}>
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-slate-500">{label}</label>
        <div className="flex items-center gap-3">
          {hasDrawn && (
            <button type="button" onClick={clear} className="text-xs text-red-600 hover:underline">
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsFullscreen((v) => !v)}
            className="text-xs font-medium text-indigo-600 hover:underline"
          >
            {isFullscreen ? "Done" : "Full screen"}
          </button>
        </div>
      </div>
      <input type="hidden" name={name} value={dataUrl} />
      <canvas
        ref={canvasRef}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        className={
          isFullscreen
            ? "w-full flex-1 touch-none rounded-lg border border-slate-300 bg-white"
            : "h-32 w-full touch-none rounded-lg border border-slate-300 bg-white"
        }
      />
      {!hasDrawn && <p className="text-[11px] text-slate-400">Sign above with mouse, stylus, or finger.</p>}
    </div>
  );
}
