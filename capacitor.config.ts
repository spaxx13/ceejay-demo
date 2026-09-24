import type { CapacitorConfig } from "@capacitor/cli";

// Wraps the live production site in a native iOS shell rather than
// bundling a static export — this app is server-rendered with server
// actions and a live database, so there's no static build to ship inside
// the app; the shell always loads the real, current site.
const config: CapacitorConfig = {
  appId: "com.ceejayrepair.app",
  appName: "Ceejay",
  webDir: "capacitor-www",
  server: {
    // The app's own dedicated entry screen (just Home Service + Pickup &
    // Delivery — see app/app-home/page.tsx) rather than the full marketing
    // homepage; every deeper page (booking forms, tracking, etc.) is the
    // same live site, so nothing else about the site needed to change.
    url: "https://ceejayrepair.vercel.app/app-home",
    cleartext: false,
    // Without this, any navigation away from the exact url above (e.g.
    // tapping "Home Service" into /request) is treated as external and
    // kicked out to native Safari chrome instead of staying in the app's
    // webview. Every page the app links to lives on this same host.
    allowNavigation: ["ceejayrepair.vercel.app"],
  },
};

export default config;
