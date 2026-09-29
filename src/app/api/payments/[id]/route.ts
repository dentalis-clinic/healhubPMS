import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { requireAdmin } from "@/lib/auth/require-admin";
import { validateOrigin } from "@/lib/utils/csrf";
import { createAdminClient } from "@/lib/supabase/admin";
import { utcIso } from "@/lib/supabase/serialize";
import type { TablesUpdate } from "@/generated/supabase/database.types";

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

    const supabase = createAdminClient();
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .select("id")
      .eq("id", id)
      .eq("clinicId", clinic.id)
      .maybeSingle();
    if (paymentError) throw paymentError;
    if (!payment) {
      return NextResponse.json({ success: false, error: "Payment not found" }, { status: 404 });
    }

    const updateData: TablesUpdate<"payments"> = {};
    if (parsed.data.amount !== undefined) updateData.amount = parsed.data.amount;
    if (parsed.data.method !== undefined) updateData.method = parsed.data.method;
    if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes;

    const { data: updated, error: updateError } = await supabase
      .from("payments")
      .update(updateData)
      .eq("id", id)
      .eq("clinicId", clinic.id)
      .select()
      .single();
    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      payment: {
        id: updated.id,
        amount: Number(updated.amount),
        method: updated.method,
        notes: updated.notes,
        paidAt: utcIso(updated.paidAt),
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
    const supabase = createAdminClient();

    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .select("id")
      .eq("id", id)
      .eq("clinicId", clinic.id)
      .maybeSingle();
    if (paymentError) throw paymentError;
    if (!payment) {
      return NextResponse.json({ success: false, error: "Payment not found" }, { status: 404 });
    }

    const { error: deleteError } = await supabase
      .from("payments")
      .delete()
      .eq("id", id)
      .eq("clinicId", clinic.id);
    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/payments/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
