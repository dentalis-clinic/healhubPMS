/**
 * DateSelector component
 * Displays a horizontal list of date buttons for selection
 */

"use client";

import React, { useMemo } from "react";
import { DateTime } from "luxon";
import { DateSelectorProps } from "./types";

export const DateSelector: React.FC<DateSelectorProps> = ({
  timezone,
  minDate,
  maxDate,
  selectedDate,
  onDateSelect,
  disabled = false,
}) => {
  // Generate array of available dates
  const availableDates = useMemo(() => {
    const dates: Array<{ value: string; label: string }> = [];

    const today = DateTime.now().setZone(timezone);

    // Format date label for display
    const formatDateLabel = (date: DateTime, today: DateTime): string => {
      // Compare dates at start of day to avoid time-of-day issues
      const dateStart = date.startOf("day");
      const todayStart = today.startOf("day");
      const daysDiff = Math.round(dateStart.diff(todayStart, "days").days);

      if (daysDiff === 0) {
        return "Today";
      } else if (daysDiff === 1) {
        return "Tomorrow";
      } else {
        // Show day of week + date (e.g., "Wed, Feb 29")
        return date.toFormat("ccc, MMM d");
      }
    };

    // Determine date range
    const min = minDate
      ? DateTime.fromISO(minDate, { zone: timezone })
      : today;
    const max = maxDate
      ? DateTime.fromISO(maxDate, { zone: timezone })
      : today.plus({ days: 2 }); // Default: show today + next 2 days

    let current = min;

    while (current <= max) {
      const value = current.toFormat("yyyy-MM-dd");
      const label = formatDateLabel(current, today);

      dates.push({ value, label });
      current = current.plus({ days: 1 });
    }

    return dates;
  }, [minDate, maxDate, timezone]);

  // Button style classes
  const getButtonClasses = (isSelected: boolean): string => {
    const baseClasses =
      "px-6 py-3 rounded-lg border font-medium text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 whitespace-nowrap";

    if (disabled) {
      return `${baseClasses} bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed`;
    }

    if (isSelected) {
      return `${baseClasses} bg-blue-600 text-white border-blue-600 shadow-sm`;
    }

    return `${baseClasses} bg-white text-gray-900 border-gray-300 hover:border-blue-500 hover:bg-blue-50 cursor-pointer`;
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-gray-700">Select Date</h3>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {availableDates.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => onDateSelect(value)}
            disabled={disabled}
            className={getButtonClasses(selectedDate === value)}
            aria-pressed={selectedDate === value}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
};
