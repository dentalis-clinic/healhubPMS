"use client";

import { FormEvent, useState, useEffect } from "react";
import type { AppointmentRow } from "@/types/patient";
import type { MedicationInput } from "@/lib/validations/prescription";
import { prescriptionSchema } from "@/lib/validations/prescription";
import { Button, Input, Textarea, FormField, Alert } from "@/components/ui";
import type { ApiJson } from "@/types/api";

interface PrescriptionFormProps {
  appointment: AppointmentRow;
  onClose: () => void;
  onSuccess: () => void;
}

type FormState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; prescriptionId: string }
  | { status: "error"; message: string };

const emptyMedication: MedicationInput = {
  drugName: "",
  dosage: "",
  frequency: "",
  duration: "",
};

export default function PrescriptionForm({
  appointment,
  onClose,
  onSuccess,
}: PrescriptionFormProps) {
  const [diagnosis, setDiagnosis] = useState("");
  const [medications, setMedications] = useState<MedicationInput[]>([
    { ...emptyMedication },
  ]);
  const [treatmentPlan, setTreatmentPlan] = useState("");
  const [nextVisitDate, setNextVisitDate] = useState("");
  const [advice, setAdvice] = useState("");
  const [formState, setFormState] = useState<FormState>({ status: "idle" });

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function updateMedication(
    index: number,
    field: keyof MedicationInput,
    value: string
  ) {
    setMedications((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  function addMedication() {
    setMedications((prev) => [...prev, { ...emptyMedication }]);
  }

  function removeMedication(index: number) {
    if (medications.length <= 1) return;
    setMedications((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormState({ status: "loading" });

    const payload = {
      appointmentId: appointment.id,
      diagnosis,
      medications,
      treatmentPlan: treatmentPlan || undefined,
      nextVisitDate: nextVisitDate || undefined,
      advice: advice || undefined,
    };

    const result = prescriptionSchema.safeParse(payload);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      setFormState({
        status: "error",
        message: firstIssue?.message ?? "Please check your input.",
      });
      return;
    }

    try {
      const res = await fetch("/api/prescriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as ApiJson & { prescriptionId: string };

      if (!res.ok) {
        setFormState({
          status: "error",
          message: data.error ?? "Something went wrong.",
        });
        return;
      }

      setFormState({
        status: "success",
        prescriptionId: data.prescriptionId,
      });
    } catch {
      setFormState({
        status: "error",
        message: "Network error. Please try again.",
      });
    }
  }

  if (formState.status === "success") {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-surface-overlay/50"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onSuccess();
          }
        }}
      >
        <div className="mx-4 w-full max-w-md rounded-lg border border-border-primary bg-surface-primary p-6 shadow-lg text-center">
          <div className="mb-2 text-sm font-medium text-text-success">
            Prescription created! Appointment confirmed.
          </div>
          <div className="mb-1 text-xs text-text-hint">Prescription ID</div>
          <div className="mb-4 font-mono text-xl font-bold tracking-wider text-text-brand">
            {formState.prescriptionId}
          </div>
          <div className="flex gap-3 justify-center">
            <a
              href={`/admin/dashboard/prescription/${formState.prescriptionId}`}
              className="inline-flex items-center rounded-lg bg-surface-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              View & Print
            </a>
            <Button variant="secondary" onClick={onSuccess}>
              Close
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const isLoading = formState.status === "loading";

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-surface-overlay/50 py-8"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="mx-4 w-full max-w-2xl rounded-lg border border-border-primary bg-surface-primary p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-text-primary">
            Write Prescription
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-text-tertiary hover:text-text-secondary"
          >
            &times;
          </button>
        </div>

        <p className="mb-4 text-sm text-text-hint">
          Patient: {appointment.patient.name} ({appointment.patient.patientId})
          &mdash; {appointment.patient.phone}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {formState.status === "error" && (
            <Alert variant="error">{formState.message}</Alert>
          )}

          {/* Diagnosis */}
          <FormField label="Diagnosis / Chief Complaint *" htmlFor="rx-diagnosis">
            <Textarea
              id="rx-diagnosis"
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              rows={2}
              placeholder="e.g., Dental caries in #36"
              required
              disabled={isLoading}
            />
          </FormField>

          {/* Medications */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-text-primary">
                Medications *
              </label>
              <button
                type="button"
                onClick={addMedication}
                className="text-xs text-text-brand hover:underline"
                disabled={isLoading}
              >
                + Add medication
              </button>
            </div>
            <div className="space-y-2">
              {medications.map((med, i) => (
                <div key={i} className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 items-end">
                  <Input
                    type="text"
                    value={med.drugName}
                    onChange={(e) => updateMedication(i, "drugName", e.target.value)}
                    placeholder="Drug name"
                    required
                    disabled={isLoading}
                  />
                  <Input
                    type="text"
                    value={med.dosage}
                    onChange={(e) => updateMedication(i, "dosage", e.target.value)}
                    placeholder="Dosage"
                    required
                    disabled={isLoading}
                    className="w-24"
                  />
                  <Input
                    type="text"
                    value={med.frequency}
                    onChange={(e) => updateMedication(i, "frequency", e.target.value)}
                    placeholder="Frequency"
                    required
                    disabled={isLoading}
                    className="w-28"
                  />
                  <Input
                    type="text"
                    value={med.duration}
                    onChange={(e) => updateMedication(i, "duration", e.target.value)}
                    placeholder="Duration"
                    required
                    disabled={isLoading}
                    className="w-24"
                  />
                  {medications.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeMedication(i)}
                      className="text-text-tertiary hover:text-text-error px-1 py-1.5 text-sm"
                      disabled={isLoading}
                      title="Remove medication"
                    >
                      &times;
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Treatment Plan */}
          <FormField label="Treatment Plan / Procedures" htmlFor="rx-plan">
            <Textarea
              id="rx-plan"
              value={treatmentPlan}
              onChange={(e) => setTreatmentPlan(e.target.value)}
              rows={2}
              placeholder="e.g., Root canal treatment followed by crown"
              disabled={isLoading}
            />
          </FormField>

          {/* Next Visit */}
          <FormField label="Next Visit Date" htmlFor="rx-next-visit">
            <Input
              id="rx-next-visit"
              type="date"
              value={nextVisitDate}
              onChange={(e) => setNextVisitDate(e.target.value)}
              disabled={isLoading}
            />
          </FormField>

          {/* Advice */}
          <FormField label="Advice / Instructions" htmlFor="rx-advice">
            <Textarea
              id="rx-advice"
              value={advice}
              onChange={(e) => setAdvice(e.target.value)}
              rows={2}
              placeholder="e.g., Avoid hard foods for 48 hours"
              disabled={isLoading}
            />
          </FormField>

          <div className="flex gap-3">
            <Button
              type="submit"
              disabled={isLoading}
              className="flex-1"
              loading={isLoading}
              loadingText="Creating..."
            >
              Create Prescription
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
