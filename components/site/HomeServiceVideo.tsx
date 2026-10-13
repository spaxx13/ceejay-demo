"use client";

import { useState } from "react";
import { trackMetaEvent } from "@/lib/metaPixel";
import { resolveVideoSource } from "@/lib/homeServiceVideo";

// Landing-page video. Plain files autoplay muted (the only autoplay mobile
// browsers allow, and what most people arriving from a Facebook ad expect);
// YouTube/Facebook links render as an embed. The first play is reported to
// the Meta Pixel so ad performance can be judged on video engagement too.
export default function HomeServiceVideo({ url }: { url: string }) {
  const source = resolveVideoSource(url);
  const [failed, setFailed] = useState(false);
  const [tracked, setTracked] = useState(false);

  if (source.kind === "embed") {
    return (
      <div className="aspect-video w-full overflow-hidden rounded-2xl bg-slate-900 shadow-lg">
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

  return (
    <video
      className="aspect-video w-full rounded-2xl bg-slate-900 object-cover shadow-lg"
      src={source.src}
      controls
      muted
      loop
      autoPlay
      playsInline
      preload="metadata"
      onError={() => setFailed(true)}
      onPlay={() => {
        if (tracked) return;
        setTracked(true);
        trackMetaEvent("HomeServiceVideoPlay", undefined, true);
      }}
    />
  );
}
