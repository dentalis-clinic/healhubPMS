import { NextResponse } from "next/server";
import type { PostgrestError } from "@supabase/supabase-js";
import type { TablesInsert, TablesUpdate } from "@/generated/supabase/database.types";

/**
 * Typed `p_data` payloads and error mapping for the transactional RPCs in
 * prisma/migrations/20260926120000_add_appointment_patient_prescription_rpc.
 * Errors cross the RPC boundary as plain PostgrestError objects, so match on
 * message / SQLSTATE rather than `instanceof`.
 */

/** p_data for create_appointment_atomic — the function fills id/clinicId/appointmentId/timestamps. */
export type NewAppointmentData = Omit<
  TablesInsert<"appointments">,
  "id" | "clinicId" | "appointmentId" | "createdAt" | "updatedAt"
>;

/** p_data for update_appointment_atomic — a present key (even null) sets that column. */
export type AppointmentPatch = Pick<
  TablesUpdate<"appointments">,
  | "status"
  | "bookingChannel"
  | "visitType"
  | "priority"
  | "doctorId"
  | "totalAmount"
  | "reasonForVisit"
  | "notes"
  | "preferredDateTime"
>;

/** p_data for find_or_create_patient — phone must already be normalized. */
export type PatientLookupData = Pick<TablesInsert<"patients">, "name" | "phone" | "email" | "age" | "sex" | "address">;

/** p_data for create_prescription_with_id. */
export type NewPrescriptionData = Pick<
  TablesInsert<"prescriptions">,
  "appointmentId" | "diagnosis" | "medications" | "treatmentPlan" | "nextVisitDate" | "advice" | "prescribedById"
>;

/** p_patient_data for confirm_appointment — a present key sets that column. */
export type ConfirmPatientPatch = Pick<TablesUpdate<"patients">, "name" | "sex" | "email" | "address" | "age">;

/** p_appointment_data for confirm_appointment — status is always set to CONFIRMED by the function. */
export type ConfirmAppointmentPatch = Pick<
  TablesUpdate<"appointments">,
  "preferredDateTime" | "reasonForVisit" | "adminUserId" | "doctorId" | "totalAmount"
>;

/** SQLSTATE for unique_violation. */
export const PG_UNIQUE_VIOLATION = "23505";

export const isSlotConflict = (error: PostgrestError) => error.message === "SLOT_CONFLICT";
export const isNotFound = (error: PostgrestError) => error.message === "NOT_FOUND";
export const isNotConfirmable = (error: PostgrestError) => error.message === "NOT_CONFIRMABLE";

/** Same body/status the old SlotConflictError catch branches returned. */
export function slotConflictResponse() {
  return NextResponse.json(
    {
      success: false,
      error: "This time slot is already booked. Please choose another time.",
      code: "SLOT_CONFLICT",
    },
    { status: 409 }
  );
}
