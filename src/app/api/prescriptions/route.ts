import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { prescriptionSchema } from "@/lib/validations/prescription";
import { createPrescriptionWithId } from "@/lib/utils/prescription-id";
import { validateOrigin } from "@/lib/utils/csrf";

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

    const appointment = await prisma.appointment.findUnique({
      where: { id: data.appointmentId, clinicId: clinic.id },
      include: { prescription: true },
    });

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

    const { prescriptionId, record } = await createPrescriptionWithId(prisma, {
      clinicId: clinic.id,
      timezone: clinic.timezone,
      appointmentId: data.appointmentId,
      diagnosis: data.diagnosis,
      medications: data.medications,
      treatmentPlan: data.treatmentPlan || null,
      nextVisitDate: data.nextVisitDate || null,
      advice: data.advice || null,
      prescribedById: user.id,
    });

    return NextResponse.json(
      {
        success: true,
        prescriptionId,
        prescription: record,
        message: "Prescription created. Appointment confirmed.",
      },
      { status: 201 }
    );
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { success: false, error: "This appointment already has a prescription." },
        { status: 409 }
      );
    }

    console.error("POST /api/prescriptions error:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
