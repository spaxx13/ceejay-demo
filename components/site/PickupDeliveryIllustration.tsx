// Minimalist line-art scene of a rider shuttling a device between a
// customer's home and a branch — same flat, iconographic treatment as
// InShopIllustration/HomeServiceIllustration for a matched trio, since no
// photography/image-generation tool is available.
export default function PickupDeliveryIllustration({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 300"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="A rider carrying a device between a customer's home and a branch"
    >
      <rect width="400" height="300" rx="20" fill="#F5F5F7" />

      {/* house, left */}
      <path d="M40 160 L82 128 L124 160 V208 a5 5 0 0 1 -5 5 H45 a5 5 0 0 1 -5 -5 Z" fill="#FFFFFF" stroke="#1D1D1F" strokeWidth="3" />
      <path d="M30 166 L82 126 L134 166" stroke="#1D1D1F" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="70" y="182" width="24" height="31" rx="2" fill="#D2D2D7" />

      {/* branch, right */}
      <rect x="296" y="150" width="70" height="63" rx="4" fill="#FFFFFF" stroke="#1D1D1F" strokeWidth="3" />
      <rect x="296" y="150" width="70" height="16" rx="4" fill="#0071E3" opacity="0.9" />
      <rect x="312" y="180" width="38" height="33" rx="2" fill="#0071E3" opacity="0.15" stroke="#0071E3" strokeWidth="2" />

      {/* dashed transit path */}
      <path d="M128 196 Q 210 150 294 190" stroke="#D2D2D7" strokeWidth="2.5" strokeDasharray="2 8" strokeLinecap="round" fill="none" />

      {/* rider on scooter, mid-route, carrying the device */}
      <g>
        <circle cx="206" cy="150" r="6" fill="#D2D2D7" />
        <circle cx="236" cy="150" r="6" fill="#D2D2D7" />
        <path d="M206 150 h30" stroke="#1D1D1F" strokeWidth="3" strokeLinecap="round" />
        <path d="M230 150 l8 -22 h14" stroke="#1D1D1F" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <rect x="246" y="116" width="16" height="12" rx="2" fill="#1D1D1F" />
        {/* rider torso + helmet */}
        <circle cx="222" cy="112" r="10" fill="#1D1D1F" />
        <path d="M206 142 q0 -26 16 -26 q16 0 16 26 z" fill="#0071E3" />
        {/* device parcel on the back */}
        <rect x="188" y="118" width="18" height="18" rx="3" fill="#FFFFFF" stroke="#0071E3" strokeWidth="2" />
        <path d="M192 127 h10" stroke="#0071E3" strokeWidth="1.5" strokeLinecap="round" />
      </g>

      {/* ground line */}
      <line x1="30" y1="222" x2="370" y2="222" stroke="#D2D2D7" strokeWidth="2" />
    </svg>
  );
}
