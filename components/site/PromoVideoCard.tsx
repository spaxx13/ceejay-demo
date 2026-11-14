"use client";

import { useEffect, useRef, useState } from "react";
import { trackMetaEvent } from "@/lib/metaPixel";
import { resolveVideoSource } from "@/lib/homeServiceVideo";
import type { PromoVideo } from "@/lib/promoVideos";

// One vertical video for /promo. Plain files autoplay muted while they are on
// screen and pause when scrolled away (mobile browsers only allow muted
// autoplay, and only one video plays at a time this way, which keeps data use
// down). Autoplay is skipped for visitors on Data Saver or with reduced motion
// — they just tap play. A tap on "I-tap para sa sound" restarts it with sound.
// The Meta Pixel "PromoVideoPlay" event fires on the viewer's own interaction
// (unmute or pressing play), not on the automatic muted play.
export default function PromoVideoCard({ video }: { video: PromoVideo }) {
  const source = resolveVideoSource(video.url);
  const [failed, setFailed] = useState(false);
  const [muted, setMuted] = useState(true);
  const trackedRef = useRef(false);
  const autoRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const isFile = source.kind === "file";

  useEffect(() => {
    const el = videoRef.current;
    if (!isFile || !el) return;
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (conn?.saveData || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          autoRef.current = true;
          void el.play().catch(() => {
            autoRef.current = false;
          });
        } else {
          el.pause();
        }
      },
      { threshold: 0.6 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [isFile]);

  if (failed) return null;

  function track() {
    if (trackedRef.current) return;
    trackedRef.current = true;
    trackMetaEvent("PromoVideoPlay", { content_name: video.title }, true);
  }

  function unmute() {
    const el = videoRef.current;
    if (!el) return;
    el.currentTime = 0;
    el.muted = false;
    void el.play();
    setMuted(false);
    track();
  }

  const frame = "aspect-[9/16] w-full rounded-xl bg-slate-900";
  return (
    <div className="card !p-3">
      {source.kind === "embed" ? (
        <iframe
          src={source.src}
          title={video.title}
          className={frame}
          allow="encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          loading="lazy"
        />
      ) : (
        <div className="relative">
          <video
            ref={videoRef}
            className={`${frame} object-cover`}
            src={source.src}
            controls
            muted={muted}
            loop
            playsInline
            preload="metadata"
            onError={() => setFailed(true)}
            onVolumeChange={(e) => setMuted(e.currentTarget.muted)}
            onPlay={() => {
              // Automatic muted play doesn't count; the viewer pressing play does.
              if (autoRef.current) {
                autoRef.current = false;
                return;
              }
              track();
            }}
          />
          {muted && (
            <button
              type="button"
              onClick={unmute}
              className="absolute left-1/2 top-3 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/70 px-3 py-1.5 text-xs font-semibold text-white shadow-lg backdrop-blur"
            >
              🔊 I-tap para sa sound
            </button>
          )}
        </div>
      )}
      <p className="mt-3 font-semibold text-slate-800">{video.title}</p>
      <p className="mt-0.5 text-sm text-slate-400">{video.blurb}</p>
    </div>
  );
}
