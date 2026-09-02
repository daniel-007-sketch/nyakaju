import { requireAdminSession } from "@/lib/supabase/auth";

export async function GET() {
  const auth = await requireAdminSession();
  if (!auth.session) return auth.response;

  const { data, error } = await auth.session.supabase
    .from("room_types")
    .select("*, room_images(*)")
    .order("display_order")
    .order("id");

  if (error) {
    console.error("Admin room list failed", error);
    return Response.json({ error: "Rooms could not be loaded." }, { status: 500 });
  }

  return Response.json({ rooms: data ?? [] });
}
