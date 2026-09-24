import type { NextConfig } from "next";

// Baseline browser hardening for every page. No Content-Security-Policy
// yet — Google Maps, OpenStreetMap tiles, Tawk.to and PayMongo would all
// need allow-listing first.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Stops other sites framing ours (clickjacking the admin/login pages).
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Location is used by the pin map and technician GPS sharing; camera by
  // photo uploads. Nothing else needs these.
  { key: "Permissions-Policy", value: "geolocation=(self), camera=(self), microphone=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
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
