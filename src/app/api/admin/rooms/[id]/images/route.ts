import { readPositiveInteger } from "@/lib/api";
import { requireAdminSession } from "@/lib/supabase/auth";
import sharp from "sharp";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request, { params }: RouteContext) {
  const auth = await requireAdminSession();
  if (!auth.session) return auth.response;

  const roomId = readPositiveInteger((await params).id, "Room");
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return Response.json({ error: "Choose an image to upload." }, { status: 400 });
  }

  if (!allowedImageTypes.has(file.type) || file.size > 5 * 1024 * 1024) {
    return Response.json(
      { error: "Images must be JPG, PNG, or WebP and no larger than 5 MB." },
      { status: 400 },
    );
  }

  const { data: room, error: roomError } = await auth.session.supabase
    .from("room_types")
    .select("id, slug")
    .eq("id", roomId)
    .single();

  if (roomError || !room) {
    return Response.json({ error: "Room not found." }, { status: 404 });
  }

  const { data: currentImages, error: imageListError } = await auth.session.supabase
    .from("room_images")
    .select("id, display_order")
    .eq("room_type_id", roomId)
    .order("display_order", { ascending: false })
    .limit(1);

  if (imageListError) {
    return Response.json({ error: "Room images could not be inspected." }, { status: 500 });
  }

  const isPrimary = !currentImages?.length;
  const displayOrder = (currentImages?.[0]?.display_order ?? -1) + 1;
  let optimizedImage: Buffer;
  try {
    optimizedImage = await sharp(Buffer.from(await file.arrayBuffer()), {
      failOn: "error",
      limitInputPixels: 80_000_000,
    })
      .autoOrient()
      .resize({
        width: 1920,
        height: 1920,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({
        quality: 78,
        effort: 4,
        smartSubsample: true,
      })
      .toBuffer();
  } catch (error) {
    console.error("Room image optimization failed", error);
    return Response.json(
      { error: "The uploaded file is not a valid JPG, PNG, or WebP image." },
      { status: 400 },
    );
  }

  const storagePath = `${room.slug}/${crypto.randomUUID()}.webp`;
  const { error: uploadError } = await auth.session.supabase.storage
    .from("room-images")
    .upload(storagePath, optimizedImage, {
      contentType: "image/webp",
      cacheControl: "31536000",
      upsert: false,
    });

  if (uploadError) {
    console.error("Room image upload failed", uploadError);
    return Response.json({ error: "Image could not be uploaded." }, { status: 500 });
  }

  const altText = typeof formData.get("altText") === "string"
    ? String(formData.get("altText")).trim().slice(0, 500)
    : room.slug;
  const { data: image, error: metadataError } = await auth.session.supabase
    .from("room_images")
    .insert({
      room_type_id: roomId,
      storage_path: storagePath,
      alt_text: altText,
      is_primary: isPrimary,
      display_order: displayOrder,
    })
    .select()
    .single();

  if (metadataError) {
    await auth.session.supabase.storage.from("room-images").remove([storagePath]);
    console.error("Room image metadata insert failed", metadataError);
    return Response.json({ error: "Image metadata could not be saved." }, { status: 500 });
  }

  return Response.json({ image }, { status: 201 });
}
