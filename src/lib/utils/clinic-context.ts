import { NextRequest, NextResponse } from "next/server";

export interface ClinicContext {
  clinicId: string;
  timezone: string;
  shortName: string;
}

/**
 * Read clinic context injected by middleware for public (non-admin) routes.
 * Returns the context on success, or a ready-to-return 503 response if missing.
 */
export function getClinicContext(
  request: NextRequest
): { clinic: ClinicContext; error: null } | { clinic: null; error: NextResponse } {
  const clinicId = request.headers.get("x-clinic-id");
  const timezone = request.headers.get("x-clinic-timezone");
  const shortName = request.headers.get("x-clinic-short-name");

  if (!clinicId || !timezone || !shortName) {
    return {
      clinic: null,
      error: NextResponse.json(
        { success: false, error: "Clinic not found or unavailable." },
        { status: 503 }
      ),
    };
  }

  return { clinic: { clinicId, timezone, shortName }, error: null };
}
