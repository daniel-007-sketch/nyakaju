import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const supabaseUrl = process.env.SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !secretKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY are required.");
}

const supabase = createClient(supabaseUrl, secretKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const { data: rooms, error: roomsError } = await supabase
  .from("room_types")
  .select("id, slug");

if (roomsError) throw roomsError;

const roomSlugs = new Map((rooms ?? []).map((room) => [room.id, room.slug]));
const { data: images, error: imagesError } = await supabase
  .from("room_images")
  .select("id, room_type_id, storage_path")
  .order("id");

if (imagesError) throw imagesError;

const report = {
  startedAt: new Date().toISOString(),
  completedAt: "",
  bucket: "room-images",
  oldObjectsRetained: true,
  migrated: [],
  skipped: [],
};

for (const image of images ?? []) {
  if (image.storage_path.startsWith("optimized-v1/")) {
    report.skipped.push({
      id: image.id,
      path: image.storage_path,
      reason: "already optimized",
    });
    continue;
  }

  const roomSlug = roomSlugs.get(image.room_type_id) ?? "room";
  const { data: source, error: downloadError } = await supabase.storage
    .from("room-images")
    .download(image.storage_path);

  if (downloadError || !source) {
    throw new Error(`Could not download ${image.storage_path}: ${downloadError?.message ?? "unknown error"}`);
  }

  const sourceBuffer = Buffer.from(await source.arrayBuffer());
  const { data: optimizedBuffer, info } = await sharp(sourceBuffer, {
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
    .toBuffer({ resolveWithObject: true });

  const versionedPath = `optimized-v1/${roomSlug}/${image.id}-${crypto.randomUUID()}.webp`;
  const { error: uploadError } = await supabase.storage
    .from("room-images")
    .upload(versionedPath, optimizedBuffer, {
      contentType: "image/webp",
      cacheControl: "31536000",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Could not upload ${versionedPath}: ${uploadError.message}`);
  }

  const { data: updatedImage, error: updateError } = await supabase
    .from("room_images")
    .update({ storage_path: versionedPath })
    .eq("id", image.id)
    .eq("storage_path", image.storage_path)
    .select("id")
    .maybeSingle();

  if (updateError || !updatedImage) {
    await supabase.storage.from("room-images").remove([versionedPath]);
    throw new Error(
      `Could not update room image ${image.id}: ${updateError?.message ?? "the source path changed during migration"}`,
    );
  }

  report.migrated.push({
    id: image.id,
    roomSlug,
    oldPath: image.storage_path,
    newPath: versionedPath,
    oldBytes: sourceBuffer.byteLength,
    newBytes: optimizedBuffer.byteLength,
    width: info.width,
    height: info.height,
  });
  console.log(`Migrated ${image.storage_path} -> ${versionedPath}`);
}

report.completedAt = new Date().toISOString();
const reportsDirectory = path.join(process.cwd(), "reports");
await mkdir(reportsDirectory, { recursive: true });
const reportPath = path.join(reportsDirectory, "room-image-migration.json");
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

console.log(`Room image migration completed. Old objects were retained. Report: ${reportPath}`);
