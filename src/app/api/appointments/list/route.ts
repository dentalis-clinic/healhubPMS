import { NextRequest, NextResponse } from "next/server";
import { DateTime } from "luxon";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { serializeAppointmentWithRelations, type AppointmentWithRelationsRow } from "@/lib/supabase/serialize";
import type { Enums } from "@/generated/supabase/database.types";

const PAGE_SIZE_DEFAULT = 30;
const PAGE_SIZE_MAX = 100;

const SORT_COLUMNS: Record<string, string> = {
  createdAt: "createdAt",
  preferredDateTime: "preferredDateTime",
  status: "status",
};

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const { clinic } = auth;

    const { searchParams } = request.nextUrl;
    const q = searchParams.get("q")?.trim() ?? "";
    const statusFilter = searchParams.get("status") ?? "";
    const typeFilter = searchParams.get("type") ?? "";
    const dateFilter = searchParams.get("dateFilter") ?? "all";
    const sortColumn = SORT_COLUMNS[searchParams.get("sortBy") ?? ""] ?? "createdAt";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const pageSize = Math.min(
      PAGE_SIZE_MAX,
      Math.max(1, parseInt(searchParams.get("pageSize") ?? String(PAGE_SIZE_DEFAULT), 10))
    );

    const supabase = createAdminClient();

    // Free-text search: resolve to matching patient ids first (via the same
    // literal-matching RPC api/patients uses — no ilike/wildcard-injection risk
    // from building a raw PostgREST filter string out of user input), then
    // filter appointments by patientId. A no-match search short-circuits to an
    // empty result: `.in("patientId", [])` is not safe to send as-is.
    let patientIdFilter: string[] | null = null;
    if (q) {
      const { data: matches, error: searchError } = await supabase.rpc("search_patients", {
        p_clinic_id: clinic.id,
        p_search: q,
      });
      if (searchError) throw searchError;
      patientIdFilter = matches.map((m) => m.id);
      if (patientIdFilter.length === 0) {
        return NextResponse.json({ success: true, appointments: [], total: 0, page, pageSize });
      }
    }

    let query = supabase
      .from("appointments")
      .select(
        "*, patient:patients(*), prescription:prescriptions(id, prescriptionId), doctor:doctors(id, name, qualifications), payments(amount, method)",
        { count: "exact" }
      )
      .eq("clinicId", clinic.id);

    if (patientIdFilter) query = query.in("patientId", patientIdFilter);

    if (dateFilter === "today" || dateFilter === "upcoming") {
      const now = DateTime.now().setZone(clinic.timezone);
      const todayStart = now.startOf("day").toJSDate().toISOString();
      const tomorrowStart = now.plus({ days: 1 }).startOf("day").toJSDate().toISOString();

      if (dateFilter === "today") {
        query = query.gte("preferredDateTime", todayStart).lt("preferredDateTime", tomorrowStart);
      } else {
        query = query.gte("preferredDateTime", tomorrowStart).neq("status", "CANCELLED");
      }
    }

    // Matches the original: an unrecognized status value is passed through
    // as-is (PostgREST returns zero rows rather than erroring, same as Prisma did).
    if (statusFilter) query = query.eq("status", statusFilter as Enums<"AppointmentStatus">);

    if (typeFilter === "FOLLOW_UP") query = query.eq("visitType", "FOLLOW_UP");
    else if (typeFilter === "ONLINE") query = query.eq("bookingChannel", "ONLINE");
    else if (typeFilter === "WALK_IN") query = query.eq("bookingChannel", "WALK_IN");

    const { data: appointments, count, error } = await query
      .order(sortColumn, { ascending: sortOrder === "asc" })
      .range((page - 1) * pageSize, (page - 1) * pageSize + pageSize - 1);
    if (error) throw error;

    return NextResponse.json({
      success: true,
      appointments: (appointments as AppointmentWithRelationsRow[]).map(serializeAppointmentWithRelations),
      total: count ?? 0,
      page,
      pageSize,
    });
  } catch (error) {
    console.error("GET /api/appointments/list error:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
