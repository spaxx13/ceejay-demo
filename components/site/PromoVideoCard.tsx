"use client";

import { useState } from "react";
import { trackMetaEvent } from "@/lib/metaPixel";
import { resolveVideoSource } from "@/lib/homeServiceVideo";
import type { PromoVideo } from "@/lib/promoVideos";

// One tap-to-play vertical video for /promo. Not autoplay: three autoplaying
// videos would eat the customer's mobile data. The first play of each is sent
// to the Meta Pixel as a custom "PromoVideoPlay" event.
export default function PromoVideoCard({ video }: { video: PromoVideo }) {
  const source = resolveVideoSource(video.url);
  const [failed, setFailed] = useState(false);
  const [tracked, setTracked] = useState(false);
  if (failed) return null;

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
        <video
          className={`${frame} object-cover`}
          src={source.src}
          controls
          playsInline
          preload="metadata"
          onError={() => setFailed(true)}
          onPlay={() => {
            if (tracked) return;
            setTracked(true);
            trackMetaEvent("PromoVideoPlay", { content_name: video.title }, true);
          }}
        />
      )}
      <p className="mt-3 font-semibold text-slate-800">{video.title}</p>
      <p className="mt-0.5 text-sm text-slate-400">{video.blurb}</p>
    </div>
  );
}
