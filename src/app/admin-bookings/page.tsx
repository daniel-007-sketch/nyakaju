import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/supabase/auth";
import { AdminBookings } from "./AdminBookings";

export const metadata: Metadata = {
  title: "Bookings | Nyakaju Admin",
  description: "Review and manage Nyakaju booking records.",
};

export default async function AdminBookingsPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin-login");

  return <AdminBookings />;
}
