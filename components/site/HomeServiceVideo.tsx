"use client";

import { useRef, useState } from "react";
import { trackMetaEvent } from "@/lib/metaPixel";
import { resolveVideoSource } from "@/lib/homeServiceVideo";

// Vertical (9:16) frame, capped in width so it doesn't fill the whole phone
// screen and push the booking form out of reach.
const FRAME = "mx-auto aspect-[9/16] w-full max-w-[320px] rounded-2xl bg-slate-900 shadow-lg";

// Landing-page video. Plain files autoplay muted (the only autoplay mobile browsers allow);
// YouTube/Facebook links render as an embed. The first play is reported to
// the Meta Pixel so ad performance can be judged on video engagement too.
export default function HomeServiceVideo({ url }: { url: string }) {
  const source = resolveVideoSource(url);
  const [failed, setFailed] = useState(false);
  const [tracked, setTracked] = useState(false);
  const [muted, setMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  if (source.kind === "embed") {
    return (
      <div className={`${FRAME} overflow-hidden`}>
        <iframe
          src={source.src}
          title="Ceejay home service"
          className="h-full w-full"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          loading="lazy"
        />
      </div>
    );
  }

  if (failed) return null;

  // Browsers only allow autoplay while muted, so sound has to be switched on
  // by a tap — the overlay button makes that obvious (the native control is
  // easy to miss) and restarts from the top so the viewer hears the intro.
  function unmute() {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    v.muted = false;
    void v.play();
    setMuted(false);
  }

  return (
    <div className="relative mx-auto w-full max-w-[320px]">
      <video
        ref={videoRef}
        className={`${FRAME} object-cover`}
        src={source.src}
        controls
        muted={muted}
        loop
        autoPlay
        playsInline
        preload="metadata"
        onError={() => setFailed(true)}
        onVolumeChange={(e) => setMuted(e.currentTarget.muted)}
        onPlay={() => {
          if (tracked) return;
          setTracked(true);
          trackMetaEvent("HomeServiceVideoPlay", undefined, true);
        }}
      />
      {muted && (
        <button
          type="button"
          onClick={unmute}
          className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-black/70 px-4 py-2 text-xs font-semibold text-white shadow-lg backdrop-blur"
        >
          🔊 I-tap para sa sound
        </button>
      )}
    </div>
  );
}
