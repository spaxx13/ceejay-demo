import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getStaffChatMessages } from "@/lib/db";
import StaffChatView from "@/components/StaffChatView";

export default async function StaffChatPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const messages = await getStaffChatMessages();

  return <StaffChatView initial={messages} currentUserId={user.id} />;
}
