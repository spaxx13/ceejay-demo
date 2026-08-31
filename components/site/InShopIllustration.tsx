// Minimalist line-art scene of an in-branch repair counter — Apple-store
// inspired (pendant light, clean bench) rather than a literal photo, since
// no photography or image-generation tool is available. Flat shapes only,
// site's own blue/slate palette.
export default function InShopIllustration({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 300" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Technician repairing a phone at an in-branch counter">
      <rect width="400" height="300" rx="20" fill="#F5F5F7" />

      {/* pendant light */}
      <line x1="150" y1="0" x2="150" y2="60" stroke="#D2D2D7" strokeWidth="2" />
      <path d="M130 60 h40 l10 24 h-60 z" fill="#1D1D1F" />
      <ellipse cx="150" cy="86" rx="34" ry="6" fill="#0071E3" opacity="0.12" />

      {/* counter */}
      <rect x="40" y="210" width="320" height="14" rx="4" fill="#1D1D1F" />
      <rect x="54" y="224" width="18" height="50" fill="#D2D2D7" />
      <rect x="328" y="224" width="18" height="50" fill="#D2D2D7" />

      {/* phone on counter, screen open */}
      <rect x="150" y="176" width="46" height="30" rx="4" fill="#FFFFFF" stroke="#1D1D1F" strokeWidth="2.5" />
      <line x1="158" y1="184" x2="188" y2="184" stroke="#0071E3" strokeWidth="2" />
      <line x1="158" y1="192" x2="180" y2="192" stroke="#D2D2D7" strokeWidth="2" />

      {/* screwdriver */}
      <g transform="rotate(-25 224 190)">
        <rect x="214" y="176" width="6" height="34" rx="3" fill="#0071E3" />
        <rect x="211" y="168" width="12" height="14" rx="2" fill="#1D1D1F" />
      </g>

      {/* small parts tray */}
      <rect x="250" y="196" width="46" height="14" rx="3" fill="#FFFFFF" stroke="#D2D2D7" strokeWidth="2" />
      <circle cx="260" cy="203" r="3" fill="#0071E3" />
      <circle cx="272" cy="203" r="3" fill="#D2D2D7" />
      <circle cx="284" cy="203" r="3" fill="#D2D2D7" />

      {/* technician torso, leaning over counter */}
      <circle cx="112" cy="150" r="16" fill="#1D1D1F" />
      <path d="M84 210 q0 -46 28 -46 q28 0 28 46 z" fill="#0071E3" />
      <path d="M108 176 q10 14 24 4" stroke="#FFFFFF" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}
