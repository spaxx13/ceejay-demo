// Video shown on the /home-service ad landing page. Set
// NEXT_PUBLIC_HOME_SERVICE_VIDEO_URL to a direct .mp4 link, a YouTube link or
// a Facebook video/reel link; leave it unset to use the file dropped at
// public/videos/home-service.mp4.
const VIDEO_ENV = process.env.NEXT_PUBLIC_HOME_SERVICE_VIDEO_URL?.trim();

export const HOME_SERVICE_VIDEO_URL = VIDEO_ENV || "/videos/home-service.mp4";

export type VideoSource = { kind: "file"; src: string } | { kind: "embed"; src: string };

export function resolveVideoSource(url: string): VideoSource {
  try {
    const u = new URL(url, "https://placeholder.local");
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") return { kind: "embed", src: `https://www.youtube.com/embed/${u.pathname.slice(1)}?rel=0` };
    if (host === "youtube.com" || host === "m.youtube.com") {
      const id = u.searchParams.get("v") ?? u.pathname.split("/").filter(Boolean).pop();
      if (id) return { kind: "embed", src: `https://www.youtube.com/embed/${id}?rel=0` };
    }
    if (host === "facebook.com" || host === "m.facebook.com" || host === "fb.watch") {
      return {
        kind: "embed",
        src: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(u.toString())}&show_text=false`,
      };
    }
  } catch {
    // fall through to a plain file
  }
  return { kind: "file", src: url };
}
