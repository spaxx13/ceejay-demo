import Link from "next/link";
import { redirect } from "next/navigation";
import { getLeads, getCustomers } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import BroadcastForm from "@/components/BroadcastForm";

export default async function CrmBroadcastPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "owner_admin") redirect("/admin/crm");

  const [leads, customers] = await Promise.all([getLeads(), getCustomers()]);
  const recipientCount = new Set(
    [...leads, ...customers].map((p) => p.email.toLowerCase().trim()).filter(Boolean)
  ).size;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/crm" className="text-xs text-slate-400 hover:text-slate-600">
          ← Back to CRM
        </Link>
        <h1 className="mt-1 text-lg font-bold text-slate-900">📣 Send Announcement</h1>
        <p className="text-sm text-slate-400">Email a promo or announcement to everyone in your CRM with an address on file.</p>
      </div>

      <BroadcastForm recipientCount={recipientCount} />
    </div>
  );
}
