import Link from "next/link";
import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <main className="grid-bg flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-12">
      <LoginForm />
      <Link href="/" className="text-xs text-slate-400 hover:text-slate-600">
        ← Back to home
      </Link>
    </main>
  );
}
