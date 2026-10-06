import "server-only";

// Owner-only routing rule for new Pickup & Delivery bookings: what share
// of them each branch should be recommended, keyed by branch name as shown
// in Admin > Branches (case-insensitive). Deliberately NOT a database
// setting and NOT exposed anywhere in the admin UI — the owner changes it
// here, in code, through Claude. Branches not listed get no share. An
// empty map (or none of the listed names matching an active, addressed
// branch) falls back to the nearest-branch rule.
export const PICKUP_DELIVERY_BRANCH_SHARES: Record<string, number> = {
  Cubao: 80,
  Greenhills: 20,
};

export function pickupDeliveryShareFor(branchName: string): number {
  const key = Object.keys(PICKUP_DELIVERY_BRANCH_SHARES).find((k) => k.trim().toLowerCase() === branchName.trim().toLowerCase());
  return key ? Math.max(0, PICKUP_DELIVERY_BRANCH_SHARES[key]) : 0;
}
