import type { Enums } from "@/generated/supabase/database.types";

type SubmissionSource = Enums<"SubmissionSource">;
type AppointmentType = Enums<"AppointmentType">;
type AppointmentStatus = Enums<"AppointmentStatus">;
type BookingChannel = Enums<"BookingChannel">;
type VisitType = Enums<"VisitType">;
type AppointmentPriority = Enums<"AppointmentPriority">;
type Sex = Enums<"Sex">;

// --- Patient (person) ---

export interface PatientRow {
  id: string;
  patientId: string;
  name: string;
  phone: string;
  email: string | null;
  age: number | null;
  sex: Sex | null;
  address: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PatientMatch {
  id: string;
  patientId: string;
  name: string;
  sex: Sex | null;
  email: string | null;
  age: number | null;
  lastVisitDate: string | null;
}

// --- Appointment (visit) ---

export interface AppointmentRow {
  id: string;
  patientId: string;
  type: AppointmentType | null; // DEPRECATED: Use bookingChannel + visitType instead
  bookingChannel: BookingChannel;
  visitType: VisitType;
  priority: AppointmentPriority | null;
  status: AppointmentStatus;
  preferredDateTime: string;
  reasonForVisit: string | null;
  submittedBy: SubmissionSource;
  adminUserId: string | null;
  doctorId: string | null;
  notes: string | null;
  totalAmount: number | null; // amountDue (after discount)
  totalPaid: number;          // sum of all payment entries
  isWaived: boolean;          // true if any payment has method=WAIVED
  createdAt: string;
  updatedAt: string;
  // Joined
  patient: PatientRow;
  prescription?: PrescriptionSummary | null;
  doctor?: DoctorSummary | null;
}

// Lightweight prescription info returned by the list endpoint (avoids transferring full JSONB)
export interface PrescriptionSummary {
  id: string;
  prescriptionId: string;
}

// --- Doctor ---

export interface DoctorRow {
  id: string;
  name: string;
  qualifications: string | null;
  registrationNumber: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DoctorSummary {
  id: string;
  name: string;
  qualifications: string | null;
}

// --- Prescription ---

export interface Medication {
  drugName: string;
  dosage: string;
  frequency: string;
  duration: string;
}

export interface PrescriptionRow {
  id: string;
  prescriptionId: string;
  appointmentId: string;
  diagnosis: string;
  medications: Medication[];
  treatmentPlan: string | null;
  nextVisitDate: string | null;
  advice: string | null;
  prescribedById: string;
  createdAt: string;
  updatedAt: string;
}

// --- Phone check (public booking flow) ---

export type PhoneCheckStatus = "new" | "existing" | "has_pending";

export interface MaskedPatient {
  id: string;
  maskedName: string;
  hasPending: boolean;
  pendingDate: string | null;
}

export interface PhoneCheckResponse {
  success: boolean;
  status: PhoneCheckStatus;
  patients: MaskedPatient[];
}
