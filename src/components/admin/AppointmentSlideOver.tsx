"use client";

import { useEffect, useState, useRef, useCallback, type FormEvent } from "react";
import { DateTime } from "luxon";
import { useDashboard } from "./DashboardContext";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import type { PatientMatch, DoctorRow } from "@/types/patient";
import type { ApiJson } from "@/types/api";
import { ConfirmationModal } from "./ConfirmationModal";

function toTitleCase(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export default function AppointmentSlideOver() {
  const {
    appointmentSlideOver: { open, appointment },
    closeAppointmentSlideOver,
    triggerRefresh,
  } = useDashboard();

  // Form state
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [sex, setSex] = useState<"MALE" | "FEMALE" | "OTHER" | "">("");
  const [age, setAge] = useState<string>("");
  const [totalAmount, setTotalAmount] = useState<string>("");
  const [paidAmount, setPaidAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("CASH");
  const [paymentComment, setPaymentComment] = useState<string>("");
  const [isWaived, setIsWaived] = useState<boolean>(false);
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [preferredDateTime, setPreferredDateTime] = useState("");
  const [reasonForVisit, setReasonForVisit] = useState("");
  const [visitType, setVisitType] = useState<"NEW_CONSULTATION" | "FOLLOW_UP">(
    "NEW_CONSULTATION"
  );
  const [isPhoneBooking, setIsPhoneBooking] = useState(false);
  const [showPriority, setShowPriority] = useState(false);
  const [priority, setPriority] = useState<"ROUTINE" | "URGENT" | "EMERGENCY">("ROUTINE");

  // Auto-detect state
  const [matchedPatients, setMatchedPatients] = useState<PatientMatch[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [isNewPatient, setIsNewPatient] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Confirmation modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [formPayload, setFormPayload] = useState<Record<string, unknown> | null>(null);

  // Doctor selection
  const [doctors, setDoctors] = useState<DoctorRow[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [loadingDoctors, setLoadingDoctors] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);

  const isConfirmMode = !!appointment;

  // Fetch doctors when slide-over opens
  useEffect(() => {
    if (!open) return;
    setLoadingDoctors(true);
    fetch("/api/doctors")
      .then((res) => res.json() as Promise<ApiJson & { doctors: DoctorRow[] }>)
      .then((data) => {
        if (data.success) {
          setDoctors(data.doctors);
          // Auto-select if only one doctor and no pre-selection
          if (data.doctors.length === 1) {
            setSelectedDoctorId(data.doctors[0].id);
          }
        }
      })
      .catch((err) => console.error("Failed to fetch doctors:", err))
      .finally(() => setLoadingDoctors(false));
  }, [open]);

  // Reset form when slide-over opens/closes or appointment changes
  useEffect(() => {
    if (!open) return;
    setError("");
    setSubmitting(false);
    setShowConfirmModal(false);
    setFormPayload(null);
    setMatchedPatients([]);
    setSelectedPatientId(null);
    setIsNewPatient(false);
    setLookingUp(false);
    setVisitType("NEW_CONSULTATION");
    setIsPhoneBooking(false);
    setShowPriority(false);
    setPriority("ROUTINE");

    if (appointment) {
      // Confirm mode — pre-fill from appointment
      setPhone(appointment.patient.phone);
      setName(appointment.patient.name);
      setSex(appointment.patient.sex ?? "");
      setAge(appointment.patient.age != null ? String(appointment.patient.age) : "");
      setEmail(appointment.patient.email ?? "");
      setAddress(appointment.patient.address ?? "");
      setPreferredDateTime(
        DateTime.fromISO(appointment.preferredDateTime)
          .setZone("Asia/Kolkata")
          .toFormat("yyyy-MM-dd'T'HH:mm")
      );
      setReasonForVisit(appointment.reasonForVisit ?? "");
      setSelectedDoctorId(appointment.doctorId ?? "");
      setTotalAmount("");
      setPaidAmount("");
      setPaymentMethod("CASH");
      setPaymentComment("");
      setIsWaived(false);
    } else {
      // New appointment mode — blank with current datetime
      setPhone("");
      setName("");
      setSex("");
      setAge("");
      setEmail("");
      setAddress("");
      setPreferredDateTime(
        DateTime.now().setZone("Asia/Kolkata").toFormat("yyyy-MM-dd'T'HH:mm")
      );
      setReasonForVisit("");
      setSelectedDoctorId("");
      setTotalAmount("");
      setPaidAmount("");
      setPaymentMethod("CASH");
      setPaymentComment("");
      setIsWaived(false);
    }
  }, [open, appointment]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeAppointmentSlideOver();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, closeAppointmentSlideOver]);

  // Prevent body scroll
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const autoFillFromPatient = useCallback((patient: PatientMatch) => {
    setName(toTitleCase(patient.name));
    setSex((patient.sex as "MALE" | "FEMALE" | "OTHER") ?? "");
    setAge(patient.age != null ? String(patient.age) : "");
    setEmail(patient.email ?? "");
  }, []);

  // Phone auto-detect (new appointment mode only)
  const lookupPatients = useCallback(
    (phoneValue: string) => {
      if (isConfirmMode) return;
      const digits = phoneValue.replace(/\D/g, "");
      if (digits.length < 10) {
        setMatchedPatients([]);
        setSelectedPatientId(null);
        setIsNewPatient(false);
        return;
      }

      // Abort previous request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLookingUp(true);
      fetch(`/api/patients/lookup?phone=${digits}`, {
        signal: controller.signal,
      })
        .then((res) => res.json() as Promise<ApiJson & { patients: PatientMatch[] }>)
        .then((data) => {
          if (!data.success) return;
          const patients: PatientMatch[] = data.patients;
          setMatchedPatients(patients);

          if (patients.length === 1) {
            // Auto-fill single match
            autoFillFromPatient(patients[0]);
            setSelectedPatientId(patients[0].id);
            setIsNewPatient(false);
          } else if (patients.length === 0) {
            setIsNewPatient(true);
            setSelectedPatientId(null);
          }
          // If multiple, show dropdown — don't auto-fill
        })
        .catch((err) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          console.error("Patient lookup failed:", err);
        })
        .finally(() => setLookingUp(false));
    },
    [isConfirmMode, autoFillFromPatient]
  );

  function handlePhoneChange(value: string) {
    setPhone(value);
    // Debounce lookup
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => lookupPatients(value), 300);
  }

  function handlePatientSelect(patientId: string) {
    if (patientId === "__new__") {
      setSelectedPatientId(null);
      setIsNewPatient(true);
      setName("");
      setSex("");
      setAge("");
      setEmail("");
      return;
    }
    const patient = matchedPatients.find((p) => p.id === patientId);
    if (patient) {
      autoFillFromPatient(patient);
      setSelectedPatientId(patient.id);
      setIsNewPatient(false);
    }
  }

  // Whether the auto-detect found an existing patient (show visit type radio)
  const showVisitType =
    !isConfirmMode && (selectedPatientId !== null || (matchedPatients.length > 1 && !isNewPatient));

  function handleFormSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    const parsedAge = age !== "" ? parseInt(age, 10) : undefined;
    const parsedTotal = totalAmount !== "" ? parseFloat(totalAmount) : undefined;

    const payload: Record<string, unknown> = {
      phone,
      name,
      sex: sex || undefined,
      age: parsedAge,
      email: email || undefined,
      address: address || undefined,
      preferredDateTime: new Date(preferredDateTime).toISOString(),
      reasonForVisit: reasonForVisit || undefined,
      allowOverride: true,
      totalAmount: parsedTotal,
    };

    if (isConfirmMode) {
      payload.existingAppointmentId = appointment.id;
    } else if (selectedPatientId && !isNewPatient) {
      payload.existingPatientId = selectedPatientId;
      payload.visitType = visitType;
    }

    if (isPhoneBooking) {
      payload.isPhoneBooking = true;
    }
    if (showPriority && priority !== "ROUTINE") {
      payload.priority = priority;
    }
    if (selectedDoctorId) {
      payload.doctorId = selectedDoctorId;
    }

    setFormPayload(payload);
    setShowConfirmModal(true);
  }

  async function handleConfirm(openPrescription: boolean) {
    if (!formPayload) return;
    setError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/appointments/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formPayload),
      });

      const data = (await res.json()) as ApiJson & { appointmentId?: string };

      if (!res.ok || !data.success) {
        setError(data.error || "Something went wrong.");
        return;
      }

      // Post payment entry after appointment is created
      const parsedPaid = paidAmount !== "" ? parseFloat(paidAmount) : 0;
      const parsedTotal = totalAmount !== "" ? parseFloat(totalAmount) : 0;
      if (isWaived && parsedTotal > 0) {
        await fetch("/api/payments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            appointmentId: data.appointmentId,
            amount: parsedTotal,
            method: "WAIVED",
            notes: paymentComment.trim() || null,
          }),
        });
      } else if (parsedPaid > 0) {
        await fetch("/api/payments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            appointmentId: data.appointmentId,
            amount: parsedPaid,
            method: paymentMethod,
            notes: paymentComment.trim() || null,
          }),
        });
      }

      if (openPrescription) {
        window.open(
          `/admin/dashboard/prescription/blank/${data.appointmentId}`,
          "_blank"
        );
      }

      setShowConfirmModal(false);
      closeAppointmentSlideOver();
      triggerRefresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  const title = isConfirmMode ? "Confirm Appointment" : "New Appointment";

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-surface-overlay/30"
        onClick={closeAppointmentSlideOver}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 w-full max-w-lg overflow-y-auto border-l border-border-primary bg-surface-primary shadow-xl">
        <div className="flex items-center justify-between border-b border-border-primary px-6 py-4">
          <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
          <button
            type="button"
            onClick={closeAppointmentSlideOver}
            className="rounded-md p-1.5 text-text-tertiary hover:bg-surface-tertiary hover:text-text-secondary"
            aria-label="Close"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form ref={formRef} onSubmit={handleFormSubmit} className="space-y-6 p-6">
          {error && <Alert variant="error">{error}</Alert>}

          {/* --- Patient Section --- */}
          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold text-text-secondary uppercase tracking-wide">
              Patient Details
            </legend>

            {/* Phone */}
            <FormField label="Phone Number" htmlFor="phone" hint="10-digit Indian mobile number">
              <div className="relative">
                <Input
                  id="phone"
                  type="tel"
                  placeholder="9876543210"
                  value={phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  disabled={submitting || isConfirmMode}
                  required
                  maxLength={15}
                />
                {lookingUp && (
                  <span className="absolute right-3 top-2.5 text-xs text-text-hint">
                    Looking up...
                  </span>
                )}
              </div>
            </FormField>

            {/* Patient dropdown (single or multiple matches) */}
            {!isConfirmMode && matchedPatients.length >= 1 && (
              <FormField label="Select Patient" htmlFor="patientSelect">
                <select
                  id="patientSelect"
                  value={isNewPatient ? "__new__" : selectedPatientId ?? ""}
                  onChange={(e) => handlePatientSelect(e.target.value)}
                  className="block w-full rounded-md border border-border-secondary bg-surface-primary px-3 py-2 text-sm text-text-primary focus:border-border-focus focus:ring-1 focus:ring-focus-ring focus:outline-none"
                  disabled={submitting}
                >
                  <option value="" disabled>
                    Choose a patient...
                  </option>
                  {matchedPatients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.patientId})
                    </option>
                  ))}
                  <option value="__new__">+ Add New Patient</option>
                </select>
              </FormField>
            )}

            {/* Name */}
            <FormField label="Full Name" htmlFor="name">
              <Input
                id="name"
                type="text"
                placeholder="Patient full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={(e) => setName(toTitleCase(e.target.value))}
                disabled={submitting}
                required
                maxLength={100}
              />
            </FormField>

            {/* Sex */}
            <FormField label="Sex" htmlFor="sex">
              <div className="flex gap-4">
                {(["MALE", "FEMALE", "OTHER"] as const).map((option) => (
                  <label
                    key={option}
                    className="flex items-center gap-1.5 text-sm text-text-primary cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="sex"
                      value={option}
                      checked={sex === option}
                      onChange={() => setSex(option)}
                      disabled={submitting}
                      className="accent-interactive-primary"
                    />
                    {option.charAt(0) + option.slice(1).toLowerCase()}
                  </label>
                ))}
              </div>
            </FormField>

            {/* Age */}
            <FormField label="Age (Years)" htmlFor="age">
              <Input
                id="age"
                type="number"
                placeholder="e.g. 32"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                disabled={submitting}
                min={0}
                max={120}
              />
            </FormField>

            {/* Email */}
            <FormField label="Email" htmlFor="email" hint="Optional">
              <Input
                id="email"
                type="email"
                placeholder="patient@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
              />
            </FormField>

            {/* Address */}
            <FormField label="Address" htmlFor="address" hint="Optional">
              <Textarea
                id="address"
                placeholder="Patient's address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                disabled={submitting}
                rows={2}
              />
            </FormField>
          </fieldset>

          {/* --- Appointment Section --- */}
          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold text-text-secondary uppercase tracking-wide">
              Appointment Details
            </legend>

            {/* Visit Type (only for returning patients in New Appointment mode) */}
            {showVisitType && (
              <FormField label="Visit Type" htmlFor="visitType">
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 text-sm text-text-primary cursor-pointer">
                    <input
                      type="radio"
                      name="visitType"
                      value="NEW_CONSULTATION"
                      checked={visitType === "NEW_CONSULTATION"}
                      onChange={() => setVisitType("NEW_CONSULTATION")}
                      disabled={submitting}
                      className="accent-interactive-primary"
                    />
                    New Consultation
                  </label>
                  <label className="flex items-center gap-1.5 text-sm text-text-primary cursor-pointer">
                    <input
                      type="radio"
                      name="visitType"
                      value="FOLLOW_UP"
                      checked={visitType === "FOLLOW_UP"}
                      onChange={() => setVisitType("FOLLOW_UP")}
                      disabled={submitting}
                      className="accent-interactive-primary"
                    />
                    Follow-up
                  </label>
                </div>
              </FormField>
            )}

            {/* Booking Method (only for new appointments) */}
            {!isConfirmMode && (
              <FormField label="Booking Method" htmlFor="bookingMethod">
                <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
                  <input
                    type="checkbox"
                    id="isPhoneBooking"
                    checked={isPhoneBooking}
                    onChange={(e) => setIsPhoneBooking(e.target.checked)}
                    disabled={submitting}
                    className="accent-interactive-primary h-4 w-4"
                  />
                  <span>Patient called to book (phone booking)</span>
                </label>
                <p className="mt-1 text-xs text-text-hint">
                  {isPhoneBooking ? "Booking channel: Phone" : "Booking channel: Walk-in"}
                </p>
              </FormField>
            )}

            {/* Priority (optional, collapsible) */}
            {!isConfirmMode && (
              <FormField label="Priority" htmlFor="priority">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
                    <input
                      type="checkbox"
                      id="showPriority"
                      checked={showPriority}
                      onChange={(e) => setShowPriority(e.target.checked)}
                      disabled={submitting}
                      className="accent-interactive-primary h-4 w-4"
                    />
                    <span>Mark as urgent/emergency</span>
                  </label>
                  {showPriority && (
                    <div className="ml-6 flex gap-4">
                      {(["ROUTINE", "URGENT", "EMERGENCY"] as const).map((option) => (
                        <label
                          key={option}
                          className="flex items-center gap-1.5 text-sm text-text-primary cursor-pointer"
                        >
                          <input
                            type="radio"
                            name="priority"
                            value={option}
                            checked={priority === option}
                            onChange={() => setPriority(option)}
                            disabled={submitting}
                            className="accent-interactive-primary"
                          />
                          {option.charAt(0) + option.slice(1).toLowerCase()}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </FormField>
            )}

            {/* Treating Doctor (required) */}
            <FormField label="Treating Doctor" htmlFor="doctorId">
              {loadingDoctors ? (
                <p className="text-sm text-text-hint">Loading doctors...</p>
              ) : doctors.length === 0 ? (
                <Alert variant="warning">
                  No doctors found. Add a doctor in Settings first.
                </Alert>
              ) : (
                <select
                  id="doctorId"
                  value={selectedDoctorId}
                  onChange={(e) => setSelectedDoctorId(e.target.value)}
                  disabled={submitting}
                  required
                  className="block w-full rounded-md border border-border-secondary bg-surface-primary px-3 py-2 text-sm text-text-primary focus:border-border-focus focus:ring-1 focus:ring-focus-ring focus:outline-none"
                >
                  <option value="">Select a doctor...</option>
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}{d.qualifications ? ` (${d.qualifications})` : ""}
                    </option>
                  ))}
                </select>
              )}
            </FormField>

            {/* Preferred Date/Time */}
            {isConfirmMode ? (
              <FormField label="Appointment Date & Time" htmlFor="preferredDateTime">
                <p className="rounded-md border border-border-secondary bg-surface-secondary px-3 py-2 text-sm text-text-primary">
                  {DateTime.fromISO(appointment.preferredDateTime)
                    .setZone("Asia/Kolkata")
                    .toFormat("dd MMM yyyy, hh:mm a")}
                </p>
              </FormField>
            ) : (
              <FormField label="Date & Time" htmlFor="preferredDateTime">
                <Input
                  id="preferredDateTime"
                  type="datetime-local"
                  value={preferredDateTime}
                  onChange={(e) => setPreferredDateTime(e.target.value)}
                  disabled={submitting}
                  min={DateTime.now().setZone("Asia/Kolkata").toFormat("yyyy-MM-dd'T'HH:mm")}
                  required
                />
              </FormField>
            )}

            {/* Chief Complaint */}
            <FormField label="Chief Complaint" htmlFor="reasonForVisit" hint="Optional">
              <Textarea
                id="reasonForVisit"
                placeholder="Brief description of the issue..."
                value={reasonForVisit}
                onChange={(e) => setReasonForVisit(e.target.value)}
                disabled={submitting}
                rows={3}
                maxLength={1000}
              />
            </FormField>
          </fieldset>

          {/* --- Payment Section --- */}
          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold text-text-secondary uppercase tracking-wide">
              Payment
            </legend>

            {/* Waive toggle */}
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <div className="relative">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  id="isWaived"
                  checked={isWaived}
                  onChange={(e) => setIsWaived(e.target.checked)}
                  disabled={submitting}
                />
                <div className="h-5 w-9 rounded-full border border-border-secondary bg-surface-secondary peer-checked:bg-interactive-primary peer-checked:border-interactive-primary transition-colors" />
                <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
              </div>
              <span className="text-sm text-text-primary">Waive off payment</span>
              {isWaived && (
                <span className="text-xs text-text-hint">(all fields locked except comment)</span>
              )}
            </label>

            {/* Total Amount */}
            <FormField label="Total Amount (₹)" htmlFor="totalAmount" hint="Bill amount after discount — optional">
              <Input
                id="totalAmount"
                type="number"
                placeholder="0.00"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                disabled={submitting || isWaived}
                min={0}
                step="0.01"
              />
            </FormField>

            {/* Paid Amount */}
            <FormField label="Paid Amount (₹)" htmlFor="paidAmount" hint="Amount collected now">
              <Input
                id="paidAmount"
                type="number"
                placeholder="0.00"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                disabled={submitting || isWaived}
                min={0}
                step="0.01"
              />
              {totalAmount !== "" && paidAmount !== "" && !isWaived && (
                <p className="mt-1 text-xs text-text-hint">
                  Due: ₹{Math.max(0, parseFloat(totalAmount || "0") - parseFloat(paidAmount || "0")).toFixed(2)}
                </p>
              )}
            </FormField>

            {/* Payment Mode */}
            <FormField label="Payment Mode" htmlFor="paymentMethod">
              <div className="flex flex-wrap gap-2">
                {(["CASH", "UPI", "CARD", "OTHER"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPaymentMethod(m)}
                    disabled={submitting || isWaived}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-40 ${
                      paymentMethod === m && !isWaived
                        ? "border-border-focus bg-surface-highlight text-text-primary"
                        : "border-border-primary bg-surface-primary text-text-secondary hover:bg-surface-secondary"
                    }`}
                  >
                    {m === "CASH" ? "Cash" : m === "UPI" ? "UPI" : m === "CARD" ? "Card" : "Other"}
                  </button>
                ))}
              </div>
            </FormField>

            {/* Comment */}
            <FormField label="Comment" htmlFor="paymentComment" hint="Optional">
              <Input
                id="paymentComment"
                type="text"
                placeholder={isWaived ? "e.g. Waived for financial hardship" : "e.g. Partial payment, UPI ref #123"}
                value={paymentComment}
                onChange={(e) => setPaymentComment(e.target.value)}
                disabled={submitting}
                maxLength={500}
              />
            </FormField>
          </fieldset>

          {/* --- Submit --- */}
          <div className="border-t border-border-primary pt-4">
            <Button
              type="submit"
              fullWidth
              disabled={submitting}
            >
              Confirm Appointment
            </Button>
          </div>
        </form>

        {/* Confirmation Modal */}
        {showConfirmModal && formPayload && (
          <ConfirmationModal
            patientName={name}
            patientPhone={phone}
            sex={sex}
            age={age}
            preferredDateTime={preferredDateTime}
            reasonForVisit={reasonForVisit}
            doctorName={doctors.find((d) => d.id === selectedDoctorId)?.name ?? ""}
            isConfirmMode={isConfirmMode}
            loading={submitting}
            error={error}
            onConfirmAndPrint={() => handleConfirm(true)}
            onConfirmOnly={() => handleConfirm(false)}
            onCancel={() => {
              setShowConfirmModal(false);
              setError("");
            }}
          />
        )}
      </div>
    </div>
  );
}
