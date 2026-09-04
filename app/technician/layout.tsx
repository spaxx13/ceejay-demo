import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { logoutAction } from "@/lib/actions";
import Logo from "@/components/Logo";

export default async function TechnicianLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "technician") redirect("/admin");

  return (
    <div className="min-h-screen">
      <div className="glass sticky top-0 z-10 print:hidden">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <span className="flex items-center gap-2">
            <Logo className="h-7 w-7 shrink-0" />
            <span className="text-sm font-bold brand-gradient-text">Ceejay · Technician</span>
          </span>
          <div className="flex items-center gap-3">
            <Link href="/technician" className="text-xs font-medium text-slate-500 hover:text-slate-800">
              My Jobs
            </Link>
            <Link href="/technician/earnings" className="text-xs font-medium text-slate-500 hover:text-slate-800">
              My Earnings
            </Link>
            <Link href="/technician/panic-log" className="text-xs font-medium text-slate-500 hover:text-slate-800">
              Panic Log
            </Link>
            <span className="text-xs text-slate-400">{user.name}</span>
            <form action={logoutAction}>
              <button className="btn-secondary !px-3 !py-1.5 text-xs" type="submit">
                Log out
              </button>
            </form>
          </div>
        </div>
      </div>
      <main className="mx-auto max-w-2xl px-4 py-6 print:p-0">{children}</main>
    </div>
  );
}
