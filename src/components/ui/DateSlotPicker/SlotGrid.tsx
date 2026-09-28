/**
 * SlotGrid component
 * Fetches and displays available time slots for a selected date
 */

"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { DateTime } from "luxon";
import { SlotButton } from "./SlotButton";
import { SlotGridProps, TimeSlot } from "./types";
import type { ApiJson } from "@/types/api";

interface CachedAvailability {
  data: TimeSlot[];
  timestamp: number;
}

const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

export const SlotGrid: React.FC<SlotGridProps> = ({
  date,
  selectedSlot,
  onSlotSelect,
  allowOverride = false,
  onConflict,
  excludeAppointmentId,
}) => {
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [cache, setCache] = useState<Map<string, CachedAvailability>>(
    new Map()
  );

  // Fetch availability from API
  const cacheRef = React.useRef(cache);
  cacheRef.current = cache;

  const fetchAvailability = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Check cache first
      const cachedData = cacheRef.current.get(date);
      if (cachedData && Date.now() - cachedData.timestamp < CACHE_TTL_MS) {
        setSlots(cachedData.data);
        setLoading(false);
        return;
      }

      // Build URL with query params
      const params = new URLSearchParams({ date });
      if (excludeAppointmentId) {
        params.append("excludeAppointmentId", excludeAppointmentId);
      }

      const response = await fetch(
        `/api/appointments/availability?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch availability");
      }

      const data = (await response.json()) as ApiJson & { slots: TimeSlot[] };

      if (!data.success) {
        throw new Error(data.error || "Failed to fetch availability");
      }

      // Update cache
      setCache((prev) => {
        const newCache = new Map(prev);
        newCache.set(date, {
          data: data.slots,
          timestamp: Date.now(),
        });
        return newCache;
      });

      setSlots(data.slots);
    } catch (err) {
      console.error("Error fetching availability:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load available time slots"
      );
    } finally {
      setLoading(false);
    }
  }, [date, excludeAppointmentId]);

  // Fetch availability when date changes
  useEffect(() => {
    fetchAvailability();
  }, [fetchAvailability]);

  // Filter out past slots if selected date is today
  // Must be called before any early returns to maintain hook order
  const filteredSlots = useMemo(() => {
    const now = DateTime.now().setZone("Asia/Kolkata");
    const selectedDate = DateTime.fromISO(date, { zone: "Asia/Kolkata" });

    if (selectedDate.startOf("day").equals(now.startOf("day"))) {
      return slots.filter((slot) => {
        const slotDateTime = DateTime.fromISO(slot.datetime);
        return slotDateTime > now;
      });
    }

    return slots;
  }, [slots, date]);

  // Handle slot click
  const handleSlotClick = (slot: TimeSlot) => {
    if (!slot.available && allowOverride && onConflict) {
      onConflict(slot);
      return;
    }

    if (slot.available) {
      onSlotSelect(slot.time, slot.datetime);
    }
  };

  // Group slots by session (morning vs evening)
  const groupSlotsBySession = (slotsToGroup: TimeSlot[]): {
    morning: TimeSlot[];
    evening: TimeSlot[];
  } => {
    const morning: TimeSlot[] = [];
    const evening: TimeSlot[] = [];

    for (const slot of slotsToGroup) {
      const hour = parseInt(slot.time.split(":")[0]);
      if (hour < 14) {
        morning.push(slot);
      } else {
        evening.push(slot);
      }
    }

    return { morning, evening };
  };

  // Loading state
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="h-14 bg-gray-100 rounded-lg animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
        <p className="text-sm text-red-800 mb-3">{error}</p>
        <button
          type="button"
          onClick={fetchAvailability}
          className="px-4 py-2 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-md hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          Retry
        </button>
      </div>
    );
  }

  const { morning, evening } = groupSlotsBySession(filteredSlots);

  // No slots available message
  if (filteredSlots.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
        <p className="text-sm text-gray-600">
          No appointment slots available for this date.
        </p>
      </div>
    );
  }

  // Check if all slots are booked
  const allBooked = filteredSlots.every((slot) => !slot.available);

  return (
    <div className="space-y-6">
      {allBooked && !allowOverride && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-center">
          <p className="text-sm text-amber-800">
            All slots are booked for this date. Please choose another day.
          </p>
        </div>
      )}

      {/* Morning session */}
      {morning.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            Morning (10:00 AM - 2:00 PM)
          </h3>
          <div
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3"
            role="radiogroup"
            aria-label="Morning time slots"
          >
            {morning.map((slot) => (
              <SlotButton
                key={slot.time}
                time={slot.time}
                available={slot.available}
                selected={selectedSlot === slot.time}
                onClick={() => handleSlotClick(slot)}
                count={slot.count}
                allowOverride={allowOverride}
              />
            ))}
          </div>
        </div>
      )}

      {/* Evening session */}
      {evening.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            Evening (4:00 PM - 10:00 PM)
          </h3>
          <div
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3"
            role="radiogroup"
            aria-label="Evening time slots"
          >
            {evening.map((slot) => (
              <SlotButton
                key={slot.time}
                time={slot.time}
                available={slot.available}
                selected={selectedSlot === slot.time}
                onClick={() => handleSlotClick(slot)}
                count={slot.count}
                allowOverride={allowOverride}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
