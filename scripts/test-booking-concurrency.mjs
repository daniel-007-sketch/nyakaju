import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
if (!url || !secretKey) throw new Error("Supabase environment variables are required.");

const supabase = createClient(url, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const slug = `concurrency-test-${Date.now()}`;
let roomId;

function isoDaysFromNow(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function bookingArgs(arrival, departure, suffix, roomCount = 2) {
  return {
    p_room_type_id: roomId,
    p_guest_first_name: "Concurrency",
    p_guest_last_name: `Test ${suffix}`,
    p_guest_email: `concurrency-${suffix}@example.com`,
    p_guest_phone: "+10000000000",
    p_arrival_date: arrival,
    p_departure_date: departure,
    p_room_count: roomCount,
  };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function confirmBooking(confirmationCode) {
  return supabase
    .from("bookings")
    .update({ status: "confirmed" })
    .eq("confirmation_code", confirmationCode)
    .select("confirmation_code, confirmed_at, room_count, total_amount")
    .single();
}

try {
  const { data: room, error: roomError } = await supabase
    .from("room_types")
    .insert({
      slug,
      name: "Concurrency Test Room",
      description: "Temporary automated test room.",
      nightly_rate: 1,
      total_units: 3,
      beds: 1,
      bathrooms: 1,
      is_active: true,
      display_order: 9999,
    })
    .select("id")
    .single();
  if (roomError) throw roomError;
  roomId = room.id;

  const arrival = isoDaysFromNow(10);
  const departure = isoDaysFromNow(12);
  const simultaneous = await Promise.all([
    supabase.rpc("create_booking_request", bookingArgs(arrival, departure, "a")),
    supabase.rpc("create_booking_request", bookingArgs(arrival, departure, "b")),
  ]);
  assert(simultaneous.every((result) => !result.error), "Pending requests must not reserve inventory.");
  const pendingCodes = simultaneous.map((result) => result.data[0].booking_confirmation_code);
  const confirmations = await Promise.all(pendingCodes.map(confirmBooking));
  const confirmed = confirmations.filter((result) => !result.error);
  const soldOut = confirmations.filter((result) => result.error?.message.includes("ROOM_SOLD_OUT"));
  assert(confirmed.length === 1, "Exactly one simultaneous grouped confirmation must succeed.");
  assert(soldOut.length === 1, "A grouped confirmation exceeding remaining capacity must be sold out.");
  assert(confirmed[0].data.confirmed_at, "Confirmation must record when earnings were recognized.");
  assert(confirmed[0].data.room_count === 2, "The grouped room quantity must be stored on the booking.");
  assert(Number(confirmed[0].data.total_amount) === 4, "Confirmed earnings must include every room in the group.");

  const availability = await supabase.rpc("get_room_availability", {
    p_arrival_date: arrival,
    p_departure_date: departure,
  });
  if (availability.error) throw availability.error;
  const testRoomAvailability = availability.data.find((room) => room.room_type_id === roomId);
  assert(testRoomAvailability?.reserved_units === 2, "A grouped booking must reserve its full room quantity.");
  assert(testRoomAvailability?.available_units === 1, "Availability must subtract the grouped room quantity.");

  const oversizedRequest = await supabase.rpc(
    "create_booking_request",
    bookingArgs(arrival, departure, "oversized", 2),
  );
  assert(oversizedRequest.error?.message.includes("ROOM_SOLD_OUT"), "A request larger than live availability must fail.");

  const backToBack = await supabase.rpc(
    "create_booking_request",
    bookingArgs(departure, isoDaysFromNow(13), "back-to-back", 3),
  );
  assert(!backToBack.error, "A back-to-back stay should be allowed.");
  const backToBackConfirmation = await confirmBooking(backToBack.data[0].booking_confirmation_code);
  assert(!backToBackConfirmation.error, "A back-to-back stay should be confirmable.");

  const nonOverlapping = await supabase.rpc(
    "create_booking_request",
    bookingArgs(isoDaysFromNow(20), isoDaysFromNow(21), "non-overlap", 3),
  );
  assert(!nonOverlapping.error, "A non-overlapping stay should be allowed.");
  const nonOverlappingConfirmation = await confirmBooking(nonOverlapping.data[0].booking_confirmation_code);
  assert(!nonOverlappingConfirmation.error, "A non-overlapping stay should be confirmable.");

  const invalid = await supabase.rpc(
    "create_booking_request",
    bookingArgs(arrival, arrival, "invalid"),
  );
  assert(invalid.error?.message.includes("INVALID_STAY_DATES"), "Same-day departure must fail.");

  const invalidRoomCount = await supabase.rpc(
    "create_booking_request",
    bookingArgs(isoDaysFromNow(15), isoDaysFromNow(16), "invalid-count", 0),
  );
  assert(invalidRoomCount.error?.message.includes("INVALID_ROOM_COUNT"), "Zero rooms must fail.");

  const past = await supabase.rpc(
    "create_booking_request",
    bookingArgs(isoDaysFromNow(-2), isoDaysFromNow(-1), "past"),
  );
  assert(past.error?.message.includes("INVALID_STAY_DATES"), "Past dates must fail.");

  const { error: deactivateError } = await supabase
    .from("room_types")
    .update({ is_active: false })
    .eq("id", roomId);
  if (deactivateError) throw deactivateError;
  const inactive = await supabase.rpc(
    "create_booking_request",
    bookingArgs(isoDaysFromNow(30), isoDaysFromNow(31), "inactive"),
  );
  assert(inactive.error?.message.includes("ROOM_NOT_AVAILABLE"), "Inactive rooms must fail.");

  await supabase.from("room_types").update({ is_active: true }).eq("id", roomId);
  const winningCode = confirmed[0].data.confirmation_code;
  const hotelToday = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const hotelTomorrow = new Date(`${hotelToday}T00:00:00Z`);
  hotelTomorrow.setUTCDate(hotelTomorrow.getUTCDate() + 1);
  const earningsResult = await supabase
    .from("bookings")
    .select("total_amount")
    .eq("confirmation_code", winningCode)
    .in("status", ["confirmed", "completed"])
    .gte("confirmed_at", `${hotelToday}T00:00:00+03:00`)
    .lt("confirmed_at", `${hotelTomorrow.toISOString().slice(0, 10)}T00:00:00+03:00`);
  if (earningsResult.error) throw earningsResult.error;
  assert(Number(earningsResult.data[0]?.total_amount) === 4, "A grouped booking's full price must appear in today's earnings query.");

  await supabase
    .from("bookings")
    .update({ status: "rejected" })
    .eq("confirmation_code", winningCode);
  const losingCode = pendingCodes.find((code) => code !== winningCode);
  assert(losingCode, "The unconfirmed request must remain pending.");
  const released = await confirmBooking(losingCode);
  assert(!released.error, "Rejecting a confirmed booking must release its reserved unit.");

  console.log("Confirmation locking, availability, overlap, back-to-back, validation, inactive-room, and release tests passed.");
} finally {
  if (roomId) {
    await supabase.from("bookings").delete().eq("room_type_id", roomId);
    await supabase.from("room_types").delete().eq("id", roomId);
  }
}
