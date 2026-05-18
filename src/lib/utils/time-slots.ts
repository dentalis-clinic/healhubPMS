import { DateTime } from "luxon";
import type { ClinicScheduleConfig } from "@/lib/utils/clinic-schedule";

export interface TimeSlot {
  time: string;     // HH:mm
  datetime: string; // ISO 8601 with timezone
}

export function generateSlotsForDate(date: DateTime, config: ClinicScheduleConfig): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const dateInZone = date.setZone(config.timezone);

  for (const session of config.businessHours) {
    const [startHour, startMinute] = session.start.split(":").map(Number);
    const [endHour, endMinute] = session.end.split(":").map(Number);

    let currentSlot = dateInZone.set({ hour: startHour, minute: startMinute, second: 0, millisecond: 0 });
    const sessionEnd = dateInZone.set({ hour: endHour, minute: endMinute, second: 0, millisecond: 0 });

    while (currentSlot < sessionEnd) {
      slots.push({ time: currentSlot.toFormat("HH:mm"), datetime: currentSlot.toISO()! });
      currentSlot = currentSlot.plus({ minutes: config.slotDuration });
    }
  }

  return slots;
}

export function isSlotWithinBusinessHours(datetime: DateTime, config: ClinicScheduleConfig): boolean {
  const timeInZone = datetime.setZone(config.timezone);
  const minutesSinceMidnight = timeInZone.hour * 60 + timeInZone.minute;

  for (const session of config.businessHours) {
    const [startHour, startMinute] = session.start.split(":").map(Number);
    const [endHour, endMinute] = session.end.split(":").map(Number);
    const sessionStart = startHour * 60 + startMinute;
    const sessionEnd = endHour * 60 + endMinute;

    if (minutesSinceMidnight >= sessionStart && minutesSinceMidnight < sessionEnd) {
      return true;
    }
  }
  return false;
}

export function roundToNearestSlot(datetime: DateTime, config: ClinicScheduleConfig): DateTime {
  const timeInZone = datetime.setZone(config.timezone);
  const minutesSinceMidnight = timeInZone.hour * 60 + timeInZone.minute;
  const roundedMinutes = Math.round(minutesSinceMidnight / config.slotDuration) * config.slotDuration;
  return timeInZone.set({
    hour: Math.floor(roundedMinutes / 60),
    minute: roundedMinutes % 60,
    second: 0,
    millisecond: 0,
  });
}

export function isSlotAligned(datetime: DateTime, config: ClinicScheduleConfig): boolean {
  return datetime.equals(roundToNearestSlot(datetime, config));
}
