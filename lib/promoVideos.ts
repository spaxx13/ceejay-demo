// The three videos on the /promo ad landing page. Drop the files in
// public/videos/ with these names, or set the matching env var to a direct
// .mp4 link, a YouTube link or a Facebook video/reel link (see
// resolveVideoSource in lib/homeServiceVideo.ts). A video whose file is
// missing or fails to load is simply hidden from the page.
export type PromoVideo = { id: string; title: string; blurb: string; url: string };

export const PROMO_VIDEOS: PromoVideo[] = [
  {
    id: "simple-repair",
    title: "Simpleng Repair",
    blurb: "Screen, battery, charging port — tingnan kung gaano kabilis.",
    url: process.env.NEXT_PUBLIC_PROMO_VIDEO_SIMPLE_URL?.trim() || "/videos/promo-simple-repair.mp4",
  },
  {
    id: "board-repair",
    title: "Board Problem",
    blurb: "Ayaw mag-on o may short? Component-level repair sa logic board.",
    url: process.env.NEXT_PUBLIC_PROMO_VIDEO_BOARD_URL?.trim() || "/videos/promo-board-repair.mp4",
  },
  {
    id: "reglass",
    title: "Reglass",
    blurb: "Basag ang glass pero ok pa ang LCD? Palit-glass lang.",
    url: process.env.NEXT_PUBLIC_PROMO_VIDEO_REGLASS_URL?.trim() || "/videos/promo-reglass.mp4",
  },
];
