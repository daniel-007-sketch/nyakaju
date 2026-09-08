import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

const HOTEL_TIME_ZONE_OFFSET_MS = 3 * 60 * 60 * 1_000;

export function hotelTodayIsoDate() {
  return new Date(Date.now() + HOTEL_TIME_ZONE_OFFSET_MS).toISOString().slice(0, 10);
}

export async function advanceBookingLifecycle(today = hotelTodayIsoDate()) {
  const supabase = createAdminClient();

  // Keep departure-day stays confirmed. This also corrects records produced by
  // the previous inclusive cutoff until the database migration is deployed.
  const correctionResult = await supabase
    .from("bookings")
    .update({ status: "confirmed" })
    .eq("status", "completed")
    .gte("departure_date", today)
    .select("id");

  if (correctionResult.error) throw correctionResult.error;

  const [completedResult, cancelledResult] = await Promise.all([
    supabase
      .from("bookings")
      .update({ status: "completed" })
      .eq("status", "confirmed")
      .lt("departure_date", today)
      .select("id"),
    supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("status", "pending")
      .lte("departure_date", today)
      .select("id"),
  ]);

  const error = completedResult.error ?? cancelledResult.error;
  if (error) throw error;

  return {
    correctedCount: correctionResult.data?.length ?? 0,
    completedCount: completedResult.data?.length ?? 0,
    cancelledCount: cancelledResult.data?.length ?? 0,
  };
}
