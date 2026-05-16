import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { bulkCancelSchema } from "@/lib/validations/appointment";
import { validateOrigin } from "@/lib/utils/csrf";

export async function PATCH(request: NextRequest) {
  try {
    const csrfError = validateOrigin(request);
    if (csrfError) return csrfError;

    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const { clinic } = auth;

    const body = await request.json();
    const parsed = bulkCancelSchema.safeParse(body);

    if (!parsed.success) {
      const errors = z.prettifyError(parsed.error);
      return NextResponse.json(
        { success: false, error: "Validation failed", details: errors },
        { status: 400 }
      );
    }

    const { ids } = parsed.data;

    const result = await prisma.appointment.updateMany({
      where: {
        clinicId: clinic.id,
        id: { in: ids },
        status: { in: ["PENDING", "OVERDUE"] },
      },
      data: { status: "CANCELLED" },
    });

    const skipped = ids.length - result.count;

    return NextResponse.json({ success: true, cancelled: result.count, skipped });
  } catch (error) {
    console.error("PATCH /api/appointments/bulk-cancel error:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
