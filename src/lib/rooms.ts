import {
  readNonEmptyString,
  readPositiveInteger,
  readPositiveMoney,
} from "@/lib/api";

export function readRoomPayload(body: Record<string, unknown>) {
  const name = readNonEmptyString(body.name, "Room name", 120);
  const slug = readNonEmptyString(body.slug, "Room slug", 120).toLowerCase();

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error("Room slug may contain lowercase letters, numbers, and hyphens.");
  }

  return {
    name,
    slug,
    description: typeof body.description === "string"
      ? body.description.trim().slice(0, 2_000)
      : "",
    nightly_rate: readPositiveMoney(body.nightlyRate, "Nightly rate"),
    currency: "USD",
    total_units: readPositiveInteger(body.totalUnits, "Total units"),
    beds: readPositiveInteger(body.beds, "Beds"),
    bathrooms: readPositiveInteger(body.bathrooms, "Bathrooms"),
    display_order: typeof body.displayOrder === "number"
      ? Math.trunc(body.displayOrder)
      : 0,
    is_active: body.isActive !== false,
  };
}
