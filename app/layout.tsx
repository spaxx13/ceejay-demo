import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import PullToRefresh from "@/components/PullToRefresh";
import SplashScreenHider from "@/components/SplashScreenHider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ceejay Cellphone Repair Shop",
  description:
    "Ceejay Cellphone Repair Shop — home service booking, technician assignment, and CRM (Phase 1 demo).",
  appleWebApp: {
    title: "Ceejay",
  },
};

export const viewport: Viewport = {
  themeColor: "#f97316",
  // Disables pinch/double-tap zoom — this stays a website in a regular
  // browser tab (a visitor can still zoom their whole browser via the OS),
  // but inside the Capacitor apps' WKWebView, an accidental zoom gesture
  // has no browser chrome to reset it from and leaves the page stuck
  // showing a scrolled/cropped slice of itself. Real apps don't let
  // content zoom like this either, so it also reads as more "native."
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // Lets content read the real notch/status-bar/home-indicator sizes via
  // CSS env(safe-area-inset-*) instead of guessing a fixed padding — used
  // by the customer app's back-link bar (app/(site)/layout.tsx), which
  // otherwise renders up against/under the status bar on a real device.
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        <SplashScreenHider />
        <PullToRefresh>{children}</PullToRefresh>
      </body>
    </html>
  );
}
