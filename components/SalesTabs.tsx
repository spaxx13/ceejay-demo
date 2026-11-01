import { getCurrentUser } from "@/lib/auth";
import { canManagePickupDelivery, canManageCourier } from "@/lib/db";
import SalesTabsClient from "./SalesTabsClient";

// Server wrapper so every Sales page keeps rendering `<SalesTabs />` while
// the Pickup & Delivery / Courier Service tabs are hidden from accounts
// without that section (the page itself also redirects — this just keeps
// the tab honest).
export default async function SalesTabs() {
  const user = await getCurrentUser();
  return (
    <SalesTabsClient
      canManagePickupDelivery={canManagePickupDelivery(user)}
      canManageCourier={canManageCourier(user)}
      isOwnerAdmin={user?.role === "owner_admin"}
    />
  );
}
