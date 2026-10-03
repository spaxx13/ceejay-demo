import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { canViewBranchSales } from "@/lib/db";

// One gate for every Sales tab: an account without "Can access Branch
// Sales" (Settings > Staff Accounts) is bounced to the dashboard, whichever
// tab's URL it tries.
export default async function SalesLayout({ children }: { children: React.ReactNode }) {
  if (!canViewBranchSales(await getCurrentUser())) redirect("/admin");
  return <>{children}</>;
}
