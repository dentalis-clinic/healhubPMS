import type { Enums } from "@/generated/supabase/database.types";

type AppointmentStatus = Enums<"AppointmentStatus">;
type AppointmentType = Enums<"AppointmentType">;
type BookingChannel = Enums<"BookingChannel">;
type VisitType = Enums<"VisitType">;
type AppointmentPriority = Enums<"AppointmentPriority">;

// Status badges (updated with PENDING and OVERDUE)
export const STATUS_BADGE: Record<
  AppointmentStatus,
  { variant: "warning" | "info" | "success" | "error" | "neutral"; label: string }
> = {
  PENDING: { variant: "warning", label: "Pending" }, // Renamed from TENTATIVE
  OVERDUE: { variant: "error", label: "Overdue" }, // NEW
  CONFIRMED: { variant: "info", label: "Confirmed" },
  COMPLETED: { variant: "success", label: "Completed" },
  CANCELLED: { variant: "neutral", label: "Cancelled" },
  TENTATIVE: { variant: "warning", label: "Tentative" }, // DEPRECATED: Keep for backward compatibility
};

// Booking channel labels
export const CHANNEL_LABEL: Record<BookingChannel, string> = {
  ONLINE: "Online",
  PHONE: "Phone",
  WALK_IN: "Walk-in",
  SMS: "SMS",
  WHATSAPP: "WhatsApp",
};

// Visit type labels
export const VISIT_TYPE_LABEL: Record<VisitType, string> = {
  NEW_CONSULTATION: "New Consultation",
  FOLLOW_UP: "Follow-up",
};

// Priority badges
export const PRIORITY_BADGE: Record<
  AppointmentPriority,
  { variant: "neutral" | "warning" | "error"; label: string }
> = {
  ROUTINE: { variant: "neutral", label: "Routine" },
  URGENT: { variant: "warning", label: "Urgent" },
  EMERGENCY: { variant: "error", label: "Emergency" },
};

// DEPRECATED: Old type labels (use VISIT_TYPE_LABEL + CHANNEL_LABEL instead)
export const TYPE_LABEL: Record<AppointmentType, string> = {
  PATIENT_BOOKING: "Booking",
  WALK_IN: "Walk-in",
  FOLLOW_UP: "Follow-up",
};
