"use client";

import { useEffect } from "react";
import { saveFcmToken } from "@/lib/actions";
import { useIsNativePlatform } from "@/lib/useLiveLocationSharing";

// Native-app counterpart to PushSubscribe.tsx: a Capacitor app's WKWebView
// can't receive the browser Push API the way PushSubscribe.tsx's web push
// does, so notifying the native admin/technician/rider apps goes through
// Firebase Cloud Messaging instead (@capacitor-firebase/messaging, relayed
// to APNs on iOS) — see lib/fcm.ts. Renders nothing; just registers this
// device's token with the server once on mount, silently, no button —
// there's no reason not to have this always on for staff accounts.
export default function FcmRegister() {
  const isNative = useIsNativePlatform();

  useEffect(() => {
    if (!isNative) return;
    let cancelled = false;

    async function register() {
      try {
        const { FirebaseMessaging } = await import("@capacitor-firebase/messaging");
        const perm = await FirebaseMessaging.requestPermissions();
        if (cancelled || perm.receive !== "granted") return;
        const { token } = await FirebaseMessaging.getToken();
        if (!cancelled && token) await saveFcmToken(token);
      } catch {
        // Best-effort — e.g. Firebase not configured for this build yet.
      }
    }

    register();
    return () => {
      cancelled = true;
    };
  }, [isNative]);

  return null;
}
