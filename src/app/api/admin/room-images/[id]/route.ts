import { readPositiveInteger } from "@/lib/api";
import { requireAdminSession } from "@/lib/supabase/auth";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_request: Request, { params }: RouteContext) {
  const auth = await requireAdminSession();
  if (!auth.session) return auth.response;
  const id = readPositiveInteger((await params).id, "Image");

  const { data: image, error: imageError } = await auth.session.supabase
    .from("room_images")
    .select("*")
    .eq("id", id)
    .single();

  if (imageError || !image) {
    return Response.json({ error: "Image not found." }, { status: 404 });
  }

  const { error: storageError } = await auth.session.supabase.storage
    .from("room-images")
    .remove([image.storage_path]);
  if (storageError) {
    console.error("Room image object delete failed", storageError);
    return Response.json({ error: "Image could not be deleted." }, { status: 500 });
  }

  const { error: metadataError } = await auth.session.supabase
    .from("room_images")
    .delete()
    .eq("id", id);
  if (metadataError) {
    return Response.json({ error: "Image metadata could not be deleted." }, { status: 500 });
  }

  if (image.is_primary) {
    const { data: replacement } = await auth.session.supabase
      .from("room_images")
      .select("id")
      .eq("room_type_id", image.room_type_id)
      .order("display_order")
      .limit(1)
      .maybeSingle();

    if (replacement) {
      await auth.session.supabase
        .from("room_images")
        .update({ is_primary: true })
        .eq("id", replacement.id);
    }
  }

  return Response.json({ ok: true });
}
