"use client";

import { FormEvent } from "react";
import { Alert, Button } from "@/components/ui";
import { useBookingFlow } from "./useBookingFlow";
import { PhoneStep } from "./PhoneStep";
import { PatientSelector } from "./PatientSelector";
import { DetailsStep } from "./DetailsStep";
import { SuccessStep } from "./SuccessStep";

interface PublicBookingFormProps {
  timezone?: string;
  clinicPhone?: string;
}

export default function PublicBookingForm({ timezone, clinicPhone }: PublicBookingFormProps) {
  const flow = useBookingFlow();

  // Success screen replaces the form
  if (flow.submitState.step === "success") {
    return (
      <SuccessStep
        patientId={flow.submitState.patientId}
        preferredDateTime={flow.submitState.preferredDateTime}
        onReset={flow.handleReset}
        clinicPhone={clinicPhone}
      />
    );
  }

  const isSubmitting = flow.submitState.step === "submitting";

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    flow.handleSubmit();
  }

  // Determine patient selector props
  const phoneResult =
    flow.phoneState.step === "result" ? flow.phoneState : null;
  const blockedPatient =
    flow.selection.kind === "blocked"
      ? {
          maskedName: flow.selection.maskedName,
          pendingDate: flow.selection.pendingDate,
        }
      : null;
  const selectedPatientId =
    flow.selection.kind === "existing" ? flow.selection.patientId : null;

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-lg border border-border-primary bg-surface-primary p-6 shadow-sm"
    >
      {flow.submitState.step === "error" && (
        <Alert variant="error">{flow.submitState.message}</Alert>
      )}

      <PhoneStep
        phone={flow.phone}
        onPhoneChange={flow.setPhone}
        checking={flow.phoneState.step === "checking"}
        disabled={isSubmitting}
        locked={flow.isPhoneLocked}
        onUnlock={flow.handleChangePhone}
      />

      {/* Patient selector: masked names, pending warnings */}
      {flow.showPatientSelector && phoneResult && (
        <PatientSelector
          status={phoneResult.status}
          patients={phoneResult.patients}
          selectedPatientId={selectedPatientId}
          blockedPatient={blockedPatient}
          onSelectPatient={flow.selectPatient}
          onSelectNewPatient={flow.selectNewPatient}
          onSelectDifferentPerson={flow.selectDifferentPerson}
          clinicPhone={clinicPhone}
        />
      )}

      {/* Details fields: name (conditional) + datetime */}
      {flow.showDetailsFields && (
        <>
          <DetailsStep
            name={flow.name}
            onNameChange={flow.setName}
            preferredDateTime={flow.preferredDateTime}
            onDateTimeChange={flow.setPreferredDateTime}
            minDateTime={flow.minDateTime}
            maxDateTime={flow.maxDateTime}
            disabled={isSubmitting}
            showNameField={flow.showNameField}
            contextMessage={flow.contextMessage}
            timezone={timezone}
          />

          <Button
            type="submit"
            disabled={isSubmitting}
            fullWidth
            loading={isSubmitting}
            loadingText="Submitting..."
          >
            Book Appointment
          </Button>
        </>
      )}
    </form>
  );
}
