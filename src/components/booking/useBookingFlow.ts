"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { DateTime } from "luxon";
import type {
  PhoneCheckResponse,
  PhoneCheckStatus,
  MaskedPatient,
} from "@/types/patient";
import type { ApiJson } from "@/types/api";

const IST_ZONE = "Asia/Kolkata";
const DATETIME_FORMAT = "yyyy-MM-dd'T'HH:mm";
const PHONE_CHECK_DEBOUNCE_MS = 600;
const PHONE_CHECK_TIMEOUT_MS = 5000;

// --- State types ---

type PhoneState =
  | { step: "idle" }
  | { step: "checking" }
  | {
      step: "result";
      status: PhoneCheckStatus;
      patients: MaskedPatient[];
    };

type SelectionState =
  | { kind: "none" }
  | { kind: "existing"; patientId: string; maskedName: string }
  | { kind: "new_patient" }
  | { kind: "different_person" }
  | { kind: "blocked"; maskedName: string; pendingDate: string };

type SubmitState =
  | { step: "idle" }
  | { step: "submitting" }
  | {
      step: "success";
      patientId: string;
      preferredDateTime: string;
    }
  | { step: "error"; message: string };

export interface BookingFlowState {
  // Phone step
  phone: string;
  phoneState: PhoneState;

  // Patient selection
  selection: SelectionState;

  // Details step
  name: string;
  preferredDateTime: string;

  // Submission
  submitState: SubmitState;

  // Derived
  showPatientSelector: boolean;
  showDetailsFields: boolean;
  showNameField: boolean;
  isPhoneLocked: boolean;
  contextMessage: string | null;
  minDateTime: string;
  maxDateTime: string;
}

export interface BookingFlowActions {
  setPhone: (value: string) => void;
  setName: (value: string) => void;
  setPreferredDateTime: (value: string) => void;
  selectPatient: (patientId: string) => void;
  selectNewPatient: () => void;
  selectDifferentPerson: () => void;
  handleSubmit: () => Promise<void>;
  handleReset: () => void;
  handleChangePhone: () => void;
}

export function useBookingFlow(): BookingFlowState & BookingFlowActions {
  const [phone, setPhoneRaw] = useState("");
  const [phoneState, setPhoneState] = useState<PhoneState>({ step: "idle" });
  const [selection, setSelection] = useState<SelectionState>({ kind: "none" });
  const [name, setName] = useState("");
  const [preferredDateTime, setPreferredDateTime] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>({ step: "idle" });

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const { minDateTime, maxDateTime } = useMemo(() => {
    const now = DateTime.now().setZone(IST_ZONE);
    return {
      minDateTime: now.toFormat(DATETIME_FORMAT),
      maxDateTime: now.plus({ hours: 72 }).toFormat(DATETIME_FORMAT),
    };
  }, []);

  // --- Phone check ---

  const performPhoneCheck = useCallback(async (phoneValue: string) => {
    const digits = phoneValue.replace(/\D/g, "");
    if (digits.length !== 10) {
      setPhoneState({ step: "idle" });
      return;
    }

    // Abort previous request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setPhoneState({ step: "checking" });

    try {
      const timeout = setTimeout(() => controller.abort(), PHONE_CHECK_TIMEOUT_MS);
      const res = await fetch(
        `/api/phone-check?phone=${encodeURIComponent(phoneValue)}`,
        { signal: controller.signal }
      );
      clearTimeout(timeout);

      if (!res.ok) {
        // Graceful degradation: treat as new phone
        setPhoneState({
          step: "result",
          status: "new",
          patients: [],
        });
        return;
      }

      const data: PhoneCheckResponse = await res.json();
      setPhoneState({
        step: "result",
        status: data.status,
        patients: data.patients,
      });
    } catch {
      // Network error / timeout / abort → graceful degradation
      setPhoneState({
        step: "result",
        status: "new",
        patients: [],
      });
    }
  }, []);

  const setPhone = useCallback(
    (value: string) => {
      setPhoneRaw(value);
      setSelection({ kind: "none" });
      setSubmitState({ step: "idle" });

      if (debounceRef.current) clearTimeout(debounceRef.current);

      const digits = value.replace(/\D/g, "");
      if (digits.length < 10) {
        abortRef.current?.abort();
        setPhoneState({ step: "idle" });
        return;
      }

      debounceRef.current = setTimeout(() => {
        performPhoneCheck(value);
      }, PHONE_CHECK_DEBOUNCE_MS);
    },
    [performPhoneCheck]
  );

  // --- Patient selection ---

  const selectPatient = useCallback(
    (patientId: string) => {
      if (phoneState.step !== "result") return;
      const patient = phoneState.patients.find((p) => p.id === patientId);
      if (!patient) return;

      if (patient.hasPending && patient.pendingDate) {
        setSelection({
          kind: "blocked",
          maskedName: patient.maskedName,
          pendingDate: patient.pendingDate,
        });
      } else {
        setSelection({
          kind: "existing",
          patientId: patient.id,
          maskedName: patient.maskedName,
        });
      }
      setSubmitState({ step: "idle" });
    },
    [phoneState]
  );

  const selectNewPatient = useCallback(() => {
    setSelection({ kind: "new_patient" });
    setName("");
    setSubmitState({ step: "idle" });
  }, []);

  const selectDifferentPerson = useCallback(() => {
    setSelection({ kind: "different_person" });
    setName("");
    setSubmitState({ step: "idle" });
  }, []);

  // --- Submit ---

  const handleSubmit = useCallback(async () => {
    setSubmitState({ step: "submitting" });

    const body: Record<string, string> = { phone, preferredDateTime };

    if (selection.kind === "existing") {
      body.existingPatientId = selection.patientId;
    } else {
      body.name = name;
    }

    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = (await res.json()) as ApiJson & {
        patientId: string;
        preferredDateTime: string;
      };

      if (!res.ok) {
        setSubmitState({
          step: "error",
          message: data.error ?? "Something went wrong. Please try again.",
        });
        return;
      }

      setSubmitState({
        step: "success",
        patientId: data.patientId,
        preferredDateTime: data.preferredDateTime,
      });
    } catch {
      setSubmitState({
        step: "error",
        message: "Network error. Please check your connection and try again.",
      });
    }
  }, [phone, name, preferredDateTime, selection]);

  // --- Reset ---

  const handleReset = useCallback(() => {
    setPhoneRaw("");
    setPhoneState({ step: "idle" });
    setSelection({ kind: "none" });
    setName("");
    setPreferredDateTime("");
    setSubmitState({ step: "idle" });
    if (debounceRef.current) clearTimeout(debounceRef.current);
    abortRef.current?.abort();
  }, []);

  const handleChangePhone = useCallback(() => {
    setPhoneState({ step: "idle" });
    setSelection({ kind: "none" });
    setName("");
    setPreferredDateTime("");
    setSubmitState({ step: "idle" });
  }, []);

  // --- Derived state ---

  const isPhoneResult = phoneState.step === "result";
  const hasPatients = isPhoneResult && phoneState.patients.length > 0;
  const isNewPhone = isPhoneResult && phoneState.status === "new";
  const isSinglePendingOnly =
    isPhoneResult &&
    phoneState.patients.length === 1 &&
    phoneState.patients[0].hasPending;

  // Show patient selector when phone matched existing patients and no selection yet
  const showPatientSelector =
    hasPatients && selection.kind === "none" && !isSinglePendingOnly;

  // Show the single-patient pending block (Scenario D)
  const showSinglePendingBlock =
    isSinglePendingOnly && selection.kind === "none";

  // Show details fields
  const showDetailsFields =
    isNewPhone ||
    selection.kind === "existing" ||
    selection.kind === "new_patient" ||
    selection.kind === "different_person";

  // Show name field (not needed for returning patients who selected their profile)
  const showNameField = selection.kind !== "existing";

  // Phone is locked once the user has progressed past phone entry
  const isPhoneLocked =
    showDetailsFields ||
    showPatientSelector ||
    showSinglePendingBlock ||
    selection.kind === "blocked";

  // Context message
  let contextMessage: string | null = null;
  if (selection.kind === "existing") {
    contextMessage = `Welcome back, ${selection.maskedName}!`;
  } else if (selection.kind === "new_patient") {
    contextMessage = null;
  } else if (selection.kind === "different_person") {
    contextMessage = "Booking for a different person on the same number.";
  }

  return {
    phone,
    phoneState,
    selection,
    name,
    preferredDateTime,
    submitState,
    showPatientSelector: showPatientSelector || showSinglePendingBlock,
    showDetailsFields,
    showNameField,
    isPhoneLocked,
    contextMessage,
    minDateTime,
    maxDateTime,

    setPhone,
    setName,
    setPreferredDateTime,
    selectPatient,
    selectNewPatient,
    selectDifferentPerson,
    handleSubmit,
    handleReset,
    handleChangePhone,
  };
}
