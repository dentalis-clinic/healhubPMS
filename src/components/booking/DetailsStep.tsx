"use client";

import { Alert, FormField, Input } from "@/components/ui";
import { DateSlotPicker } from "@/components/ui/DateSlotPicker";

interface DetailsStepProps {
  name: string;
  onNameChange: (value: string) => void;
  preferredDateTime: string;
  onDateTimeChange: (value: string) => void;
  minDateTime: string;
  maxDateTime: string;
  disabled: boolean;
  showNameField: boolean;
  contextMessage: string | null;
  timezone?: string;
}

export function DetailsStep({
  name,
  onNameChange,
  preferredDateTime,
  onDateTimeChange,
  minDateTime,
  maxDateTime,
  disabled,
  showNameField,
  contextMessage,
  timezone,
}: DetailsStepProps) {
  // Extract date portion (YYYY-MM-DD) from datetime strings for DateSlotPicker
  const minDate = minDateTime.split("T")[0];
  const maxDate = maxDateTime.split("T")[0];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 space-y-4 duration-300">
      {contextMessage && <Alert variant="info">{contextMessage}</Alert>}

      {showNameField && (
        <FormField label="Full Name" htmlFor="name">
          <Input
            id="name"
            type="text"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            required
            maxLength={100}
            autoComplete="name"
            placeholder="Enter your full name"
            disabled={disabled}
          />
        </FormField>
      )}

      <div>
        <DateSlotPicker
          value={preferredDateTime}
          onChange={onDateTimeChange}
          timezone={timezone}
          minDate={minDate}
          maxDate={maxDate}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
