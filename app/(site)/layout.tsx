import { headers } from "next/headers";
import Link from "next/link";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import ContactWidget from "@/components/site/ContactWidget";
import { getSiteContent } from "@/lib/db";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const { facebookUrl } = await getSiteContent();
  // The Ceejay customer app (capacitor.config.ts's appendUserAgent) tags
  // its own requests so this shared layout — used by every public page,
  // including the ones the app links to like /request, /pickup-delivery,
  // and /track — can skip the marketing header/footer/contact widget for
  // it, so booking a repair inside the app doesn't detour through the
  // whole website's navigation. A regular browser (or the Ceejay Admin
  // app, which wants the full site) never sees this tag, so nothing about
  // the public site itself changes.
  const isCustomerApp = (await headers()).get("user-agent")?.includes("CeejayCustomerApp") ?? false;

  if (isCustomerApp) {
    // With no header/footer, a page under here (booking form, tracking,
    // confirmation) would otherwise be a dead end — this is the app's one
    // consistent way back, same destination from anywhere.
    return (
      <div className="min-h-screen">
        <div className="px-4 sm:px-6" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}>
          <Link href="/app-home" className="inline-block text-sm text-slate-400 hover:underline">
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
