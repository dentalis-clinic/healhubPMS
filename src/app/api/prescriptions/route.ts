import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { requireAdmin } from "@/lib/auth/require-admin";
import { prescriptionSchema } from "@/lib/validations/prescription";
import { validateOrigin } from "@/lib/utils/csrf";
import { createAdminClient } from "@/lib/supabase/admin";
import { PG_UNIQUE_VIOLATION, type NewPrescriptionData } from "@/lib/supabase/rpc";
import { dateOnlyIso, withUtcTimestamps } from "@/lib/supabase/serialize";

export async function POST(request: NextRequest) {
  try {
    const csrfError = validateOrigin(request);
    if (csrfError) return csrfError;

    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const { user, clinic } = auth;

    const body = await request.json();
    const parsed = prescriptionSchema.safeParse(body);

    if (!parsed.success) {
      const errors = z.prettifyError(parsed.error);
      return NextResponse.json(
        { success: false, error: "Validation failed", details: errors },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const supabase = createAdminClient();
    const { data: appointment, error: appointmentError } = await supabase
      .from("appointments")
      .select("status, prescription:prescriptions(id)")
      .eq("id", data.appointmentId)
      .eq("clinicId", clinic.id)
      .maybeSingle();
    if (appointmentError) throw appointmentError;

    if (!appointment) {
      return NextResponse.json(
        { success: false, error: "Appointment not found" },
        { status: 404 }
      );
    }

    if (appointment.status === "CANCELLED") {
      return NextResponse.json(
        { success: false, error: "Cannot create prescription for a cancelled appointment." },
        { status: 400 }
      );
    }

    if (appointment.prescription) {
      return NextResponse.json(
        { success: false, error: "This appointment already has a prescription." },
        { status: 409 }
      );
    }

    const prescriptionData: NewPrescriptionData = {
      appointmentId: data.appointmentId,
      diagnosis: data.diagnosis,
      medications: data.medications,
      treatmentPlan: data.treatmentPlan || null,
      nextVisitDate: data.nextVisitDate?.toISOString() ?? null,
      advice: data.advice || null,
      prescribedById: user.id,
    };
    const { data: record, error: rpcError } = await supabase.rpc("create_prescription_with_id", {
      p_clinic_id: clinic.id,
      p_timezone: clinic.timezone,
      p_data: prescriptionData,
    });
    if (rpcError) {
      // prescriptions_appointmentId_key: lost a race with a concurrent create.
      if (rpcError.code === PG_UNIQUE_VIOLATION) {
        return NextResponse.json(
          { success: false, error: "This appointment already has a prescription." },
          { status: 409 }
        );
      }
      throw rpcError;
    }

    return NextResponse.json(
      {
        success: true,
        prescriptionId: record.prescriptionId,
        prescription: { ...withUtcTimestamps(record), nextVisitDate: dateOnlyIso(record.nextVisitDate) },
        message: "Prescription created. Appointment confirmed.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/prescriptions error:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
