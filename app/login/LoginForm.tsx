"use client";

import { useActionState } from "react";
import { loginAction } from "@/lib/actions";
import Logo from "@/components/Logo";

export default function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, undefined);

  return (
    <form action={formAction} className="card w-full max-w-sm space-y-4">
      <div className="flex items-center gap-3">
        <Logo className="h-10 w-10 shrink-0" />
        <div>
          <h1 className="text-lg font-semibold text-slate-800">Staff Login</h1>
          <p className="mt-0.5 text-sm text-slate-400">Ceejay Cellphone Repair Shop</p>
        </div>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-slate-500">Email</label>
        <input name="email" type="email" required className="input" placeholder="admin@ceejay.ph" />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-slate-500">Password</label>
        <input name="password" type="password" required className="input" placeholder="••••••••" />
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
