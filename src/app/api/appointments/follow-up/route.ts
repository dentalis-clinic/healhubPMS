import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createFollowUpSchema } from "@/lib/validations/appointment";
import { buildClinicSchedule } from "@/lib/utils/clinic-schedule";
import { validateOrigin } from "@/lib/utils/csrf";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSlotConflict, slotConflictResponse, type NewAppointmentData } from "@/lib/supabase/rpc";
import { utcIso } from "@/lib/supabase/serialize";

export async function POST(request: NextRequest) {
  try {
    const csrfError = validateOrigin(request);
    if (csrfError) return csrfError;

    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const { user, clinic } = auth;

    const body = await request.json();
    const supabase = createAdminClient();
    const { data: clinicRow, error: clinicRowError } = await supabase
      .from("clinics")
      .select("timezone, businessHours, slotDuration")
      .eq("id", clinic.id)
      .maybeSingle();
    if (clinicRowError) throw clinicRowError;
    const scheduleConfig = buildClinicSchedule(clinicRow ?? { timezone: clinic.timezone, businessHours: null, slotDuration: null });
    const parsed = createFollowUpSchema(scheduleConfig).safeParse(body);

    if (!parsed.success) {
      const errors = z.prettifyError(parsed.error);
      return NextResponse.json(
        { success: false, error: "Validation failed", details: errors },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const { data: patient, error: patientError } = await supabase
      .from("patients")
      .select("id, patientId")
      .eq("id", data.patientId)
      .eq("clinicId", clinic.id)
      .maybeSingle();
    if (patientError) throw patientError;

    if (!patient) {
      return NextResponse.json(
        { success: false, error: "Patient not found" },
        { status: 404 }
      );
    }

    const appointmentData: NewAppointmentData = {
      patientId: patient.id,
      type: "FOLLOW_UP",
      bookingChannel: "WALK_IN",
      visitType: "FOLLOW_UP",
      status: "PENDING",
      preferredDateTime: data.preferredDateTime.toISOString(),
      reasonForVisit: data.reasonForVisit || null,
      submittedBy: "ADMIN",
      adminUserId: user.id,
    };
    const { data: appointment, error: rpcError } = await supabase.rpc("create_appointment_atomic", {
      p_clinic_id: clinic.id,
      p_timezone: clinic.timezone,
      p_allow_override: false,
      p_data: appointmentData,
    });
    if (rpcError) {
      if (isSlotConflict(rpcError)) return slotConflictResponse();
      throw rpcError;
    }

    return NextResponse.json(
      {
        success: true,
        patientId: patient.patientId,
        appointmentId: appointment.id,
        preferredDateTime: utcIso(appointment.preferredDateTime),
        message: "Follow-up appointment created.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/appointments/follow-up error:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
