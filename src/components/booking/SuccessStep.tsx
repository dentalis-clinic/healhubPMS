"use client";

import { Button } from "@/components/ui";
import { formatISTDateTime } from "@/lib/utils/date";

interface SuccessStepProps {
  patientId: string;
  preferredDateTime: string;
  onReset: () => void;
  clinicPhone?: string;
}

export function SuccessStep({
  patientId,
  preferredDateTime,
  onReset,
  clinicPhone,
}: SuccessStepProps) {
  return (
    <div className="rounded-lg border border-border-success/20 bg-surface-success p-6 text-center">
      <div className="mb-2 text-lg font-semibold text-text-success">
        Appointment Booked
      </div>
      <p className="mb-3 text-sm text-text-success">
        Your appointment is scheduled for:
      </p>
      <div className="mb-3 text-lg font-bold text-text-success">
        {formatISTDateTime(new Date(preferredDateTime))}
      </div>
      <p className="mb-4 text-sm text-text-success">
        Please arrive <span className="font-bold">15 mins</span> prior to your scheduled appointment to complete registration formalities and avoid any waiting rush.
      </p>
      <p className="mb-4 text-sm text-text-success">
        {clinicPhone && <>For any queries or rescheduling, please contact us at {clinicPhone}.</>}
      </p>
      <p className="mb-4 text-xs text-text-success/70">
        Patient ID: {patientId}
      </p>
      <Button variant="success" onClick={onReset}>
        Book Another Appointment
      </Button>
    </div>
  );
}
