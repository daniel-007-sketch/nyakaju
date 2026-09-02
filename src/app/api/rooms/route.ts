import { isIsoDate, todayIsoDate } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestedArrival = url.searchParams.get("arrival");
  const requestedDeparture = url.searchParams.get("departure");
  const hasRequestedDates = Boolean(requestedArrival || requestedDeparture);
  const today = todayIsoDate();
  const arrival = hasRequestedDates ? requestedArrival : today;
  const departure = hasRequestedDates ? requestedDeparture : addDays(today, 1);

  if (
    !isIsoDate(arrival)
    || !isIsoDate(departure)
    || departure <= arrival
    || arrival < today
  ) {
    return Response.json(
      { error: "Choose a valid arrival date and a later departure date." },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const [{ data: rooms, error: roomsError }, { data: availability, error: availabilityError }] =
    await Promise.all([
      supabase
        .from("room_types")
        .select("*, room_images(*)")
        .eq("is_active", true)
        .order("display_order")
        .order("id"),
      supabase.rpc("get_room_availability", {
        p_arrival_date: arrival,
        p_departure_date: departure,
      }),
    ]);

  if (roomsError || availabilityError) {
    console.error("Failed to load rooms", roomsError ?? availabilityError);
    return Response.json(
      { error: "Rooms could not be loaded right now." },
      { status: 500 },
    );
  }

  const availabilityByRoom = new Map(
    (availability ?? []).map((item) => [item.room_type_id, item]),
  );

  return Response.json({
    arrival,
    departure,
    rooms: (rooms ?? []).map((room) => ({
      id: room.id,
      slug: room.slug,
      name: room.name,
      description: room.description,
      nightlyRate: room.nightly_rate,
      currency: room.currency,
      totalUnits: room.total_units,
      availableUnits: availabilityByRoom.get(room.id)?.available_units ?? room.total_units,
      reservedUnits: availabilityByRoom.get(room.id)?.reserved_units ?? 0,
      beds: room.beds,
      bathrooms: room.bathrooms,
      displayOrder: room.display_order,
      images: [...room.room_images]
        .sort((left, right) => left.display_order - right.display_order || left.id - right.id)
        .map((image) => ({
          id: image.id,
          path: image.storage_path,
          alt: image.alt_text,
          isPrimary: image.is_primary,
          displayOrder: image.display_order,
          url: supabase.storage
            .from("room-images")
            .getPublicUrl(image.storage_path).data.publicUrl,
        })),
    })),
  });
}
