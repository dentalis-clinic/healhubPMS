import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { validateOrigin } from "@/lib/utils/csrf";
import { createAdminClient } from "@/lib/supabase/admin";
import { utcIso } from "@/lib/supabase/serialize";
import type { Database } from "@/generated/supabase/database.types";

// Typegen marks every RETURNS TABLE column non-null; these can be null at runtime.
type PatientSearchRow = Omit<
  Database["public"]["Functions"]["search_patients"]["Returns"][number],
  "email" | "age" | "sex" | "address" | "lastVisit"
> & {
  email: string | null;
  age: number | null;
  sex: Database["public"]["Enums"]["Sex"] | null;
  address: string | null;
  lastVisit: string | null;
};

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const { clinic } = auth;

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search")?.trim() ?? "";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)));
    const skip = (page - 1) * limit;

    // Set-returning RPC: PostgREST applies order/range/count to it like a table.
    const { data, count, error } = await createAdminClient()
      .rpc("search_patients", { p_clinic_id: clinic.id, p_search: search }, { count: "exact" })
      .order("createdAt", { ascending: false })
      .range(skip, skip + limit - 1);
    if (error) throw error;

    const rows: PatientSearchRow[] = data;
    const result = rows.map((p) => ({
      id: p.id,
      patientId: p.patientId,
      name: p.name,
      phone: p.phone,
      email: p.email,
      age: p.age,
      sex: p.sex,
      address: p.address,
      createdAt: utcIso(p.createdAt),
      totalVisits: p.totalVisits,
      lastVisit: utcIso(p.lastVisit),
    }));

    return NextResponse.json({ success: true, patients: result, total: count ?? 0, page, limit });
  } catch (error) {
    console.error("GET /api/patients error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch patients" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const csrfError = validateOrigin(request);
    if (csrfError) return csrfError;

    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const { clinic } = auth;

    const body = (await request.json()) as Record<string, unknown>;
    const ids: unknown = body.ids;

    if (!Array.isArray(ids) || ids.length === 0 || ids.some((id) => typeof id !== "string")) {
      return NextResponse.json(
        { success: false, error: "ids must be a non-empty array of strings" },
        { status: 400 }
      );
    }

    // Cascades appointments + their prescriptions/payments; ignores other clinics' ids.
    const { data: deleted, error } = await createAdminClient().rpc("delete_patients", {
      p_clinic_id: clinic.id,
      p_ids: ids as string[],
    });
    if (error) throw error;

    return NextResponse.json({ success: true, deleted });
  } catch (error) {
    console.error("DELETE /api/patients error:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
