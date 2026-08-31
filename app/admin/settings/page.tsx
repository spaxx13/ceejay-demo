import Link from "next/link";
import { redirect } from "next/navigation";
import { store } from "@/lib/store";
import { requireRole } from "@/lib/auth";

const GROUPS = [
  {
    label: "Business Setup",
    description: "The people and places behind every job — who covers what, and where customers can find you.",
    cards: [
      { href: "/admin/branches", title: "Branches", description: "Physical locations, addresses, and contact numbers." },
      { href: "/admin/zones", title: "Zones", description: "Service areas used to auto-route home service requests." },
      { href: "/admin/technicians", title: "Technicians", description: "Staff, their branch(es), and the zones they cover." },
    ],
  },
  {
    label: "Access",
    description: "Who can log in, and what they can do once they're in.",
    cards: [{ href: "/admin/users", title: "Staff Accounts", description: "Create logins for owner admins, branch admins, and technicians." }],
  },
  {
    label: "Catalog & Workflow",
    description: "The dropdown options and status lists used across requests, CRM, and the public forms.",
    cards: [
      { href: "/admin/device-catalog", title: "Device Catalog", description: "Brands and models customers can select when booking." },
      { href: "/admin/service-types", title: "Service Types", description: "Repair categories and lead/customer source options." },
      { href: "/admin/statuses", title: "Statuses", description: "Lead and home service request status lists, in display order." },
    ],
  },
  {
    label: "Public Site Content",
    description: "Copy shown to customers before they ever log in — safe to edit without touching code.",
    cards: [
      { href: "/admin/site-content", title: "Landing Page", description: "Hero headline, how-it-works steps, and CTA banner." },
      { href: "/admin/request-form", title: "Request Form", description: "Page header, every field's label/placeholder, and confirmation copy." },
    ],
  },
];

function countFor(href: string) {
  switch (href) {
    case "/admin/branches":
      return store.branches.filter((b) => b.active).length;
    case "/admin/zones":
      return store.zones.filter((z) => z.active).length;
    case "/admin/technicians":
      return store.technicians.filter((t) => t.active).length;
    case "/admin/device-catalog":
      return store.lookups.filter((l) => l.kind === "device_brand" && l.active).length;
    case "/admin/service-types":
      return store.lookups.filter((l) => l.kind === "service_type" && l.active).length;
    case "/admin/statuses":
      return store.lookups.filter((l) => (l.kind === "lead_status" || l.kind === "request_status") && l.active).length;
    case "/admin/users":
      return store.users.filter((u) => u.active).length;
    default:
      return null;
  }
}

export default async function SettingsHubPage() {
  if (!(await requireRole("owner_admin"))) redirect("/admin");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-400">
          Everything configurable in Ceejay lives here — no hardcoded lists. Adding a new feature usually means one new card in this hub.
        </p>
      </div>

      {GROUPS.map((group) => (
        <section key={group.label} className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">{group.label}</h2>
            <p className="text-xs text-slate-400">{group.description}</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {group.cards.map((card) => {
              const count = countFor(card.href);
              return (
                <Link key={card.href} href={card.href} className="card block hover:border-blue-300">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-slate-800">{card.title}</p>
                    {count !== null && <span className="badge border border-slate-200 bg-slate-50 text-slate-500">{count}</span>}
                  </div>
                  <p className="mt-1 text-sm text-slate-400">{card.description}</p>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
