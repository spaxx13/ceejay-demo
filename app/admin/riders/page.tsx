import { redirect } from "next/navigation";
import { getRiders, getBranches } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import SettingsTabs from "@/components/SettingsTabs";
import RiderManager from "@/components/RiderManager";

export default async function RidersPage() {
  if (!(await requireRole("owner_admin"))) redirect("/admin");

  const [allRiders, allBranches] = await Promise.all([getRiders(), getBranches()]);
  const riders = allRiders.map((r) => ({
    id: r.id,
    name: r.name,
    contactNumber: r.contactNumber,
    email: r.email,
    branchId: r.branchId,
    vehicle: r.vehicle,
    active: r.active,
    onDuty: r.onDuty,
  }));
  const branches = allBranches.filter((b) => b.active).map((b) => ({ id: b.id, name: b.name }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Riders</h1>
        <p className="mt-1 text-sm text-slate-400">
          Couriers for Pickup &amp; Delivery — a separate role from Technicians. Riders only handle the pickup/delivery legs, never the
          repair itself, and can be assigned to any branch&apos;s request.
        </p>
      </div>
      <SettingsTabs />
      <RiderManager riders={riders} branches={branches} />
    </div>
  );
}
