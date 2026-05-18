import { z } from "zod/v4";
import { DateTime } from "luxon";
import { isSlotWithinBusinessHours, isSlotAligned } from "@/lib/utils/time-slots";
import type { ClinicScheduleConfig } from "@/lib/utils/clinic-schedule";
import { DEFAULT_BUSINESS_HOURS, DEFAULT_SLOT_DURATION } from "@/lib/utils/clinic-schedule";

// --- Enums ---

export const bookingChannelEnum = z.enum(["ONLINE", "PHONE", "WALK_IN", "SMS", "WHATSAPP"]);
export const visitTypeEnum = z.enum(["NEW_CONSULTATION", "FOLLOW_UP"]);
export const priorityEnum = z.enum(["ROUTINE", "URGENT", "EMERGENCY"]);
export const appointmentStatusEnum = z.enum(["PENDING", "OVERDUE", "CONFIRMED", "COMPLETED", "CANCELLED"]);

// --- Phone check ---

export const phoneCheckSchema = z.object({
  phone: z.string().trim().min(1, "Phone number is required").regex(/^\+?[\d\s\-()]+$/, "Invalid phone number format"),
});

// --- Factory: creates the preferredDateTime field with per-clinic business hours validation ---

function preferredDateTimeField(config: ClinicScheduleConfig) {
  return z
    .string()
    .min(1, "Preferred date and time is required")
    .transform((val) => new Date(val))
    .refine((date) => !isNaN(date.getTime()), "Invalid date format")
    .refine((date) => date > new Date(), "Preferred time must be in the future")
    .refine(
      (date) => date <= new Date(Date.now() + 72 * 60 * 60 * 1000),
      "Preferred time must be within the next 3 days"
    )
    .refine((date) => {
      const dt = DateTime.fromJSDate(date, { zone: config.timezone });
      return isSlotWithinBusinessHours(dt, config);
    }, "Selected time is outside clinic hours")
    .refine((date) => {
      const dt = DateTime.fromJSDate(date, { zone: config.timezone });
      return isSlotAligned(dt, config);
    }, "Please select a valid time slot");
}

// --- Factory: public booking base (shared by public + walk-in) ---

function createPublicBookingBaseSchema(config: ClinicScheduleConfig) {
  return z.object({
    name: z.string().trim().min(1, "Name is required").max(100, "Name must be 100 characters or less").optional(),
    phone: z.string().trim().min(1, "Phone number is required").regex(/^\+?[\d\s\-()]+$/, "Invalid phone number format"),
    preferredDateTime: preferredDateTimeField(config),
    existingPatientId: z.string().min(1, "Invalid patient ID").optional(),
  });
}

// --- Factory: public booking (patient self-service) ---

export function createPublicBookingSchema(config: ClinicScheduleConfig) {
  return createPublicBookingBaseSchema(config).refine(
    (data) => data.existingPatientId || data.name,
    { message: "Name is required for new patients", path: ["name"] }
  );
}

// --- Factory: walk-in registration (admin, full form) ---

export function createWalkInSchema(config: ClinicScheduleConfig) {
  return createPublicBookingBaseSchema(config).extend({
    email: z.string().trim().email("Invalid email address").optional().or(z.literal("")),
    age: z.number().int("Age must be a whole number").min(0).max(120).optional(),
    reasonForVisit: z.string().trim().max(1000).optional().or(z.literal("")),
    submittedByAdmin: z.literal(true).optional(),
    isPhoneBooking: z.boolean().optional(),
    visitType: visitTypeEnum.optional(),
    priority: priorityEnum.optional(),
  });
}

// --- Factory: follow-up appointment (admin, existing patient) ---

export function createFollowUpSchema(config: ClinicScheduleConfig) {
  return z.object({
    patientId: z.string().uuid("Invalid patient ID"),
    preferredDateTime: preferredDateTimeField(config),
    reasonForVisit: z.string().trim().max(1000).optional().or(z.literal("")),
    isPhoneBooking: z.boolean().optional(),
    priority: priorityEnum.optional(),
  });
}

// --- Static fallback schemas (use default config — kept for any callers that haven't migrated) ---

const defaultConfig: ClinicScheduleConfig = {
  timezone: "Asia/Kolkata",
  businessHours: DEFAULT_BUSINESS_HOURS,
  slotDuration: DEFAULT_SLOT_DURATION,
};

export const publicBookingSchema = createPublicBookingSchema(defaultConfig);
export const walkInSchema = createWalkInSchema(defaultConfig);
export const followUpSchema = createFollowUpSchema(defaultConfig);

// --- Patch appointment (admin updates — no business-hours checks) ---

export const patchAppointmentSchema = z.object({
  status: appointmentStatusEnum.optional(),
  bookingChannel: bookingChannelEnum.optional(),
  visitType: visitTypeEnum.optional(),
  priority: priorityEnum.optional(),
  doctorId: z.string().uuid("Invalid doctor ID").optional().nullable(),
  totalAmount: z.number().min(0).optional().nullable(),
  reasonForVisit: z.string().trim().max(1000).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  preferredDateTime: z.string().transform((val) => new Date(val)).refine((d) => !isNaN(d.getTime())).optional(),
});

// --- Unified confirm/new appointment (admin — no business-hours checks) ---

export const confirmAppointmentSchema = z.object({
  phone: z.string().trim().min(1, "Phone number is required").regex(/^\+?[\d\s\-()]+$/, "Invalid phone number format"),
  name: z.string().trim().min(1, "Name is required").max(100, "Name must be 100 characters or less"),
  sex: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  age: z.number().int().min(0).max(120).optional(),
  email: z.string().trim().email("Invalid email address").optional().or(z.literal("")),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  preferredDateTime: z
    .string()
    .min(1, "Preferred date and time is required")
    .transform((val) => new Date(val))
    .refine((d) => !isNaN(d.getTime()), "Invalid date format"),
  reasonForVisit: z.string().trim().max(1000).optional().or(z.literal("")),
  existingAppointmentId: z.string().uuid().optional(),
  existingPatientId: z.string().uuid().optional(),
  visitType: visitTypeEnum.optional(),
  priority: priorityEnum.optional(),
  isPhoneBooking: z.boolean().optional(),
  doctorId: z.string().uuid("Invalid doctor ID"),
  totalAmount: z.number().min(0).optional(),
});

export type ConfirmAppointmentInput = z.input<typeof confirmAppointmentSchema>;

// --- Patch patient ---

export const patchPatientSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  phone: z.string().trim().regex(/^\+?[\d\s\-()]+$/).optional(),
  email: z.string().trim().email().optional().or(z.literal("")),
  age: z.number().int().min(0).max(120).optional(),
  sex: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
});

// --- Bulk actions ---

export const bulkCancelSchema = z.object({
  ids: z.array(z.string().uuid("Invalid appointment ID")).min(1).max(50),
});

export const bulkDeleteSchema = z.object({
  ids: z.array(z.string().uuid("Invalid appointment ID")).min(1).max(50),
});

// --- Inferred types ---

export type PublicBookingInput = z.input<typeof publicBookingSchema>;
export type WalkInInput = z.input<typeof walkInSchema>;
export type FollowUpInput = z.input<typeof followUpSchema>;
export type PatchAppointmentInput = z.input<typeof patchAppointmentSchema>;
export type PatchPatientInput = z.input<typeof patchPatientSchema>;
export type BulkCancelInput = z.input<typeof bulkCancelSchema>;
export type BulkDeleteInput = z.input<typeof bulkDeleteSchema>;
