const PALETTE = [
  "border-blue-200 bg-blue-50 text-blue-300",
  "border-amber-200 bg-amber-50 text-amber-700",
  "border-green-200 bg-green-50 text-green-700",
  "border-red-200 bg-red-50 text-red-700",
  "border-indigo-100 bg-indigo-100 text-indigo-700",
];

function hashColor(label: string) {
  let h = 0;
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) % PALETTE.length;
  return PALETTE[h];
}

export default function StatusBadge({ label }: { label: string }) {
  return <span className={`badge border ${hashColor(label)}`}>{label}</span>;
}
