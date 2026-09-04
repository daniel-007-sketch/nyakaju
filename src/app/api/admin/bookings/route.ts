import {
  errorResponse,
  isIsoDate,
  readNonEmptyString,
  readPositiveInteger,
  todayIsoDate,
} from "@/lib/api";
import { BOOKING_STATUSES } from "@/lib/booking-status";
import { requireAdminSession } from "@/lib/supabase/auth";

export async function POST(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.session) return auth.response;

  try {
    const body = await request.json();
    const roomTypeId = readPositiveInteger(body.roomTypeId, "Room");
    const roomCount = readPositiveInteger(body.roomCount, "Number of rooms");
    const firstName = readNonEmptyString(body.firstName, "First name", 100);
    const lastName = readNonEmptyString(body.lastName, "Last name", 100);
    const email = readNonEmptyString(body.email, "Email", 320).toLowerCase();
    const phone = readNonEmptyString(body.phone, "Phone", 50);
    const arrival = body.arrival;
    const departure = body.departure;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Enter a valid email address.");
    }
    if (!isIsoDate(arrival) || !isIsoDate(departure) || departure <= arrival || arrival < todayIsoDate()) {
      throw new Error("Choose a valid arrival date and a later departure date.");
    }

    const { data: room, error: roomError } = await auth.session.supabase
      .from("room_types")
      .select("id, nightly_rate, currency, total_units")
      .eq("id", roomTypeId)
      .eq("is_active", true)
      .single();
    if (roomError || !room) {
      return Response.json({ error: "Choose an active room type." }, { status: 404 });
    }
    if (roomCount > room.total_units) {
      return Response.json(
        { error: `This room package allows a maximum of ${room.total_units} rooms.` },
        { status: 400 },
      );
    }

    const { data: overlappingBookings, error: availabilityError } = await auth.session.supabase
      .from("bookings")
      .select("room_count")
      .eq("room_type_id", roomTypeId)
      .eq("status", "confirmed")
      .lt("arrival_date", departure)
      .gt("departure_date", arrival);
    if (availabilityError) {
      console.error("Admin booking availability check failed", availabilityError);
      return Response.json({ error: "Room availability could not be checked." }, { status: 500 });
    }
    const reservedUnits = (overlappingBookings ?? []).reduce(
      (total, booking) => total + booking.room_count,
      0,
    );
    const availableUnits = Math.max(room.total_units - reservedUnits, 0);
    if (roomCount > availableUnits) {
      return Response.json(
        { error: `Only ${availableUnits} room${availableUnits === 1 ? " is" : "s are"} available for those dates.` },
        { status: 409 },
      );
    }

    const nights = Math.round(
      (Date.parse(`${departure}T00:00:00Z`) - Date.parse(`${arrival}T00:00:00Z`)) / 86_400_000,
    );
    const confirmationCode = `NYK-${crypto.randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`;
    const { data: booking, error } = await auth.session.supabase
      .from("bookings")
      .insert({
        confirmation_code: confirmationCode,
        room_type_id: roomTypeId,
        guest_first_name: firstName,
        guest_last_name: lastName,
        guest_email: email,
        guest_phone: phone,
        arrival_date: arrival,
        departure_date: departure,
        room_count: roomCount,
        status: "pending",
        nightly_rate: room.nightly_rate,
        total_amount: Number(room.nightly_rate) * nights * roomCount,
        currency: room.currency,
      })
      .select("*, room_types(name, slug)")
      .single();

    if (error) {
      if (error.message.includes("ROOM_SOLD_OUT")) {
        return Response.json(
          { error: "There are not enough available rooms for those dates." },
          { status: 409 },
        );
      }
      console.error("Admin booking creation failed", error);
      return Response.json({ error: "The booking could not be created." }, { status: 500 });
    }

    return Response.json({ booking }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "Invalid booking details.");
  }
}

export async function GET(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.session) return auth.response;

  const url = new URL(request.url);
  const search = (url.searchParams.get("search") ?? "").trim().toLowerCase();
  const status = (url.searchParams.get("status") ?? "").trim().toLowerCase();

  const validStatus = status && BOOKING_STATUSES.includes(status as (typeof BOOKING_STATUSES)[number]);
  const data = [];
  const pageSize = 1_000;

  // PostgREST responses are capped by the project's API row limit. Fetch in
  // deterministic pages so the dashboard never silently drops older records.
  for (let from = 0; ; from += pageSize) {
    let query = auth.session.supabase
      .from("bookings")
      .select("*, room_types(name, slug)")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + pageSize - 1);

    if (validStatus) query = query.eq("status", status);
    const result = await query;
    if (result.error) {
      console.error("Admin booking list failed", result.error);
      return Response.json({ error: "Bookings could not be loaded." }, { status: 500 });
    }
    data.push(...(result.data ?? []));
    if ((result.data?.length ?? 0) < pageSize) break;
  }

  const bookings = search
    ? data.filter((booking) => {
      const haystack = [
        booking.confirmation_code,
        booking.guest_first_name,
        booking.guest_last_name,
        booking.guest_email,
        booking.guest_phone,
        booking.room_types?.name,
      ].join(" ").toLowerCase();
      return haystack.includes(search);
    })
    : data;

  return Response.json({ bookings, total: bookings.length });
}
