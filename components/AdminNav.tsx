"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/lib/actions";
import Logo from "@/components/Logo";

const LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/pos", label: "POS" },
  { href: "/admin/inventory", label: "Inventory" },
  { href: "/admin/requests", label: "Home Service Requests" },
  { href: "/admin/crm", label: "CRM" },
  { href: "/admin/notifications", label: "Notifications" },
];

const SETTINGS_ROUTES = [
  "/admin/settings",
  "/admin/users",
  "/admin/branches",
  "/admin/zones",
  "/admin/technicians",
  "/admin/device-catalog",
  "/admin/service-types",
  "/admin/statuses",
  "/admin/site-content",
  "/admin/request-form",
];

export default function AdminNav({ userName, role, unreadCount = 0 }: { userName: string; role: string; unreadCount?: number }) {
  const pathname = usePathname();
  const settingsActive = SETTINGS_ROUTES.some((r) => pathname.startsWith(r));

  return (
    <aside className="glass flex w-full shrink-0 flex-col border-b border-slate-200 md:h-screen md:w-56 md:border-b-0 md:border-r md:sticky md:top-0">
      <Link href="/admin" className="flex items-center gap-2 px-4 py-4">
        <Logo className="h-7 w-7 shrink-0" />
        <span className="text-sm font-bold brand-gradient-text">Ceejay Admin</span>
      </Link>

      <nav className="flex flex-col gap-1 overflow-y-auto px-3 py-2 md:flex-1">
        {LINKS.map((l) => {
          const active = l.href === "/admin" ? pathname === "/admin" : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
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
        {role === "owner_admin" && (
          <>
            <div className="my-2 border-t border-slate-200" />
            <Link
              href="/admin/settings"
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                settingsActive ? "bg-blue-200 text-blue-300" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              }`}
            >
              Settings
            </Link>
          </>
        )}
      </nav>

      <div className="border-t border-slate-200 px-4 py-4">
        <p className="truncate text-xs text-slate-400">
          {userName} · <span className="uppercase">{role.replace("_", " ")}</span>
        </p>
        <form action={logoutAction} className="mt-2">
          <button className="btn-secondary w-full !py-1.5 text-xs" type="submit">
            Log out
          </button>
        </form>
      </div>
    </aside>
  );
}
