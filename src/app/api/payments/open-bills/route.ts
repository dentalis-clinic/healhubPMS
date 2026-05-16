import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";

/**
 * GET /api/payments/open-bills?patientId=<uuid>
 *
 * Returns all CONFIRMED/COMPLETED appointments for a patient that have
 * a totalAmount set but an outstanding balance > 0.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const { clinic } = auth;

    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get("patientId");

    if (!patientId) {
      return NextResponse.json(
        { success: false, error: "patientId is required" },
        { status: 400 }
      );
    }

    const appointments = await prisma.appointment.findMany({
      where: {
        clinicId: clinic.id,
        patient: { id: patientId },
        status: { not: "CANCELLED" },
        totalAmount: { not: null },
      },
      select: {
        id: true,
        appointmentId: true,
        preferredDateTime: true,
        status: true,
        totalAmount: true,
        reasonForVisit: true,
        payments: { select: { amount: true, method: true } },
      },
      orderBy: { preferredDateTime: "desc" },
    });

    const openBills = appointments
      .map((apt) => {
        const totalPaid = apt.payments.reduce((sum, p) => sum + Number(p.amount), 0);
        const amountDue = Number(apt.totalAmount);
        const balance = amountDue - totalPaid;

        return {
          appointmentId: apt.id,
          appointmentRef: apt.appointmentId,
          preferredDateTime: apt.preferredDateTime.toISOString(),
          status: apt.status,
          amountDue,
          totalPaid: Math.round(totalPaid * 100) / 100,
          balance: Math.round(balance * 100) / 100,
          reasonForVisit: apt.reasonForVisit,
        };
      })
      .filter((bill) => bill.balance > 0);

    return NextResponse.json({ success: true, openBills });
  } catch (error) {
    console.error("GET /api/payments/open-bills error:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
