import Link from "next/link";
import { store } from "@/lib/store";
import Logo from "@/components/Logo";

export default function SiteFooter() {
  const branches = store.branches.filter((b) => b.active);

  return (
    <footer className="border-t border-slate-200 bg-slate-50">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 py-10 sm:px-6 md:grid-cols-3">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <Logo className="h-7 w-7 shrink-0" />
            <p className="text-sm font-bold brand-gradient-text">Ceejay Cellphone Repair Shop</p>
          </div>
          <p className="text-sm text-slate-400">
            Apple specialists and multi-brand device repair — in-branch or at your doorstep.
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Branches</p>
          <ul className="space-y-1.5 text-sm text-slate-400">
            {branches.map((b) => (
              <li key={b.id}>
                <p className="text-slate-600">{b.name}</p>
                <p>{b.contactNumber}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Quick Links</p>
          <ul className="space-y-1.5 text-sm text-slate-400">
            <li><Link href="/services" className="hover:text-slate-700">Services</Link></li>
            <li><Link href="/branches" className="hover:text-slate-700">Branch Locations</Link></li>
            <li><Link href="/request" className="hover:text-slate-700">Book Home Service</Link></li>
            <li><Link href="/contact" className="hover:text-slate-700">Contact Us</Link></li>
            <li><Link href="/login" className="hover:text-slate-700">Staff Login</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-slate-200 px-4 py-4 text-center text-xs text-slate-400 sm:px-6">
        © {new Date().getFullYear()} Ceejay Cellphone Repair Shop. All rights reserved.
      </div>
    </footer>
  );
}
