import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Photo uploads on the home service form are sent as base64 inside
      // the form submission (no file storage/CDN in this in-memory demo),
      // which inflates size ~33% — leave headroom above the client-side
      // compression target.
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
