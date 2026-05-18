"use client";

import type { ClinicInfo } from "@/lib/utils/get-clinic-for-page";
import { formatISTDate } from "@/lib/utils/date";
import type { Medication } from "@/types/patient";

interface PrescriptionViewProps {
  prescription: {
    prescriptionId: string;
    diagnosis: string;
    medications: Medication[];
    treatmentPlan: string | null;
    nextVisitDate: string | null;
    advice: string | null;
    createdAt: string;
    prescribedBy: { name: string };
    appointment: {
      preferredDateTime: string;
      patient: {
        patientId: string;
        name: string;
        phone: string;
        email: string | null;
        age: number | null;
        address: string | null;
      };
    };
  };
  clinic: ClinicInfo | null;
}


export default function PrescriptionView({ prescription, clinic }: PrescriptionViewProps) {
  const { appointment } = prescription;
  const { patient } = appointment;
  const addr = clinic?.address ?? null;

  return (
    <div>
      {/* Print / Back buttons — hidden in print */}
      <div className="mb-4 flex gap-3 print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg bg-surface-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Print
        </button>
        <a
          href="/admin/dashboard/home"
          className="rounded-lg border border-border-primary bg-surface-primary px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-secondary"
        >
          Back to Dashboard
        </a>
      </div>

      {/* Prescription content — A4-optimized */}
      <div className="relative mx-auto max-w-[210mm] rounded-lg border border-border-primary bg-white p-8 shadow-sm print:border-none print:shadow-none print:p-0 overflow-hidden">
        {/* Diagonal Watermark */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-[4rem] font-bold text-brand-100 opacity-30 select-none whitespace-nowrap" style={{
            transform: 'rotate(-45deg)',
            transformOrigin: 'center',
          }}>
            {clinic?.name ?? ""}
          </div>
        </div>

        {/* Header */}
        <div className="relative z-10 border-b-2 border-accent-700 pb-4 mb-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              {clinic?.logo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={clinic.logo}
                  alt="Clinic logo"
                  className="h-20 w-20 rounded object-contain"
                />
              )}
              <div className="pt-2">
                <h1 className="text-xl font-bold text-accent-700">
                  {clinic?.name ?? ""}
                </h1>
                {addr && (
                  <>
                    <p className="text-sm text-gray-600">
                      {addr.line1}{addr.line2 ? `, ${addr.line2}` : ""}
                    </p>
                    <p className="text-sm text-gray-600">
                      {addr.city}, {addr.state} - {addr.pincode}
                    </p>
                  </>
                )}
              </div>
            </div>
            <div className="text-right">
              {clinic?.phones && clinic.phones.length > 0 && (
                <p className="mt-1 text-xs text-gray-600">
                  {clinic.phones.join(" | ")}
                </p>
              )}
              {clinic?.email && (
                <p className="text-xs text-gray-600">{clinic.email}</p>
              )}
              {clinic?.website && (
                <p className="text-xs text-gray-600">{clinic.website}</p>
              )}
            </div>
          </div>
        </div>

        {/* Patient Info + Prescription ID */}
        <div className="relative z-10 mb-6 grid grid-cols-2 gap-4 text-sm">
          <div className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1">
            <span className="font-medium text-gray-700">Patient:</span>
            <span className="font-semibold text-gray-900">{patient.name}</span>

            {patient.age != null && (
              <>
                <span className="font-medium text-gray-700">Age:</span>
                <span className="font-semibold text-gray-900">{patient.age} yrs</span>
              </>
            )}

            <span className="font-medium text-gray-700">Phone:</span>
            <span className="font-semibold text-gray-900">{patient.phone}</span>

            {patient.address && (
              <>
                <span className="font-medium text-gray-700">Address:</span>
                <span className="font-semibold text-gray-900">{patient.address}</span>
              </>
            )}

            {patient.email && (
              <>
                <span className="font-medium text-gray-700">Email:</span>
                <span className="font-semibold text-gray-900">{patient.email}</span>
              </>
            )}
          </div>
          <div className="grid grid-cols-[max-content_max-content] justify-end content-start gap-x-3 gap-y-1">
            <span className="font-medium text-gray-700">Rx ID:</span>
            <span className="font-mono font-semibold text-gray-900">
              {prescription.prescriptionId}
            </span>

            <span className="font-medium text-gray-700">Patient ID:</span>
            <span className="font-mono font-semibold text-gray-900">
              {patient.patientId}
            </span>

            <span className="font-medium text-gray-700">Date:</span>
            <span className="font-semibold text-gray-900">
              {formatISTDate(new Date(prescription.createdAt))}
            </span>
          </div>
        </div>

        <hr className="relative z-10 mb-4 border-gray-300" />

        {/* Chief Complain */}
        <div className="relative z-10 mb-4">
          <h2 className="mb-1 text-sm font-semibold uppercase text-gray-700">
            Chief Complain
          </h2>
          <div className="min-h-[40px]"></div>
        </div>

        {/* Medical History */}
        <div className="relative z-10 mb-4">
          <h2 className="mb-1 text-sm font-semibold uppercase text-gray-700">
            Medical History
          </h2>
          <div className="min-h-[40px]"></div>
        </div>

        {/* Examinations */}
        <div className="relative z-10 mb-4">
          <h2 className="mb-1 text-sm font-semibold uppercase text-gray-700">
            Examinations
          </h2>
          <div className="min-h-[50px]"></div>
        </div>

        {/* Investigations */}
        <div className="relative z-10 mb-4">
          <h2 className="mb-1 text-sm font-semibold uppercase text-gray-700">
            Investigations
          </h2>
          <div className="min-h-[40px]"></div>
        </div>

        {/* Rx (Medications) */}
        <div className="relative z-10 mb-4">
          <h2 className="mb-1 text-sm font-semibold uppercase text-gray-700">
            <span className="text-4xl leading-none">℞</span>
          </h2>
          <div className="min-h-[80px]"></div>
        </div>

        {/* Next Appointment & Signature area */}
        <div className="relative z-10 mt-8 flex justify-between">
          {/* Next Appointment - Left side */}
          <div>
            <h2 className="mb-2 text-sm font-semibold uppercase text-gray-700">
              Next Appointment:
            </h2>
          </div>

          {/* Signature - Right side */}
          <div className="text-center">
            <div className="w-48 border-b border-gray-400 mb-2" />
            <p className="text-sm font-semibold text-gray-900">
              {prescription.prescribedBy.name}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 mt-8 border-t-2 border-accent-700 pt-3 text-center">
          {clinic?.phones && clinic.phones.length > 0 && (
            <p className="text-xs text-accent-700 font-bold">
              {clinic.phones.join(" | ")}
            </p>
          )}
          {(clinic?.email || clinic?.website) && (
            <p className="text-xs text-gray-700">
              {[clinic.email, clinic.website].filter(Boolean).join(" | ")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
