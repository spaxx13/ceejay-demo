import Script from "next/script";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import FacebookButton from "@/components/site/FacebookButton";
import { getSiteContent } from "@/lib/db";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const { facebookUrl } = await getSiteContent();

  return (
    <div className="flex min-h-screen flex-col">
      {/* Warms up the connection to Tawk's servers as soon as the page starts
          loading, instead of only once the widget script itself runs — cuts
          the DNS/TLS handshake time off the widget's actual appearance. */}
      <link rel="preconnect" href="https://embed.tawk.to" />
      <link rel="preconnect" href="https://va.tawk.to" />
      <link rel="dns-prefetch" href="https://embed.tawk.to" />
      <SiteHeader />
      <div className="flex-1">{children}</div>
      <SiteFooter />
      <FacebookButton url={facebookUrl} />
      {/* Tawk.to live chat widget — shows the chat bubble on every public page. */}
      <Script id="tawk-to" strategy="afterInteractive">
        {`
          var Tawk_API=Tawk_API||{}, Tawk_LoadStart=new Date();
          (function(){
          var s1=document.createElement("script"),s0=document.getElementsByTagName("script")[0];
          s1.async=true;
          s1.src='https://embed.tawk.to/6aa82c1747c9e9344a37dc82/1k2geof78';
          s1.charset='UTF-8';
          s1.setAttribute('crossorigin','*');
          s0.parentNode.insertBefore(s1,s0);
          })();
        `}
      </Script>
    </div>
  );
}
