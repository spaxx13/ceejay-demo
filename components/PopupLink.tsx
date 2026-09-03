"use client";

// Opens `href` in a separate browser pop-up window instead of navigating
// the current tab — used for repair-ticket workflows so an operator can
// have several tickets (new records, or pending ones being resumed) open
// side by side in their own windows at once.
export default function PopupLink({
  href,
  children,
  className,
  features,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  features?: string;
}) {
  return (
    <a
      href={href}
      className={className}
      onClick={(e) => {
        e.preventDefault();
        window.open(href, "_blank", features ?? "width=980,height=900,menubar=no,toolbar=no,location=no,status=no,scrollbars=yes,resizable=yes");
      }}
    >
      {children}
    </a>
  );
}
