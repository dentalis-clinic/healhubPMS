"use client";

import { Alert, Button } from "@/components/ui";
import { formatISTDateTime } from "@/lib/utils/date";
import type { MaskedPatient } from "@/types/patient";
import type { PhoneCheckStatus } from "@/types/patient";

interface PatientSelectorProps {
  status: PhoneCheckStatus;
  patients: MaskedPatient[];
  selectedPatientId: string | null;
  blockedPatient: { maskedName: string; pendingDate: string } | null;
  onSelectPatient: (patientId: string) => void;
  onSelectNewPatient: () => void;
  onSelectDifferentPerson: () => void;
  clinicPhone?: string;
}

export function PatientSelector({
  status,
  patients,
  selectedPatientId,
  blockedPatient,
  onSelectPatient,
  onSelectNewPatient,
  onSelectDifferentPerson,
  clinicPhone,
}: PatientSelectorProps) {
  // Scenario D: single patient, all pending → blocked message
  if (patients.length === 1 && patients[0].hasPending) {
    return (
      <SinglePendingBlock
        patient={patients[0]}
        onDifferentPerson={onSelectDifferentPerson}
        clinicPhone={clinicPhone}
      />
    );
  }

  // Blocked state: user selected a patient that has pending
  if (blockedPatient) {
    return (
      <Alert variant="warning">
        <p className="font-medium">
          {blockedPatient.maskedName} already has a pending appointment on:
        </p>
        <p className="mt-1 font-bold">
          {formatISTDateTime(new Date(blockedPatient.pendingDate))}
        </p>
        <p className="mt-2 text-xs">
          {clinicPhone && <>To reschedule or cancel, contact us at {clinicPhone}.</>}
        </p>
      </Alert>
    );
  }

  const isSingle = patients.length === 1;

  // Scenario B: single patient, no pending → confirmation
  if (isSingle && !selectedPatientId) {
    const patient = patients[0];
    return (
      <Alert variant="info">
        <p className="font-medium">Welcome back! Is this you?</p>
        <p className="mt-1.5 font-mono text-base tracking-wide">
          {patient.maskedName}
        </p>
        <div className="mt-3 flex gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() => onSelectPatient(patient.id)}
          >
            Yes, that&apos;s me
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onSelectNewPatient}
          >
            No, I&apos;m a new patient
          </Button>
        </div>
      </Alert>
    );
  }

  // Scenario C/E: multiple patients → radio list
  if (!isSingle && !selectedPatientId) {
    const label =
      status === "has_pending"
        ? "Who is this appointment for?"
        : "We found profiles for this number. Who is this appointment for?";

    return (
      <Alert variant="info">
        <p className="font-medium">{label}</p>
        <div className="mt-3 space-y-2">
          {patients.map((p) => (
            <label
              key={p.id}
              className={`flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 transition-colors ${p.hasPending
                  ? "border-border-warning/40 bg-surface-warning/30"
                  : "border-border-secondary hover:bg-surface-secondary"
                }`}
            >
              <input
                type="radio"
                name="patient-select"
                value={p.id}
                onChange={() => onSelectPatient(p.id)}
                className="mt-0.5"
              />
              <div>
                <span className="font-mono tracking-wide">{p.maskedName}</span>
                {p.hasPending && p.pendingDate && (
                  <span className="ml-2 text-xs text-text-warning">
                    Pending: {formatISTDateTime(new Date(p.pendingDate))}
                  </span>
                )}
              </div>
            </label>
          ))}
          <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border-secondary px-3 py-2 hover:bg-surface-secondary">
            <input
              type="radio"
              name="patient-select"
              value="new"
              onChange={onSelectNewPatient}
              className="mt-0.5"
            />
            <span>I&apos;m a new patient</span>
          </label>
        </div>
      </Alert>
    );
  }

  return null;
}

function SinglePendingBlock({
  patient,
  onDifferentPerson,
  clinicPhone,
}: {
  patient: MaskedPatient;
  onDifferentPerson: () => void;
  clinicPhone?: string;
}) {
  return (
    <div className="space-y-3">
      <Alert variant="warning">
        <p className="font-medium">
          You already have a pending appointment on:
        </p>
        <p className="mt-1 text-base font-bold">
          {patient.pendingDate
            ? formatISTDateTime(new Date(patient.pendingDate))
            : ""}
        </p>
        <p className="mt-2 text-xs">
          {clinicPhone && <>To reschedule or cancel, please contact us at {clinicPhone}.</>}
        </p>
      </Alert>
      <Button
        type="button"
        variant="secondary"
        fullWidth
        onClick={onDifferentPerson}
      >
        I&apos;m booking for a different person
      </Button>
    </div>
  );
}
