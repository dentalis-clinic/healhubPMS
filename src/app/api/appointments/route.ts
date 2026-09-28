import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isSlotConflict,
  slotConflictResponse,
  type NewAppointmentData,
  type PatientLookupData,
} from "@/lib/supabase/rpc";
import { utcIso } from "@/lib/supabase/serialize";
import {
  createPublicBookingSchema,
  createWalkInSchema,
} from "@/lib/validations/appointment";
import { buildClinicSchedule } from "@/lib/utils/clinic-schedule";
import { normalizePhoneNumber } from "@/lib/utils/phone";
import { checkRateLimit } from "@/lib/utils/rate-limit";
import { resolvePatientToken } from "@/lib/utils/patient-token";
import { validateOrigin } from "@/lib/utils/csrf";
import { getClinicContext } from "@/lib/utils/clinic-context";

export async function POST(request: NextRequest) {
  try {
    const csrfError = validateOrigin(request);
    if (csrfError) return csrfError;

    const { clinic, error: clinicError } = getClinicContext(request);
    if (clinicError) return clinicError;

    const body = (await request.json()) as Record<string, unknown>;

    const db = createAdminClient();
    const [{ data: clinicRow, error: clinicRowError }, supabase] = await Promise.all([
      db
        .from("clinics")
        .select("timezone, businessHours, slotDuration")
        .eq("id", clinic.clinicId)
        .maybeSingle(),
      createClient(),
    ]);
    if (clinicRowError) throw clinicRowError;
    const scheduleConfig = buildClinicSchedule(clinicRow ?? { timezone: clinic.timezone, businessHours: null, slotDuration: null });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    let isAdminSubmission = false;
    if (user && body.submittedByAdmin === true) {
      const { data: admin, error: adminError } = await db
        .from("admins")
        .select("id")
        .eq("id", user.id)
        .eq("clinicId", clinic.clinicId)
        .maybeSingle();
      if (adminError) throw adminError;
      isAdminSubmission = !!admin;
    }

    if (!isAdminSubmission) {
      const ip =
        request.headers.get("x-real-ip") ??
        request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
        "unknown";
      const { allowed, remaining } = await checkRateLimit(ip);

      if (!allowed) {
        return NextResponse.json(
          { success: false, error: "Too many submissions. Please try again later." },
          {
            status: 429,
            headers: { "X-RateLimit-Remaining": remaining.toString() },
          }
        );
      }
    }

    const schema = isAdminSubmission ? createWalkInSchema(scheduleConfig) : createPublicBookingSchema(scheduleConfig);
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      const errors = z.prettifyError(parsed.error);
      return NextResponse.json(
        { success: false, error: "Validation failed", details: errors },
        { status: 400 }
      );
    }

    const data = parsed.data;

    let normalizedPhone: string;
    try {
      normalizedPhone = normalizePhoneNumber(data.phone);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid phone number";
      return NextResponse.json({ success: false, error: message }, { status: 400 });
    }

    const fullData = data as typeof data & {
      existingPatientId?: string;
      email?: string;
      age?: number;
      reasonForVisit?: string;
    };

    let patientId: string;
    let patient: { id: string; patientId: string };

    if (fullData.existingPatientId) {
      const resolvedId = isAdminSubmission
        ? fullData.existingPatientId
        : resolvePatientToken(fullData.existingPatientId) ?? fullData.existingPatientId;

      const { data: existing, error: existingError } = await db
        .from("patients")
        .select("id, patientId, phone")
        .eq("id", resolvedId)
        .eq("clinicId", clinic.clinicId)
        .maybeSingle();
      if (existingError) throw existingError;

      if (!existing || existing.phone !== normalizedPhone) {
        return NextResponse.json(
          { success: false, error: "Invalid patient selection." },
          { status: 400 }
        );
      }

      patient = { id: existing.id, patientId: existing.patientId };
      patientId = existing.patientId;

      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const { data: recentAppointments, error: recentError } = await db
        .from("appointments")
        .select("id")
        .eq("clinicId", clinic.clinicId)
        .eq("patientId", existing.id)
        .gte("createdAt", fiveMinutesAgo.toISOString())
        .limit(1);
      if (recentError) throw recentError;

      if (recentAppointments.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: "A booking was submitted recently for this patient. Please wait a few minutes before trying again.",
            patientId,
          },
          { status: 409 }
        );
      }
    } else {
      if (!data.name) {
        return NextResponse.json(
          { success: false, error: "Name is required for new patients." },
          { status: 400 }
        );
      }

      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      // !inner makes the embedded-patient filter exclude parent rows (plain
      // embeds only null out the child). Name is compared case-insensitively
      // here rather than via ilike, which would treat % _ * in names as wildcards.
      const { data: recentByPhone, error: recentError } = await db
        .from("appointments")
        .select("patient:patients!inner(patientId, name)")
        .eq("clinicId", clinic.clinicId)
        .eq("patient.phone", normalizedPhone)
        .gte("createdAt", fiveMinutesAgo.toISOString());
      if (recentError) throw recentError;

      const nameLower = data.name.toLowerCase();
      const recentAppointment = recentByPhone.find((a) => a.patient.name.toLowerCase() === nameLower);

      if (recentAppointment) {
        return NextResponse.json(
          {
            success: false,
            error: "A booking with this name and phone was submitted recently. Please wait a few minutes before trying again.",
            patientId: recentAppointment.patient.patientId,
          },
          { status: 409 }
        );
      }

      const lookup: PatientLookupData = {
        name: data.name,
        phone: normalizedPhone,
        email: fullData.email || null,
        age: fullData.age ?? null,
      };
      const { data: found, error: findError } = await db
        .rpc("find_or_create_patient", {
          p_clinic_id: clinic.clinicId,
          p_clinic_short_name: clinic.shortName,
          p_timezone: clinic.timezone,
          p_data: lookup,
        })
        .single();
      if (findError) throw findError;

      patientId = found.patientId;
      patient = { id: found.id, patientId: found.patientId };
    }

    const adminData = fullData as typeof fullData & {
      isPhoneBooking?: boolean;
      visitType?: "NEW_CONSULTATION" | "FOLLOW_UP";
      priority?: "ROUTINE" | "URGENT" | "EMERGENCY";
    };

    const bookingChannel = isAdminSubmission
      ? adminData.isPhoneBooking ? "PHONE" : "WALK_IN"
      : "ONLINE";

    const visitType = adminData.visitType ?? "NEW_CONSULTATION";
    const priority = adminData.priority ?? null;

    const appointmentData: NewAppointmentData = {
      patientId: patient.id,
      bookingChannel,
      visitType,
      priority,
      status: "PENDING",
      preferredDateTime: data.preferredDateTime.toISOString(),
      reasonForVisit: fullData.reasonForVisit || null,
      submittedBy: isAdminSubmission ? "ADMIN" : "PATIENT",
      adminUserId: isAdminSubmission ? user!.id : null,
    };
    const { data: appointment, error: rpcError } = await db.rpc("create_appointment_atomic", {
      p_clinic_id: clinic.clinicId,
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
        patientId,
        appointmentId: appointment.id,
        preferredDateTime: utcIso(appointment.preferredDateTime),
        message: isAdminSubmission
          ? "Walk-in appointment created."
          : "Your appointment has been tentatively booked.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/appointments error:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
