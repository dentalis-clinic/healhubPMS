import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { validateOrigin } from "@/lib/utils/csrf";

const updatePaymentSchema = z.object({
  amount: z.number().positive("Amount must be greater than 0").optional(),
  method: z.enum(["CASH", "UPI", "CARD", "WAIVED", "OTHER"]).optional(),
  notes: z.string().max(500).nullable().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const csrfError = validateOrigin(request);
    if (csrfError) return csrfError;

    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const { clinic } = auth;

    const { id } = await params;

    const body = await request.json();
    const parsed = updatePaymentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: z.prettifyError(parsed.error) },
        { status: 400 }
      );
    }

    const payment = await prisma.payment.findUnique({ where: { id, clinicId: clinic.id } });
    if (!payment) {
      return NextResponse.json({ success: false, error: "Payment not found" }, { status: 404 });
    }

    const updated = await prisma.payment.update({
      where: { id },
      data: {
        ...(parsed.data.amount !== undefined && { amount: parsed.data.amount }),
        ...(parsed.data.method !== undefined && { method: parsed.data.method }),
        ...(parsed.data.notes !== undefined && { notes: parsed.data.notes }),
      },
    });

    return NextResponse.json({
      success: true,
      payment: {
        id: updated.id,
        amount: Number(updated.amount),
        method: updated.method,
        notes: updated.notes,
        paidAt: updated.paidAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("PATCH /api/payments/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const csrfError = validateOrigin(request);
    if (csrfError) return csrfError;

    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const { clinic } = auth;

    const { id } = await params;

    const payment = await prisma.payment.findUnique({ where: { id, clinicId: clinic.id } });
    if (!payment) {
      return NextResponse.json({ success: false, error: "Payment not found" }, { status: 404 });
    }

    await prisma.payment.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/payments/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
