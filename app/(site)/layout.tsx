import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import ContactWidget from "@/components/site/ContactWidget";
import { getSiteContent } from "@/lib/db";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const { facebookUrl } = await getSiteContent();

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <div className="flex-1">{children}</div>
      <SiteFooter />
      <ContactWidget facebookUrl={facebookUrl} />
    </div>
  );
}
