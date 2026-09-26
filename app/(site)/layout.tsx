import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import ContactWidget from "@/components/site/ContactWidget";
import AppChrome from "@/components/site/AppChrome";
import { getSiteContent } from "@/lib/db";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const { facebookUrl } = await getSiteContent();

  // Which chrome to show (full site vs. the Capacitor apps' bare "← Back"
  // shell) is decided client-side in AppChrome — see its own comment for
  // why. This keeps the layout itself free of any Dynamic API (headers(),
  // cookies()), so every page under it can still be statically generated.
  return (
    <AppChrome header={<SiteHeader />} footer={<SiteFooter />} contactWidget={<ContactWidget facebookUrl={facebookUrl} />}>
      {children}
    </AppChrome>
  );
}
