export const BOOKING_STATUSES = [
  "pending",
  "confirmed",
  "rejected",
  "cancelled",
  "completed",
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

const MANUAL_STATUS_TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  pending: ["pending", "confirmed", "rejected", "cancelled"],
  confirmed: ["confirmed", "cancelled"],
  rejected: ["rejected"],
  cancelled: ["cancelled"],
  completed: ["completed"],
};

export function isBookingStatus(value: string): value is BookingStatus {
  return BOOKING_STATUSES.includes(value as BookingStatus);
}

export function getManualBookingStatusOptions(currentStatus: string) {
  return isBookingStatus(currentStatus)
    ? MANUAL_STATUS_TRANSITIONS[currentStatus]
    : [];
}

export function canManuallyTransitionBookingStatus(from: string, to: string) {
  return getManualBookingStatusOptions(from).includes(to as BookingStatus);
}
