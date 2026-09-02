import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LegacyRoute } from "@/components/LegacyRoute";
import { getLegacyPageMeta } from "@/lib/legacy";
import { getAdminSession } from "@/lib/supabase/auth";

export const metadata: Metadata = {
  title: getLegacyPageMeta("admin-dashboard").title,
  description: "Nyakaju hotel operations dashboard",
};

export default async function AdminDashboardPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin-login");
  return <LegacyRoute pageId="admin-dashboard" />;
}
