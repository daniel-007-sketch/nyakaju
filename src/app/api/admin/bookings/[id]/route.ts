import { readPositiveInteger } from "@/lib/api";
import {
  canManuallyTransitionBookingStatus,
  isBookingStatus,
} from "@/lib/booking-status";
import { requireAdminSession } from "@/lib/supabase/auth";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: RouteContext) {
  const auth = await requireAdminSession();
  if (!auth.session) return auth.response;
  const id = readPositiveInteger((await params).id, "Booking");
  const body = await request.json();
  const status = typeof body.status === "string" ? body.status.toLowerCase() : "";

  if (!isBookingStatus(status)) {
    return Response.json({ error: "Choose a valid booking status." }, { status: 400 });
  }

  const { data: currentBooking, error: currentBookingError } = await auth.session.supabase
    .from("bookings")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();

  if (currentBookingError) {
    console.error("Admin booking lookup failed", currentBookingError);
    return Response.json({ error: "Booking could not be loaded." }, { status: 500 });
  }
  if (!currentBooking) {
    return Response.json({ error: "Booking not found." }, { status: 404 });
  }
  if (!canManuallyTransitionBookingStatus(currentBooking.status, status)) {
    return Response.json(
      { error: `A ${currentBooking.status} booking cannot be changed to ${status}.` },
      { status: 409 },
    );
  }

  const adminNotes = typeof body.adminNotes === "string"
    ? body.adminNotes.trim().slice(0, 2_000) || null
    : undefined;
  const { data, error } = await auth.session.supabase
    .from("bookings")
    .update({
      status,
      ...(adminNotes !== undefined ? { admin_notes: adminNotes } : {}),
    })
    .eq("id", id)
    .eq("status", currentBooking.status)
    .select("*, room_types(name, slug)")
    .maybeSingle();

  if (error) {
    if (error.message.includes("ROOM_SOLD_OUT")) {
      return Response.json(
        { error: "No units are available for this room type across the booking dates." },
        { status: 409 },
      );
    }
    if (error.message.includes("ROOM_NOT_AVAILABLE")) {
      return Response.json(
        { error: "This room type is no longer available." },
        { status: 409 },
      );
    }
    console.error("Admin booking update failed", error);
    return Response.json({ error: "Booking could not be updated." }, { status: 500 });
  }
  if (!data) {
    return Response.json(
      { error: "This booking changed while you were editing it. Refresh and try again." },
      { status: 409 },
    );
  }

  return Response.json({ booking: data });
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const auth = await requireAdminSession();
  if (!auth.session) return auth.response;
  const id = readPositiveInteger((await params).id, "Booking");
  const body = await request.json().catch(() => ({}));
  const confirmationCode = typeof body.confirmationCode === "string"
    ? body.confirmationCode.trim()
    : "";

  if (!confirmationCode) {
    return Response.json(
      { error: "The booking confirmation code is required for permanent deletion." },
      { status: 400 },
    );
  }

  const { data, error } = await auth.session.supabase
    .from("bookings")
    .delete()
    .eq("id", id)
    .eq("confirmation_code", confirmationCode)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Admin booking delete failed", error);
    return Response.json({ error: "Booking could not be deleted." }, { status: 500 });
  }
  if (!data) {
    return Response.json(
      { error: "Booking not found or the confirmation code did not match." },
      { status: 404 },
    );
  }

  return Response.json({ ok: true });
}
