import { requireAdminSession } from "@/lib/supabase/auth";
import { BOOKING_STATUSES } from "@/lib/booking-status";

const HOTEL_TIME_ZONE_OFFSET = "+03:00";
const HOTEL_TIME_ZONE_OFFSET_MS = 3 * 60 * 60 * 1_000;

function hotelTodayIsoDate() {
  return new Date(Date.now() + HOTEL_TIME_ZONE_OFFSET_MS).toISOString().slice(0, 10);
}

function timestampBounds(start: string, end: string) {
  return {
    start: `${start}T00:00:00${HOTEL_TIME_ZONE_OFFSET}`,
    end: `${end}T00:00:00${HOTEL_TIME_ZONE_OFFSET}`,
  };
}

function monthBounds(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return null;
  }

  const start = new Date(`${month}-01T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || start.toISOString().slice(0, 7) !== month) {
    return null;
  }

  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export async function GET(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.session) return auth.response;

  const url = new URL(request.url);
  const today = hotelTodayIsoDate();
  const selectedMonth = url.searchParams.get("month") ?? today.slice(0, 7);
  const bounds = monthBounds(selectedMonth);
  if (!bounds) {
    return Response.json({ error: "Month must use YYYY-MM format." }, { status: 400 });
  }

  const previousMonthDate = new Date(`${bounds.start}T00:00:00Z`);
  previousMonthDate.setUTCMonth(previousMonthDate.getUTCMonth() - 1);
  const previousBounds = monthBounds(previousMonthDate.toISOString().slice(0, 7));
  if (!previousBounds) {
    return Response.json({ error: "Previous month could not be calculated." }, { status: 500 });
  }

  const monthTimestamps = timestampBounds(bounds.start, bounds.end);
  const previousMonthTimestamps = timestampBounds(previousBounds.start, previousBounds.end);
  const tomorrowDate = new Date(`${today}T00:00:00Z`);
  tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);
  const todayTimestamps = timestampBounds(today, tomorrowDate.toISOString().slice(0, 10));

  const [
    roomsResult,
    occupancyResult,
    monthlyOccupancyResult,
    monthlyEarningsResult,
    previousMonthlyEarningsResult,
    todayEarningsResult,
    statusResult,
  ] = await Promise.all([
    auth.session.supabase
      .from("room_types")
      .select("id, name, slug, total_units, display_order")
      .eq("is_active", true)
      .order("display_order"),
    auth.session.supabase
      .from("bookings")
      .select("id, room_type_id, room_count")
      .eq("status", "confirmed")
      .lte("arrival_date", today)
      .gt("departure_date", today),
    auth.session.supabase
      .from("bookings")
      .select("room_type_id, arrival_date, departure_date, room_count")
      .in("status", ["confirmed", "completed"])
      .lt("arrival_date", bounds.end)
      .gt("departure_date", bounds.start),
    auth.session.supabase
      .from("bookings")
      .select("total_amount, currency")
      .in("status", ["confirmed", "completed"])
      .gte("confirmed_at", monthTimestamps.start)
      .lt("confirmed_at", monthTimestamps.end),
    auth.session.supabase
      .from("bookings")
      .select("total_amount")
      .in("status", ["confirmed", "completed"])
      .gte("confirmed_at", previousMonthTimestamps.start)
      .lt("confirmed_at", previousMonthTimestamps.end),
    auth.session.supabase
      .from("bookings")
      .select("total_amount, currency")
      .in("status", ["confirmed", "completed"])
      .gte("confirmed_at", todayTimestamps.start)
      .lt("confirmed_at", todayTimestamps.end),
    auth.session.supabase
      .from("bookings")
      .select("status"),
  ]);

  const error = roomsResult.error
    ?? occupancyResult.error
    ?? monthlyOccupancyResult.error
    ?? monthlyEarningsResult.error
    ?? previousMonthlyEarningsResult.error
    ?? todayEarningsResult.error
    ?? statusResult.error;
  if (error) {
    console.error("Admin overview failed", error);
    return Response.json({ error: "Dashboard overview could not be loaded." }, { status: 500 });
  }

  const rooms = roomsResult.data ?? [];
  const occupiedByRoom = new Map<number, number>();
  for (const booking of occupancyResult.data ?? []) {
    occupiedByRoom.set(
      booking.room_type_id,
      (occupiedByRoom.get(booking.room_type_id) ?? 0) + booking.room_count,
    );
  }

  const totalUnits = rooms.reduce((sum, room) => sum + room.total_units, 0);
  const occupiedUnits = [...occupiedByRoom.values()].reduce((sum, count) => sum + count, 0);
  const activeRoomIds = new Set(rooms.map((room) => room.id));
  const monthStart = Date.parse(`${bounds.start}T00:00:00Z`);
  const monthEnd = Date.parse(`${bounds.end}T00:00:00Z`);
  const daysInMonth = Math.round((monthEnd - monthStart) / 86_400_000);
  const monthlyOccupiedRoomNights = (monthlyOccupancyResult.data ?? []).reduce(
    (sum, booking) => {
      if (!activeRoomIds.has(booking.room_type_id)) return sum;
      const overlapStart = Math.max(
        Date.parse(`${booking.arrival_date}T00:00:00Z`),
        monthStart,
      );
      const overlapEnd = Math.min(
        Date.parse(`${booking.departure_date}T00:00:00Z`),
        monthEnd,
      );
      return sum + Math.max(0, Math.round((overlapEnd - overlapStart) / 86_400_000)) * booking.room_count;
    },
    0,
  );
  const totalRoomNights = totalUnits * daysInMonth;
  const monthlyEarnings = (monthlyEarningsResult.data ?? []).reduce(
    (sum, booking) => sum + Number(booking.total_amount),
    0,
  );
  const previousMonthlyEarnings = (previousMonthlyEarningsResult.data ?? []).reduce(
    (sum, booking) => sum + Number(booking.total_amount),
    0,
  );
  const todayEarnings = (todayEarningsResult.data ?? []).reduce(
    (sum, booking) => sum + Number(booking.total_amount),
    0,
  );
  const statusCounts = Object.fromEntries(
    BOOKING_STATUSES.map((status) => [
      status,
      (statusResult.data ?? []).filter((booking) => booking.status === status).length,
    ]),
  );

  return Response.json({
    date: today,
    month: selectedMonth,
    totalUnits,
    occupiedUnits,
    availableUnits: Math.max(totalUnits - occupiedUnits, 0),
    occupancyPercent: totalUnits > 0
      ? Math.round((occupiedUnits / totalUnits) * 100)
      : 0,
    monthlyOccupiedRoomNights,
    totalRoomNights,
    monthlyOccupancyPercent: totalRoomNights > 0
      ? Math.min(100, Math.round((monthlyOccupiedRoomNights / totalRoomNights) * 1_000) / 10)
      : 0,
    monthlyEarnings,
    previousMonthlyEarnings,
    todayEarnings,
    earningsChangePercent: previousMonthlyEarnings > 0
      ? Math.round(((monthlyEarnings - previousMonthlyEarnings) / previousMonthlyEarnings) * 100)
      : null,
    currency: monthlyEarningsResult.data?.[0]?.currency
      ?? todayEarningsResult.data?.[0]?.currency
      ?? "USD",
    totalBookings: statusResult.data?.length ?? 0,
    statusCounts,
    rooms: rooms.map((room) => {
      const occupied = occupiedByRoom.get(room.id) ?? 0;
      return {
        id: room.id,
        name: room.name,
        slug: room.slug,
        totalUnits: room.total_units,
        occupiedUnits: occupied,
        availableUnits: Math.max(room.total_units - occupied, 0),
      };
    }),
  });
}
