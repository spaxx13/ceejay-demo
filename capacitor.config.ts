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
    url: "https://ceejayrepair.vercel.app",
    cleartext: false,
  },
};

export default config;
