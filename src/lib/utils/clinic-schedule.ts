export interface BusinessHoursSession {
  start: string; // HH:mm
  end: string;   // HH:mm
}

export interface ClinicScheduleConfig {
  timezone: string;
  businessHours: BusinessHoursSession[];
  slotDuration: number; // minutes
}

export const DEFAULT_BUSINESS_HOURS: BusinessHoursSession[] = [
  { start: "10:00", end: "14:00" },
  { start: "16:00", end: "22:00" },
];

export const DEFAULT_SLOT_DURATION = 30;

export function buildClinicSchedule(clinic: {
  timezone: string;
  businessHours: unknown;
  slotDuration: number | null;
}): ClinicScheduleConfig {
  return {
    timezone: clinic.timezone,
    businessHours: (clinic.businessHours as BusinessHoursSession[] | null) ?? DEFAULT_BUSINESS_HOURS,
    slotDuration: clinic.slotDuration ?? DEFAULT_SLOT_DURATION,
  };
}
