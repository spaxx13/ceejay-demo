import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { logoutAction } from "@/lib/actions";
import Logo from "@/components/Logo";

// Standalone shell for the one shared staff chat room — reachable by all
// four staff roles, so it can't live under /admin, /technician, or /rider
// (each of those layouts redirects away the roles that aren't theirs).
export default async function StaffChatLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const backHref = user.role === "technician" ? "/technician" : user.role === "rider" ? "/rider" : "/admin";

  return (
    <div className="flex min-h-screen flex-col">
      <div className="glass sticky top-0 z-10 print:hidden" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Link href={backHref} className="flex items-center gap-2">
            <Logo className="h-7 w-7 shrink-0" />
            <span className="text-sm font-bold brand-gradient-text">Ceejay · Staff Chat</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">{user.name}</span>
            <form action={logoutAction}>
              <button className="btn-secondary !px-3 !py-1.5 text-xs" type="submit">
                Log out
              </button>
            </form>
          </div>
        </div>
      </div>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-4 print:p-0">{children}</main>
    </div>
  );
}
