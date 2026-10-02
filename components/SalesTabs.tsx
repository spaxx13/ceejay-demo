import { getCurrentUser } from "@/lib/auth";
import { canManagePickupDelivery } from "@/lib/db";
import SalesTabsClient from "./SalesTabsClient";

// Server wrapper so every Sales page keeps rendering `<SalesTabs />` while
// the Pickup & Delivery tab is hidden from accounts without that section
// (the page itself also redirects — this just keeps the tab honest).
export default async function SalesTabs() {
  const user = await getCurrentUser();
  return <SalesTabsClient canManagePickupDelivery={canManagePickupDelivery(user)} />;
}
