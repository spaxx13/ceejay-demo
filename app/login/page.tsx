import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
  // A visitor with a still-valid session (e.g. "Remember me" from a
  // previous visit) skips straight past the form instead of being asked
  // to log in again for no reason.
  const user = await getCurrentUser();
  if (user) redirect(user.role === "technician" ? "/technician" : "/admin");

  return (
    <main className="grid-bg flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-12">
      <LoginForm />
      <Link href="/" className="text-xs text-slate-400 hover:text-slate-600">
        ← Back to home
      </Link>
    </main>
  );
}
