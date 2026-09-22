import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import ContactWidget from "@/components/site/ContactWidget";
import { getSiteContent, getBranches } from "@/lib/db";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [{ facebookUrl }, branches] = await Promise.all([getSiteContent(), getBranches()]);
  const homeService = branches.find((b) => b.name === "Home Service");
  const homeServiceOtherProvinces = branches.find((b) => b.name === "Home Service (Other Provinces)");

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <div className="flex-1">{children}</div>
      <SiteFooter />
      <ContactWidget
        facebookUrl={facebookUrl}
        homeServiceNumber={homeService?.contactNumber ?? ""}
        homeServiceOtherProvincesNumber={homeServiceOtherProvinces?.contactNumber ?? ""}
      />
    </div>
  );
}
