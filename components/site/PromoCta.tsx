"use client";

import Link from "next/link";
import { trackMetaEvent } from "@/lib/metaPixel";

// Call-to-action link for the Facebook-ads landing page (/promo). Fires a
// Meta Pixel event on click so the ad campaign can be optimised for (and
// report on) real intent — not just page views. The booking form still sends
// its own "Lead" when a booking is actually submitted.
export default function PromoCta({
  href,
  event,
  label,
  className,
  external = false,
  children,
}: {
  href: string;
  event: "Contact" | "FindLocation" | "Schedule" | "Lead";
  label: string;
  className?: string;
  external?: boolean;
  children: React.ReactNode;
}) {
  const onClick = () => trackMetaEvent(event, { content_name: label });
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" onClick={onClick} className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} onClick={onClick} className={className}>
      {children}
    </Link>
  );
}
