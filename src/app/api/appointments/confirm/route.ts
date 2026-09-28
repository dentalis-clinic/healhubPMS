import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { requireAdmin } from "@/lib/auth/require-admin";
import { confirmAppointmentSchema } from "@/lib/validations/appointment";
import { normalizePhoneNumber } from "@/lib/utils/phone";
import { validateOrigin } from "@/lib/utils/csrf";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isNotConfirmable,
  isNotFound,
  isSlotConflict,
  slotConflictResponse,
  type ConfirmAppointmentPatch,
  type ConfirmPatientPatch,
  type NewAppointmentData,
  type PatientLookupData,
} from "@/lib/supabase/rpc";
import type { TablesUpdate } from "@/generated/supabase/database.types";

const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  OVERDUE: ["CONFIRMED", "CANCELLED"],
  TENTATIVE: ["CONFIRMED", "CANCELLED"],
};

export async function POST(request: NextRequest) {
  try {
    const csrfError = validateOrigin(request);
    if (csrfError) return csrfError;

    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const { admin, clinic } = auth;

    const body = (await request.json()) as Record<string, unknown>;
    const parsed = confirmAppointmentSchema.safeParse(body);

    if (!parsed.success) {
      const errors = z.prettifyError(parsed.error);
      return NextResponse.json(
        { success: false, error: "Validation failed", details: errors },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const allowOverride = body.allowOverride === true;
    const supabase = createAdminClient();

    // Validate doctor exists, is active, and belongs to this clinic
    const { data: doctor, error: doctorError } = await supabase
      .from("doctors")
      .select("id")
      .eq("id", data.doctorId)
      .eq("clinicId", clinic.id)
      .eq("isActive", true)
      .maybeSingle();
    if (doctorError) throw doctorError;
    if (!doctor) {
      return NextResponse.json(
        { success: false, error: "Selected doctor not found or inactive." },
        { status: 400 }
      );
    }

    let normalizedPhone: string;
    try {
      normalizedPhone = normalizePhoneNumber(data.phone);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid phone number";
      return NextResponse.json({ success: false, error: message }, { status: 400 });
    }

    // --- Flow A: Confirm existing PENDING/OVERDUE appointment ---
    if (data.existingAppointmentId) {
      const { data: appointment, error: appointmentError } = await supabase
        .from("appointments")
        .select("id, status, reasonForVisit, patient:patients(patientId, name)")
        .eq("id", data.existingAppointmentId)
        .eq("clinicId", clinic.id)
        .maybeSingle();
      if (appointmentError) throw appointmentError;

      if (!appointment) {
        return NextResponse.json(
          { success: false, error: "Appointment not found" },
          { status: 404 }
        );
      }

      if (!VALID_TRANSITIONS[appointment.status]?.includes("CONFIRMED")) {
        return NextResponse.json(
          { success: false, error: `Cannot confirm appointment with status "${appointment.status}"` },
          { status: 400 }
        );
      }

      const patientPatch: ConfirmPatientPatch = {};
      if (data.name && data.name !== appointment.patient.name) patientPatch.name = data.name;
      if (data.sex) patientPatch.sex = data.sex;
      if (data.email) patientPatch.email = data.email;
      if (data.address) patientPatch.address = data.address;
      if (data.age != null) patientPatch.age = data.age;

      const appointmentPatch: ConfirmAppointmentPatch = {
        reasonForVisit: data.reasonForVisit || appointment.reasonForVisit,
        preferredDateTime: data.preferredDateTime.toISOString(),
        adminUserId: admin.id,
        doctorId: data.doctorId,
      };
      if (data.totalAmount != null) appointmentPatch.totalAmount = data.totalAmount;

      // Patient patch, slot check, and confirm run in one transaction (conflict rolls back all).
      const { data: updated, error: rpcError } = await supabase.rpc("confirm_appointment", {
        p_clinic_id: clinic.id,
        p_id: appointment.id,
        p_patient_data: patientPatch,
        p_appointment_data: appointmentPatch,
        p_allow_override: allowOverride,
      });
      if (rpcError) {
        if (isSlotConflict(rpcError)) return slotConflictResponse();
        if (isNotFound(rpcError)) {
          return NextResponse.json(
            { success: false, error: "Appointment not found" },
            { status: 404 }
          );
        }
        // Status changed between the check above and the locked re-check.
        if (isNotConfirmable(rpcError)) {
          return NextResponse.json(
            { success: false, error: "This appointment can no longer be confirmed." },
            { status: 400 }
          );
        }
        throw rpcError;
      }

      return NextResponse.json(
        {
          success: true,
          appointmentId: updated.id,
          patientId: appointment.patient.patientId,
          message: "Appointment confirmed.",
        },
        { status: 200 }
      );
    }

    // --- Flow B: New appointment for existing patient ---
    if (data.existingPatientId) {
      const { data: patient, error: patientError } = await supabase
        .from("patients")
        .select("id, patientId, email, address, age")
        .eq("id", data.existingPatientId)
        .eq("clinicId", clinic.id)
        .maybeSingle();
      if (patientError) throw patientError;

      if (!patient) {
        return NextResponse.json(
          { success: false, error: "Patient not found" },
          { status: 404 }
        );
      }

      const patientUpdates: TablesUpdate<"patients"> = {};
      if (data.sex) patientUpdates.sex = data.sex;
      if (data.email && !patient.email) patientUpdates.email = data.email;
      if (data.address && !patient.address) patientUpdates.address = data.address;
      if (data.age != null && patient.age == null) patientUpdates.age = data.age;

      if (Object.keys(patientUpdates).length > 0) {
        // @updatedAt was set by Prisma client-side; the column has no DB default/trigger.
        const { error: updateError } = await supabase
          .from("patients")
          .update({ ...patientUpdates, updatedAt: new Date().toISOString() })
          .eq("id", patient.id)
          .eq("clinicId", clinic.id);
        if (updateError) throw updateError;
      }

      const appointmentData: NewAppointmentData = {
        patientId: patient.id,
        type: data.visitType === "FOLLOW_UP" ? "FOLLOW_UP" : "WALK_IN",
        bookingChannel: data.isPhoneBooking ? "PHONE" : "WALK_IN",
        visitType: data.visitType === "FOLLOW_UP" ? "FOLLOW_UP" : "NEW_CONSULTATION",
        status: "CONFIRMED",
        preferredDateTime: data.preferredDateTime.toISOString(),
        reasonForVisit: data.reasonForVisit || null,
        submittedBy: "ADMIN",
        adminUserId: admin.id,
        doctorId: data.doctorId,
        totalAmount: data.totalAmount != null ? data.totalAmount : null,
      };
      const { data: appointment, error: rpcError } = await supabase.rpc("create_appointment_atomic", {
        p_clinic_id: clinic.id,
        p_timezone: clinic.timezone,
        p_allow_override: allowOverride,
        p_data: appointmentData,
      });
      if (rpcError) {
        if (isSlotConflict(rpcError)) return slotConflictResponse();
        throw rpcError;
      }

      return NextResponse.json(
        {
          success: true,
          appointmentId: appointment.id,
          patientId: patient.patientId,
          message: "Appointment created and confirmed.",
        },
        { status: 201 }
      );
    }

    // --- Flow C: Brand new patient ---
    const lookup: PatientLookupData = {
      name: data.name,
      phone: normalizedPhone,
      email: data.email || null,
      age: data.age ?? null,
      sex: data.sex || null,
      address: data.address || null,
    };
    const { data: patient, error: findError } = await supabase
      .rpc("find_or_create_patient", {
        p_clinic_id: clinic.id,
        p_clinic_short_name: clinic.shortName,
        p_timezone: clinic.timezone,
        p_data: lookup,
      })
      .single();
    if (findError) throw findError;

    const appointmentData: NewAppointmentData = {
      patientId: patient.id,
      type: "WALK_IN",
      bookingChannel: data.isPhoneBooking ? "PHONE" : "WALK_IN",
      visitType: "NEW_CONSULTATION",
      status: "CONFIRMED",
      preferredDateTime: data.preferredDateTime.toISOString(),
      reasonForVisit: data.reasonForVisit || null,
      submittedBy: "ADMIN",
      adminUserId: admin.id,
      doctorId: data.doctorId,
      totalAmount: data.totalAmount != null ? data.totalAmount : null,
    };
    const { data: appointment, error: rpcError } = await supabase.rpc("create_appointment_atomic", {
      p_clinic_id: clinic.id,
      p_timezone: clinic.timezone,
      p_allow_override: allowOverride,
      p_data: appointmentData,
    });
    if (rpcError) {
      if (isSlotConflict(rpcError)) return slotConflictResponse();
      throw rpcError;
    }

    return NextResponse.json(
      {
        success: true,
        appointmentId: appointment.id,
        patientId: patient.patientId,
        message: "Patient registered and appointment confirmed.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/appointments/confirm error:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
