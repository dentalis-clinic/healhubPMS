import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { followUpSchema } from "@/lib/validations/appointment";
import { createAppointmentAtomic, SlotConflictError } from "@/lib/utils/slot-conflict";
import { validateOrigin } from "@/lib/utils/csrf";

export async function POST(request: NextRequest) {
  try {
    const csrfError = validateOrigin(request);
    if (csrfError) return csrfError;

    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const { user, clinic } = auth;

    const body = await request.json();
    const parsed = followUpSchema.safeParse(body);

    if (!parsed.success) {
      const errors = z.prettifyError(parsed.error);
      return NextResponse.json(
        { success: false, error: "Validation failed", details: errors },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const patient = await prisma.patient.findUnique({
      where: { id: data.patientId, clinicId: clinic.id },
    });

    if (!patient) {
      return NextResponse.json(
        { success: false, error: "Patient not found" },
        { status: 404 }
      );
    }

    const appointment = await createAppointmentAtomic(prisma, {
      clinicId: clinic.id,
      timezone: clinic.timezone,
      data: {
        patientId: patient.id,
        type: "FOLLOW_UP",
        bookingChannel: "WALK_IN",
        visitType: "FOLLOW_UP",
        status: "PENDING",
        preferredDateTime: data.preferredDateTime,
        reasonForVisit: data.reasonForVisit || null,
        submittedBy: "ADMIN",
        adminUserId: user.id,
      },
    });

    return NextResponse.json(
      {
        success: true,
        patientId: patient.patientId,
        appointmentId: appointment.id,
        preferredDateTime: appointment.preferredDateTime.toISOString(),
        message: "Follow-up appointment created.",
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
    console.error("POST /api/appointments/follow-up error:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
