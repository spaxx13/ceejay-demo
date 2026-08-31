// The shop's actual logo (public/logo.png) — wrapped in a rounded, ringed
// tile since the source file is a square opaque-white PNG and would
// otherwise show a hard-edged white box on non-white backgrounds (e.g. the
// footer's light gray).
export default function Logo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <span className={`inline-block shrink-0 overflow-hidden rounded-lg ring-1 ring-slate-200 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="Ceejay Cellphone Repair Shop" className="h-full w-full object-cover" />
    </span>
  );
}
