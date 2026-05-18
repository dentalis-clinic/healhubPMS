/**
 * DateSlotPicker component
 * Main component that combines date selection and time slot selection
 */

"use client";

import React, { useState, useMemo } from "react";
import { DateTime } from "luxon";
import { DateSelector } from "./DateSelector";
import { SlotGrid } from "./SlotGrid";
import { DateSlotPickerProps, TimeSlot } from "./types";
const DEFAULT_TIMEZONE = "Asia/Kolkata";

export const DateSlotPicker: React.FC<DateSlotPickerProps> = ({
  value,
  onChange,
  timezone = DEFAULT_TIMEZONE,
  minDate,
  maxDate,
  disabled = false,
  allowOverride = false,
  onConflict,
  excludeAppointmentId,
}) => {
  // Parse current value to extract date and time
  const parsedValue = useMemo(() => {
    if (!value) return null;

    try {
      const datetime = DateTime.fromISO(value, { zone: timezone });
      if (!datetime.isValid) return null;

      return {
        date: datetime.toFormat("yyyy-MM-dd"),
        time: datetime.toFormat("HH:mm"),
      };
    } catch {
      return null;
    }
  }, [value, timezone]);

  // State for selected date and time
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    if (parsedValue?.date) return parsedValue.date;

    // Default to today if no value
    const today = DateTime.now().setZone(timezone);
    const todayStr = today.toFormat("yyyy-MM-dd");

    // Check if today is within min/max range
    if (minDate && todayStr < minDate) return minDate;
    if (maxDate && todayStr > maxDate) return maxDate;

    return todayStr;
  });

  const [selectedTime, setSelectedTime] = useState<string | null>(
    parsedValue?.time || null
  );

  // Sync state when value prop changes (React-recommended render-phase pattern)
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    if (parsedValue) {
      setSelectedDate(parsedValue.date);
      setSelectedTime(parsedValue.time);
    }
  }

  // Handle date selection
  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    // Clear time selection when date changes
    setSelectedTime(null);
  };

  // Handle slot selection
  const handleSlotSelect = (time: string, datetime: string) => {
    setSelectedTime(time);
    // Call onChange with full ISO datetime
    onChange(datetime);
  };

  // Handle conflict (admin only)
  const handleConflict = (slot: TimeSlot) => {
    if (onConflict) {
      onConflict(slot);
    }
  };

  return (
    <div className="space-y-6">
      {/* Date selector */}
      <DateSelector
        timezone={timezone}
        minDate={minDate}
        maxDate={maxDate}
        selectedDate={selectedDate}
        onDateSelect={handleDateSelect}
        disabled={disabled}
      />

      {/* Time slot grid */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-3">
          Select Time Slot
        </h3>
        <SlotGrid
          date={selectedDate}
          selectedSlot={selectedTime}
          onSlotSelect={handleSlotSelect}
          allowOverride={allowOverride}
          onConflict={handleConflict}
          excludeAppointmentId={excludeAppointmentId}
        />
      </div>
    </div>
  );
};

export default DateSlotPicker;
