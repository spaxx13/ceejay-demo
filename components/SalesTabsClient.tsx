"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/sales", label: "By Branch" },
  { href: "/admin/sales/daily", label: "Daily" },
  { href: "/admin/sales/technicians", label: "By Technician" },
  { href: "/admin/sales/home-service", label: "Home Service" },
  { href: "/admin/sales/pickup-delivery", label: "Pickup & Delivery", pickupDeliveryGated: true },
  { href: "/admin/sales/materials", label: "Parts/Material Cost" },
  { href: "/admin/sales/expenses", label: "Expenses" },
];

export default function SalesTabsClient({ canManagePickupDelivery = true }: { canManagePickupDelivery?: boolean }) {
  const pathname = usePathname();
  const tabs = TABS.filter((t) => !("pickupDeliveryGated" in t && t.pickupDeliveryGated) || canManagePickupDelivery);

  return (
    <div className="card !p-3">
      <div className="flex flex-wrap gap-1">
        {tabs.map((tab) => {
          const active = tab.href === "/admin/sales" ? pathname === "/admin/sales" : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                active ? "bg-blue-100 text-blue-500" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
