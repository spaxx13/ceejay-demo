"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { SplashScreen } from "@capacitor/splash-screen";

// Mounted once in the root layout. Only apps built with launchAutoHide
// disabled (currently Ceejay Admin) have the native SplashScreen plugin
// compiled in — hide() rejects harmlessly on the others, so this is safe
// to render unconditionally across every app and the public website.
export default function SplashScreenHider() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    SplashScreen.hide().catch(() => {});
  }, []);

  return null;
}
