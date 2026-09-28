import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import {
  createPublicBookingSchema,
  createWalkInSchema,
} from "@/lib/validations/appointment";
import { buildClinicSchedule } from "@/lib/utils/clinic-schedule";
import { normalizePhoneNumber } from "@/lib/utils/phone";
import { findOrCreatePatient } from "@/lib/utils/patient-id";
import { checkRateLimit } from "@/lib/utils/rate-limit";
import { createAppointmentAtomic, SlotConflictError } from "@/lib/utils/slot-conflict";
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

    const [clinicRow, supabase] = await Promise.all([
      prisma.clinic.findUnique({
        where: { id: clinic.clinicId },
        select: { timezone: true, businessHours: true, slotDuration: true },
      }),
      createClient(),
    ]);
    const scheduleConfig = buildClinicSchedule(clinicRow ?? { timezone: clinic.timezone, businessHours: null, slotDuration: null });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    let isAdminSubmission = false;
    if (user && body.submittedByAdmin === true) {
      const admin = await prisma.admin.findUnique({
        where: { id: user.id, clinicId: clinic.clinicId },
      });
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

      const existing = await prisma.patient.findUnique({
        where: { id: resolvedId, clinicId: clinic.clinicId },
        select: { id: true, patientId: true, phone: true },
      });

      if (!existing || existing.phone !== normalizedPhone) {
        return NextResponse.json(
          { success: false, error: "Invalid patient selection." },
          { status: 400 }
        );
      }

      patient = { id: existing.id, patientId: existing.patientId };
      patientId = existing.patientId;

      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const recentAppointment = await prisma.appointment.findFirst({
        where: {
          clinicId: clinic.clinicId,
          createdAt: { gte: fiveMinutesAgo },
          patientId: existing.id,
        },
      });

      if (recentAppointment) {
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
      const recentAppointment = await prisma.appointment.findFirst({
        where: {
          clinicId: clinic.clinicId,
          createdAt: { gte: fiveMinutesAgo },
          patient: {
            phone: normalizedPhone,
            name: { equals: data.name, mode: "insensitive" },
          },
        },
        include: { patient: true },
      });

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

      const result = await findOrCreatePatient(
        prisma,
        {
          name: data.name,
          phone: normalizedPhone,
          email: fullData.email || null,
          age: fullData.age ?? null,
        },
        { id: clinic.clinicId, shortName: clinic.shortName, timezone: clinic.timezone }
      );

      patientId = result.patientId;
      patient = result.patient;
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

    const appointment = await createAppointmentAtomic(prisma, {
      clinicId: clinic.clinicId,
      timezone: clinic.timezone,
      data: {
        patientId: patient.id,
        bookingChannel,
        visitType,
        priority,
        status: "PENDING",
        preferredDateTime: data.preferredDateTime,
        reasonForVisit: fullData.reasonForVisit || null,
        submittedBy: isAdminSubmission ? "ADMIN" : "PATIENT",
        adminUserId: isAdminSubmission ? user!.id : null,
      },
    });

    return NextResponse.json(
      {
        success: true,
        patientId,
        appointmentId: appointment.id,
        preferredDateTime: appointment.preferredDateTime.toISOString(),
        message: isAdminSubmission
          ? "Walk-in appointment created."
          : "Your appointment has been tentatively booked.",
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof SlotConflictError) {
      return NextResponse.json(
        { success: false, error: error.message, code: "SLOT_CONFLICT" },
        { status: 409 }
      );
    }
    console.error("POST /api/appointments error:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
