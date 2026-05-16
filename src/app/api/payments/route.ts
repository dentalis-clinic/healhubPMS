import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { validateOrigin } from "@/lib/utils/csrf";

const createPaymentSchema = z.object({
  appointmentId: z.string().uuid("Invalid appointment ID"),
  amount: z.number().positive("Amount must be greater than 0"),
  method: z.enum(["CASH", "UPI", "CARD", "WAIVED", "OTHER"]),
  notes: z.string().max(500).optional().nullable(),
  paidAt: z.string().datetime().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const csrfError = validateOrigin(request);
    if (csrfError) return csrfError;

    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const { admin, clinic } = auth;

    const body = await request.json();
    const parsed = createPaymentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: z.prettifyError(parsed.error) },
        { status: 400 }
      );
    }

    const { appointmentId, amount, method, notes, paidAt } = parsed.data;

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId, clinicId: clinic.id },
      select: { id: true, status: true, totalAmount: true },
    });

    if (!appointment) {
      return NextResponse.json(
        { success: false, error: "Appointment not found" },
        { status: 404 }
      );
    }

    if (appointment.status === "CANCELLED") {
      return NextResponse.json(
        { success: false, error: "Cannot record payment for a cancelled appointment." },
        { status: 400 }
      );
    }

    const payment = await prisma.payment.create({
      data: {
        clinicId: clinic.id,
        appointmentId,
        amount,
        method,
        notes: notes ?? null,
        paidAt: paidAt ? new Date(paidAt) : new Date(),
        recordedById: admin.id,
      },
      include: { recordedBy: { select: { id: true, name: true } } },
    });

    return NextResponse.json(
      {
        success: true,
        payment: {
          id: payment.id,
          appointmentId: payment.appointmentId,
          amount: Number(payment.amount),
          method: payment.method,
          notes: payment.notes,
          paidAt: payment.paidAt.toISOString(),
          recordedBy: payment.recordedBy,
          createdAt: payment.createdAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/payments error:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const { clinic } = auth;

    const { searchParams } = new URL(request.url);
    const appointmentId = searchParams.get("appointmentId");

    if (!appointmentId) {
      return NextResponse.json(
        { success: false, error: "appointmentId is required" },
        { status: 400 }
      );
    }

    const payments = await prisma.payment.findMany({
      where: { clinicId: clinic.id, appointmentId },
      include: { recordedBy: { select: { id: true, name: true } } },
      orderBy: { paidAt: "asc" },
    });

    const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);

    return NextResponse.json({
      success: true,
      payments: payments.map((p) => ({
        id: p.id,
        appointmentId: p.appointmentId,
        amount: Number(p.amount),
        method: p.method,
        notes: p.notes,
        paidAt: p.paidAt.toISOString(),
        recordedBy: p.recordedBy,
        createdAt: p.createdAt.toISOString(),
      })),
      totalPaid,
    });
  } catch (error) {
    console.error("GET /api/payments error:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
