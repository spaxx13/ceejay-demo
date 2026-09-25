"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/lib/actions";
import Logo from "@/components/Logo";
import PushSubscribe from "@/components/PushSubscribe";

const NAV_GROUPS: {
  label: string | null;
  links: {
    href: string;
    label: string;
    ownerOnly?: boolean;
    requestsGated?: boolean;
    walkinsGated?: boolean;
    crmGated?: boolean;
    repairPricingGated?: boolean;
  }[];
}[] = [
  { label: null, links: [{ href: "/admin", label: "Dashboard" }] },
  {
    label: "Operations",
    links: [
      { href: "/admin/requests", label: "Home Service Requests", requestsGated: true },
      { href: "/admin/pickup-delivery", label: "Pickup & Delivery", requestsGated: true },
      { href: "/admin/walk-ins", label: "Walk-In Registrations", walkinsGated: true },
      { href: "/admin/pos", label: "POS" },
      { href: "/admin/sales", label: "Branch Sales" },
      { href: "/admin/check-ins", label: "Check-Ins" },
      { href: "/admin/service-prices", label: "Repair Pricing", repairPricingGated: true },
    ],
  },
  { label: "Customers", links: [{ href: "/admin/crm", label: "CRM", crmGated: true }] },
  {
    label: "Tools",
    links: [
      { href: "/admin/tools/panic-log", label: "Panic Log Checker" },
      { href: "/admin/tools/icloud-checks", label: "iCloud Status Checks" },
      { href: "/admin/trash", label: "Trash" },
    ],
  },
  { label: null, links: [{ href: "/admin/notifications", label: "Notifications" }] },
];

const SETTINGS_ROUTES = [
  "/admin/settings",
  "/admin/users",
  "/admin/branches",
  "/admin/technicians",
  "/admin/riders",
  "/admin/device-catalog",
  "/admin/service-types",
  "/admin/statuses",
  "/admin/site-content",
  "/admin/request-form",
];

export default function AdminNav({
  userName,
  role,
  canManageRequests = true,
  canManageWalkIns = true,
  canAccessCrm = true,
  canManageRepairPricing = true,
  unreadCount = 0,
  vapidPublicKey = null,
}: {
  userName: string;
  role: string;
  canManageRequests?: boolean;
  canManageWalkIns?: boolean;
  canAccessCrm?: boolean;
  canManageRepairPricing?: boolean;
  unreadCount?: number;
  vapidPublicKey?: string | null;
}) {
  const pathname = usePathname();
  const settingsActive = SETTINGS_ROUTES.some((r) => pathname.startsWith(r));
  const [open, setOpen] = useState(false);
  const closeMenu = () => setOpen(false);

  const links = (
    <nav className="flex flex-col gap-1 overflow-y-auto px-3 py-2 md:flex-1">
      {NAV_GROUPS.map((group, i) => (
        <div key={group.label ?? `g${i}`} className={i > 0 ? "mt-2" : undefined}>
          {group.label && <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{group.label}</p>}
          {group.links
            .filter((l) => !l.ownerOnly || role === "owner_admin")
            .filter((l) => !l.requestsGated || canManageRequests)
            .filter((l) => !l.walkinsGated || canManageWalkIns)
            .filter((l) => !l.crmGated || canAccessCrm)
            .filter((l) => !l.repairPricingGated || canManageRepairPricing)
            .map((l) => {
              const active = l.href === "/admin" ? pathname === "/admin" : pathname.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={closeMenu}
                  className={`flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    active ? "bg-blue-200 text-blue-300" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                  }`}
                >
                  {l.label}
                  {l.href === "/admin/notifications" && unreadCount > 0 && (
                    <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </Link>
              );
            })}
        </div>
      ))}
      {role === "owner_admin" && (
        <>
          <div className="my-2 border-t border-slate-200" />
          <Link
            href="/admin/settings"
            onClick={closeMenu}
            className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              settingsActive ? "bg-blue-200 text-blue-300" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            }`}
          >
            Settings
          </Link>
        </>
      )}
    </nav>
  );

  const account = (
    <div className="space-y-2 border-t border-slate-200 px-4 py-4">
      <p className="truncate text-xs text-slate-400">
        {userName} · <span className="uppercase">{role.replace("_", " ")}</span>
      </p>
      <PushSubscribe vapidPublicKey={vapidPublicKey} />
      <form action={logoutAction}>
        <button className="btn-secondary w-full !py-1.5 text-xs" type="submit">
          Log out
        </button>
      </form>
    </div>
  );

  return (
    <>
      {/* Mobile top bar — a real sidebar doesn't fit a phone screen, so this
          collapses navigation into a slide-out drawer instead. */}
      <div
        className="glass sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 px-4 print:hidden md:hidden"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)", paddingBottom: "0.75rem" }}
      >
        <Link href="/admin" className="flex items-center gap-2">
          <Logo className="h-7 w-7 shrink-0" />
          <span className="text-sm font-bold brand-gradient-text">Ceejay Admin</span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="relative rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          {unreadCount > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />}
        </button>
      </div>

      {/* Mobile drawer */}
      <div className={`fixed inset-0 z-40 md:hidden ${open ? "" : "pointer-events-none"}`}>
        <div
          className={`absolute inset-0 bg-black/30 transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0"}`}
          onClick={closeMenu}
        />
        <aside
          className={`glass absolute left-0 top-0 flex h-full w-72 max-w-[85vw] flex-col overflow-y-auto border-r border-slate-200 shadow-xl transition-transform duration-200 ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="flex items-center justify-between px-4 py-4">
            <Link href="/admin" className="flex items-center gap-2" onClick={closeMenu}>
              <Logo className="h-7 w-7 shrink-0" />
              <span className="text-sm font-bold brand-gradient-text">Ceejay Admin</span>
            </Link>
            <button type="button" onClick={closeMenu} aria-label="Close menu" className="rounded-md p-2 text-slate-500 hover:bg-slate-100">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          {links}
          {account}
        </aside>
      </div>

      {/* Desktop sidebar — unchanged from before, always visible */}
      <aside className="glass hidden border-r border-slate-200 print:hidden md:sticky md:top-0 md:flex md:h-screen md:w-56 md:shrink-0 md:flex-col">
        <Link href="/admin" className="flex items-center gap-2 px-4 py-4">
          <Logo className="h-7 w-7 shrink-0" />
          <span className="text-sm font-bold brand-gradient-text">Ceejay Admin</span>
        </Link>
        {links}
        {account}
      </aside>
    </>
  );
}
