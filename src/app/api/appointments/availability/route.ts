/**
 * Appointment Availability API
 * GET /api/appointments/availability?date=YYYY-MM-DD&excludeAppointmentId=UUID
 *
 * Returns available and booked time slots for a given date.
 */

import { NextRequest, NextResponse } from "next/server";
import { DateTime } from "luxon";
import { generateSlotsForDate } from "@/lib/utils/time-slots";
import { buildClinicSchedule } from "@/lib/utils/clinic-schedule";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClinicContext } from "@/lib/utils/clinic-context";

export interface TimeSlotAvailability {
  time: string;
  datetime: string;
  available: boolean;
  count: number;
}

export interface AvailabilityResponse {
  success: boolean;
  date: string;
  slots: TimeSlotAvailability[];
  error?: string;
}

export async function GET(request: NextRequest) {
  try {
    const { clinic, error } = getClinicContext(request);
    if (error) return error;

    const supabaseTable = createAdminClient();
    const [{ data: clinicRow, error: clinicRowError }, supabase] = await Promise.all([
      supabaseTable
        .from("clinics")
        .select("timezone, businessHours, slotDuration")
        .eq("id", clinic.clinicId)
        .maybeSingle(),
      createClient(),
    ]);
    if (clinicRowError) throw clinicRowError;

    const scheduleConfig = buildClinicSchedule(clinicRow ?? { timezone: clinic.timezone, businessHours: null, slotDuration: null });

    const { data: { user } } = await supabase.auth.getUser();
    let isAdmin = false;
    if (user) {
      const { data: admin, error: adminError } = await supabaseTable
        .from("admins")
        .select("id")
        .eq("id", user.id)
        .eq("clinicId", clinic.clinicId)
        .maybeSingle();
      if (adminError) throw adminError;
      isAdmin = !!admin;
    }

    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");
    const excludeAppointmentId = searchParams.get("excludeAppointmentId");

    if (!dateParam) {
      return NextResponse.json(
        { success: false, error: "Date parameter is required (format: YYYY-MM-DD)" } as AvailabilityResponse,
        { status: 400 }
      );
    }

    const date = DateTime.fromISO(dateParam, { zone: scheduleConfig.timezone });

    if (!date.isValid) {
      return NextResponse.json(
        { success: false, error: `Invalid date format. Expected YYYY-MM-DD, got: ${dateParam}` } as AvailabilityResponse,
        { status: 400 }
      );
    }

    const slots = generateSlotsForDate(date, scheduleConfig);
    const startOfDay = date.startOf("day").toJSDate().toISOString();
    const endOfDay = date.endOf("day").toJSDate().toISOString();

    let appointmentsQuery = supabaseTable
      .from("appointments")
      .select("id, preferredDateTime")
      .eq("clinicId", clinic.clinicId)
      .gte("preferredDateTime", startOfDay)
      .lte("preferredDateTime", endOfDay)
      .in("status", ["PENDING", "OVERDUE", "CONFIRMED", "COMPLETED"]);

    if (excludeAppointmentId) {
      appointmentsQuery = appointmentsQuery.neq("id", excludeAppointmentId);
    }

    const { data: appointments, error: appointmentsError } = await appointmentsQuery;
    if (appointmentsError) throw appointmentsError;

    const slotCountMap = new Map<string, number>();
    for (const appointment of appointments) {
      // PostgREST returns timestamp columns without a zone; treat as UTC (see lib/supabase/serialize.ts).
      const appointmentTime = DateTime.fromISO(appointment.preferredDateTime + "Z", {
        zone: scheduleConfig.timezone,
      }).toFormat("HH:mm");
      slotCountMap.set(appointmentTime, (slotCountMap.get(appointmentTime) || 0) + 1);
    }

    const slotsWithAvailability: TimeSlotAvailability[] = slots.map((slot) => {
      const count = slotCountMap.get(slot.time) || 0;
      return {
        time: slot.time,
        datetime: slot.datetime,
        count: isAdmin ? count : 0,
        available: count === 0,
      };
    });

    return NextResponse.json({ success: true, date: dateParam, slots: slotsWithAvailability } as AvailabilityResponse);
  } catch (error) {
    console.error("Error fetching appointment availability:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch appointment availability. Please try again." } as AvailabilityResponse,
      { status: 500 }
    );
  }
}
