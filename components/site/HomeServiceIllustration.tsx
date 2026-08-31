// Minimalist line-art scene of a technician arriving at a customer's home —
// same flat, iconographic treatment as InShopIllustration for a matched
// pair, since no photography/image-generation tool is available.
export default function HomeServiceIllustration({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 300" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Technician arriving at a customer's home with a repair toolkit">
      <rect width="400" height="300" rx="20" fill="#F5F5F7" />

      {/* location pin above the house */}
      <path d="M262 40 c0 16 -18 30 -18 46 c0 -16 -18 -30 -18 -46 a18 18 0 1 1 36 0 z" fill="#0071E3" opacity="0.9" />
      <circle cx="244" cy="40" r="6" fill="#FFFFFF" />

      {/* house */}
      <path d="M140 150 L210 100 L280 150 V220 a6 6 0 0 1 -6 6 H146 a6 6 0 0 1 -6 -6 Z" fill="#FFFFFF" stroke="#1D1D1F" strokeWidth="3" />
      <path d="M126 158 L210 96 L294 158" stroke="#1D1D1F" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="196" y="180" width="28" height="46" rx="2" fill="#D2D2D7" />
      <circle cx="216" cy="203" r="1.6" fill="#1D1D1F" />
      <rect x="150" y="168" width="26" height="22" rx="2" fill="#0071E3" opacity="0.15" stroke="#0071E3" strokeWidth="2" />

      {/* technician approaching with toolkit */}
      <circle cx="330" cy="176" r="14" fill="#1D1D1F" />
      <path d="M306 226 q0 -40 24 -40 q24 0 24 40 z" fill="#0071E3" />
      <rect x="298" y="206" width="22" height="16" rx="3" fill="#1D1D1F" />
      <rect x="304" y="200" width="10" height="8" rx="2" fill="#1D1D1F" />
      <line x1="298" y1="214" x2="320" y2="214" stroke="#0071E3" strokeWidth="2" />

      {/* ground line */}
      <line x1="40" y1="232" x2="360" y2="232" stroke="#D2D2D7" strokeWidth="2" />
    </svg>
  );
}
