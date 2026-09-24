import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentCustomer } from "@/lib/customerAuth";
import CustomerLoginForm from "@/components/CustomerLoginForm";

export default async function CustomerLoginPage() {
  const customer = await getCurrentCustomer();
  if (customer) redirect("/my");

  return (
    <main className="grid-bg flex min-h-screen flex-col items-center justify-center px-4 py-10 sm:px-6">
      <div className="mx-auto w-full max-w-sm space-y-6">
        <Link href="/app-home" className="inline-block text-sm text-slate-400 hover:underline">
          ← Back
        </Link>
        <div className="text-center">
          <p className="kicker">Ceejay Account</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Sign In</h1>
          <p className="mt-2 text-sm text-slate-400">Track your repairs and see your rider or technician live on the map.</p>
        </div>
        <CustomerLoginForm />
      </div>
    </main>
  );
}
