/**
 * TypeScript interfaces for DateSlotPicker components
 */

export interface TimeSlot {
  time: string; // HH:mm format (e.g., "10:00")
  datetime: string; // ISO 8601 string with timezone
  available: boolean; // true if slot is free, false if booked
  count: number; // Number of appointments at this slot
}

export interface SlotAvailability {
  date: string; // YYYY-MM-DD format
  slots: TimeSlot[];
}

export interface DateSlotPickerProps {
  value: string; // ISO datetime string (current selected value)
  onChange: (value: string) => void; // Callback when slot is selected
  timezone?: string; // IANA timezone (defaults to "Asia/Kolkata")
  minDate?: string; // YYYY-MM-DD (optional, for public 72hr limit)
  maxDate?: string; // YYYY-MM-DD (optional)
  disabled?: boolean; // Disable all interactions
  allowOverride?: boolean; // Admin only: allow booking booked slots
  onConflict?: (slot: TimeSlot) => void; // Admin only: callback when booked slot is clicked
  excludeAppointmentId?: string; // UUID to exclude from availability check (prevents self-conflict)
}

export interface DateSelectorProps {
  timezone: string; // IANA timezone
  minDate?: string; // YYYY-MM-DD
  maxDate?: string; // YYYY-MM-DD
  selectedDate: string; // YYYY-MM-DD
  onDateSelect: (date: string) => void;
  disabled?: boolean;
}

export interface SlotGridProps {
  date: string; // YYYY-MM-DD
  selectedSlot: string | null; // HH:mm or null
  onSlotSelect: (time: string, datetime: string) => void;
  allowOverride?: boolean;
  onConflict?: (slot: TimeSlot) => void;
  excludeAppointmentId?: string; // UUID to exclude from availability check
}

export interface SlotButtonProps {
  time: string; // HH:mm
  available: boolean;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
  count?: number; // Number of appointments (for admin view)
  allowOverride?: boolean; // Admin: allow clicking booked slots
}
