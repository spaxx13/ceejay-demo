import { headers } from "next/headers";
import Link from "next/link";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import ContactWidget from "@/components/site/ContactWidget";
import { getSiteContent } from "@/lib/db";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const { facebookUrl } = await getSiteContent();
  // The Ceejay customer and admin apps (capacitor.config.ts's
  // appendUserAgent) tag their own requests so this shared layout — used
  // by every public page, including the ones the apps can link to like
  // /request, /pickup-delivery, and /track — can skip the marketing
  // header/footer/contact widget for them, so ending up here inside an
  // app doesn't detour through the whole website's navigation. A regular
  // browser never sees either tag, so nothing about the public site
  // itself changes.
  const userAgent = (await headers()).get("user-agent") ?? "";
  const isCustomerApp = userAgent.includes("CeejayCustomerApp");
  const isAdminApp = userAgent.includes("CeejayAdminApp");

  if (isCustomerApp || isAdminApp) {
    // With no header/footer, a page under here would otherwise be a dead
    // end — this is the app's one consistent way back, same destination
    // from anywhere.
    return (
      <div className="min-h-screen">
        <div className="px-4 sm:px-6" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}>
          <Link href={isAdminApp ? "/admin" : "/app-home"} className="inline-block text-sm text-slate-400 hover:underline">
            ← Back
          </Link>
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <div className="flex-1">{children}</div>
      <SiteFooter />
      <ContactWidget facebookUrl={facebookUrl} />
    </div>
  );
}
