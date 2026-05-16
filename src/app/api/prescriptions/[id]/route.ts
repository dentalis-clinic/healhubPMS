import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const { clinic } = auth;

    const { id } = await params;

    // Support lookup by UUID or prescriptionId (RX-...)
    const isRxId = id.startsWith("RX-");
    const prescription = await prisma.prescription.findUnique({
      where: isRxId
        ? { prescriptionId: id, clinicId: clinic.id }
        : { id, clinicId: clinic.id },
      include: {
        appointment: { include: { patient: true } },
        prescribedBy: { select: { id: true, name: true, email: true } },
      },
    });

    if (!prescription) {
      return NextResponse.json(
        { success: false, error: "Prescription not found" },
        { status: 404 }
      );
    }

    const serialized = {
      ...prescription,
      createdAt: prescription.createdAt.toISOString(),
      updatedAt: prescription.updatedAt.toISOString(),
      nextVisitDate: prescription.nextVisitDate?.toISOString() ?? null,
      appointment: {
        ...prescription.appointment,
        createdAt: prescription.appointment.createdAt.toISOString(),
        updatedAt: prescription.appointment.updatedAt.toISOString(),
        preferredDateTime: prescription.appointment.preferredDateTime.toISOString(),
        patient: {
          ...prescription.appointment.patient,
          createdAt: prescription.appointment.patient.createdAt.toISOString(),
          updatedAt: prescription.appointment.patient.updatedAt.toISOString(),
          age: prescription.appointment.patient.age,
        },
      },
    };

    return NextResponse.json({ success: true, prescription: serialized });
  } catch (error) {
    console.error("GET /api/prescriptions/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
