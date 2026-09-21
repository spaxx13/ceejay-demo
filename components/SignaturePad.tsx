"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Point = { x: number; y: number };

// A signature only needs to be legible, not high-res — capping the export
// keeps the saved PNG small (and the checklist submission's total payload
// under the server action's body size limit) no matter how big the on-screen
// canvas gets, which full-screen mode can push well past 1000px on a
// high-DPI phone.
const MAX_EXPORT_DIMENSION = 800;
function exportDataUrl(canvas: HTMLCanvasElement): string {
  const scale = Math.min(1, MAX_EXPORT_DIMENSION / Math.max(canvas.width, canvas.height));
  if (scale >= 1) return canvas.toDataURL("image/png");
  const scaled = document.createElement("canvas");
  scaled.width = Math.round(canvas.width * scale);
  scaled.height = Math.round(canvas.height * scale);
  const ctx = scaled.getContext("2d");
  if (!ctx) return canvas.toDataURL("image/png");
  ctx.drawImage(canvas, 0, 0, scaled.width, scaled.height);
  return scaled.toDataURL("image/png");
}

// Captures a signature by drawing on a canvas (mouse or touch) and exposes
// it as a base64 PNG via a hidden input — same "no file storage, just
// in-memory data URLs" approach as PhotoUpload.
export default function SignaturePad({ name, label }: { name: string; label: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [dataUrl, setDataUrl] = useState("");
  const [hasDrawn, setHasDrawn] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // iOS Safari has no web API to lock screen orientation (an Apple platform
  // restriction, not something any JS/CSS trick works around) — the real
  // lock in enterFullscreen() silently no-ops there. This tracks whether the
  // phone is still portrait so full screen can prompt the customer to rotate
  // manually on browsers where the automatic lock didn't take.
  const [viewportIsPortrait, setViewportIsPortrait] = useState(false);
  useEffect(() => {
    function updateOrientation() {
      setViewportIsPortrait(window.innerHeight > window.innerWidth);
    }
    updateOrientation();
    window.addEventListener("resize", updateOrientation);
    return () => window.removeEventListener("resize", updateOrientation);
  }, []);

  // Strokes are kept as points (in the canvas's current CSS-pixel space)
  // rather than only as a rasterized snapshot, so a resize — full screen
  // toggle or device rotation — can replay them at the new size instead of
  // stretching a bitmap, which distorts and blurs the signature.
  const strokesRef = useRef<Point[][]>([]);
  const sizeRef = useRef({ width: 0, height: 0 });

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

  function redrawStrokes(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    for (const stroke of strokesRef.current) {
      if (stroke.length === 0) continue;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (const point of stroke.slice(1)) ctx.lineTo(point.x, point.y);
      ctx.stroke();
    }
  }

  // Resizes the canvas to match its current CSS layout, and — if it's
  // already holding strokes — rescales them by a single uniform factor
  // (never independently per axis) so the signature keeps its proportions
  // instead of stretching to fill a box with a different aspect ratio.
  const resizeAndRedraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const previous = sizeRef.current;
    if (!ensureSized(canvas)) return;
    const next = { width: canvas.clientWidth, height: canvas.clientHeight };
    const sizeChanged = previous.width > 0 && previous.height > 0 && (previous.width !== next.width || previous.height !== next.height);
    if (sizeChanged) {
      const scale = Math.min(next.width / previous.width, next.height / previous.height);
      const offsetX = (next.width - previous.width * scale) / 2;
      const offsetY = (next.height - previous.height * scale) / 2;
      strokesRef.current = strokesRef.current.map((stroke) =>
        stroke.map((p) => ({ x: p.x * scale + offsetX, y: p.y * scale + offsetY })),
      );
    }
    sizeRef.current = next;
    redrawStrokes(canvas);
    if (sizeChanged && strokesRef.current.some((s) => s.length > 0)) {
      setDataUrl(exportDataUrl(canvas));
    }
  }, []);

  useEffect(() => {
    resizeAndRedraw();
  }, [resizeAndRedraw, isFullscreen]);

  // Catches device rotation / viewport changes even without toggling full screen.
  useEffect(() => {
    window.addEventListener("resize", resizeAndRedraw);
    return () => window.removeEventListener("resize", resizeAndRedraw);
  }, [resizeAndRedraw]);

  // Keeps the page from scrolling behind the overlay while signing full screen.
  useEffect(() => {
    if (!isFullscreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isFullscreen]);

  // If the browser drops out of fullscreen on its own (Android back button,
  // system gesture) instead of via the Done button, follow it so the toggle
  // label and orientation lock don't go stale.
  useEffect(() => {
    function handleFullscreenChange() {
      if (!document.fullscreenElement) setIsFullscreen(false);
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Real orientation lock only works while the element is in the Fullscreen
  // API's fullscreen (not just our own fixed-position overlay), and only on
  // browsers that support it at all — notably not iOS Safari. Where it's
  // unsupported this silently no-ops and the box still fills the screen in
  // whatever orientation the phone is already in, which stays undistorted.
  async function enterFullscreen() {
    try {
      await containerRef.current?.requestFullscreen();
    } catch {}
    try {
      await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> })?.lock?.("landscape");
    } catch {}
    setIsFullscreen(true);
  }
  function exitFullscreen() {
    try {
      (screen.orientation as ScreenOrientation & { unlock?: () => void })?.unlock?.();
    } catch {}
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    setIsFullscreen(false);
  }

  function pointFromEvent(e: React.PointerEvent<HTMLCanvasElement>) {
    const native = e.nativeEvent;
    return { x: native.offsetX, y: native.offsetY };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    resizeAndRedraw();
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
    const point = pointFromEvent(e);
    strokesRef.current.push([point]);
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const point = pointFromEvent(e);
    strokesRef.current[strokesRef.current.length - 1]?.push(point);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    setHasDrawn(true);
  }
  function end(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    drawing.current = false;
    if (canvasRef.current?.hasPointerCapture(e.pointerId)) canvasRef.current.releasePointerCapture(e.pointerId);
    setDataUrl(canvasRef.current ? exportDataUrl(canvasRef.current) : "");
  }
  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    strokesRef.current = [];
    setDataUrl("");
    setHasDrawn(false);
  }

  return (
    <div ref={containerRef} className={isFullscreen ? "fixed inset-0 z-50 flex flex-col gap-2 bg-white p-4" : "space-y-1.5"}>
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
            onClick={() => (isFullscreen ? exitFullscreen() : enterFullscreen())}
            className="text-xs font-medium text-indigo-600 hover:underline"
          >
            {isFullscreen ? "Done" : "Full screen"}
          </button>
        </div>
      </div>
      {isFullscreen && viewportIsPortrait && (
        <p className="rounded-md bg-indigo-50 px-3 py-2 text-center text-xs font-medium text-indigo-700">
          Rotate your phone to landscape for a wider signing area.
        </p>
      )}
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
