import { DateTime } from "luxon";

// Platform view isn't scoped to one clinic; IST until clinics span timezones.
const PLATFORM_ZONE = "Asia/Kolkata";

export function formatDate(iso: string): string {
  return DateTime.fromISO(iso).setZone(PLATFORM_ZONE).toFormat("d LLL yyyy");
}

export function formatRelative(iso: string | null): string {
  if (!iso) return "No bookings yet";
  return `Last booking ${DateTime.fromISO(iso).toRelative() ?? "recently"}`;
}
