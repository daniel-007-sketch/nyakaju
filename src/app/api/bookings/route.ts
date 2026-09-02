import {
  errorResponse,
  isIsoDate,
  readNonEmptyString,
  readPositiveInteger,
  todayIsoDate,
} from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
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

    if (
      !isIsoDate(arrival)
      || !isIsoDate(departure)
      || departure <= arrival
      || arrival < todayIsoDate()
    ) {
      throw new Error("Choose a valid arrival date and a later departure date.");
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("create_booking_request", {
      p_room_type_id: roomTypeId,
      p_guest_first_name: firstName,
      p_guest_last_name: lastName,
      p_guest_email: email,
      p_guest_phone: phone,
      p_arrival_date: arrival,
      p_departure_date: departure,
      p_room_count: roomCount,
    });

    if (error) {
      if (error.message.includes("ROOM_SOLD_OUT")) {
        return Response.json(
          { error: "This room type sold out for the selected dates." },
          { status: 409 },
        );
      }

      if (error.message.includes("ROOM_NOT_AVAILABLE")) {
        return Response.json(
          { error: "This room type is no longer available." },
          { status: 404 },
        );
      }

      if (
        error.message.includes("INVALID_STAY_DATES")
        || error.message.includes("INVALID_GUEST_DETAILS")
        || error.message.includes("INVALID_ROOM_COUNT")
      ) {
        return Response.json(
          { error: "The booking details are invalid." },
          { status: 400 },
        );
      }

      console.error("Booking RPC failed", error);
      return Response.json(
        { error: "The booking request could not be submitted." },
        { status: 500 },
      );
    }

    const booking = data?.[0];
    if (!booking) {
      return Response.json(
        { error: "The booking request returned no confirmation." },
        { status: 500 },
      );
    }

    return Response.json(
      {
        confirmationCode: booking.booking_confirmation_code,
        status: booking.booking_status,
        nightlyRate: booking.booked_nightly_rate,
        totalAmount: booking.booking_total_amount,
        currency: booking.booking_currency,
        remainingUnits: booking.remaining_units,
      },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error, "Invalid booking request.");
  }
}
