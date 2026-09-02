import { errorResponse, readPositiveInteger } from "@/lib/api";
import { readRoomPayload } from "@/lib/rooms";
import { requireAdminSession } from "@/lib/supabase/auth";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: RouteContext) {
  const auth = await requireAdminSession();
  if (!auth.session) return auth.response;

  try {
    const id = readPositiveInteger((await params).id, "Room");
    const body = await request.json();
    const payload = body.deactivate === true
      ? { is_active: false }
      : body.activate === true
        ? { is_active: true }
        : readRoomPayload(body);

    const { data, error } = await auth.session.supabase
      .from("room_types")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return Response.json({ error: "Room not found." }, { status: 404 });
      }
      if (error.code === "23505") {
        return Response.json(
          { error: "A room with this slug already exists." },
          { status: 409 },
        );
      }

      console.error("Admin room update failed", error);
      return Response.json({ error: "Room could not be updated." }, { status: 500 });
    }

    return Response.json({ room: data });
  } catch (error) {
    return errorResponse(error, "Invalid room update.");
  }
}
