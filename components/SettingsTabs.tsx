"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const GROUPS = [
  {
    label: "Business Setup",
    tabs: [
      { href: "/admin/branches", label: "Branches" },
      { href: "/admin/zones", label: "Zones" },
      { href: "/admin/technicians", label: "Technicians" },
    ],
  },
  {
    label: "Access",
    tabs: [{ href: "/admin/users", label: "Staff Accounts" }],
  },
  {
    label: "Catalog & Workflow",
    tabs: [
      { href: "/admin/device-catalog", label: "Device Catalog" },
      { href: "/admin/service-types", label: "Service Types" },
      { href: "/admin/statuses", label: "Statuses" },
    ],
  },
  {
    label: "Public Site Content",
    tabs: [
      { href: "/admin/site-content", label: "Landing Page" },
      { href: "/admin/request-form", label: "Request Form" },
    ],
  },
];

export default function SettingsTabs() {
  const pathname = usePathname();

  return (
    <div className="card !p-3">
      <div className="flex flex-wrap items-start gap-x-8 gap-y-3">
        {GROUPS.map((group) => (
          <div key={group.label}>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{group.label}</p>
            <div className="flex flex-wrap gap-1">
              {group.tabs.map((tab) => {
                const active = pathname.startsWith(tab.href);
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
        ))}
      </div>
    </div>
  );
}
