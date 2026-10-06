"use client";

import { useRef, useState } from "react";
import type { ClinicInfo } from "@/lib/utils/get-clinic-for-page";
import { Button } from "@/components/ui";
import jsPDF from "jspdf";
import { toPng } from "html-to-image";
import { DateTime } from "luxon";

export interface PatientInfo {
  patientId: string;
  name: string;
  phone: string;
  age: number | null;
  sex: string | null;
  address: string | null;
}

function BlankField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-end gap-2">
      <span className="shrink-0 text-sm font-medium text-gray-500">{label}:</span>
      {value ? (
        <span className="text-sm font-semibold text-gray-800">{value}</span>
      ) : (
        <span className="flex-1 border-b border-gray-400" />
      )}
    </div>
  );
}

export default function BlankLetterheadTemplate({ patient, clinic }: { patient?: PatientInfo; clinic: ClinicInfo | null }) {
  const addr = clinic?.address ?? null;
  const today = DateTime.now().setZone("Asia/Kolkata").toFormat("dd MMM yyyy");
  const prescriptionRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadPDF = async () => {
    if (!prescriptionRef.current) return;
    setIsDownloading(true);
    try {
      const imgData = await toPng(prescriptionRef.current, {
        quality: 1,
        pixelRatio: 3,
        backgroundColor: "#ffffff",
        style: { margin: "0", left: "0", top: "0", transform: "none" },
      });

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const imgProps = pdf.getImageProperties(imgData);
      const pdfImgHeight = pdfWidth / (imgProps.width / imgProps.height);
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfImgHeight);
      const nameSlug = patient ? `-${patient.name.toLowerCase().replace(/\s+/g, "-")}` : "";
      pdf.save(`blank-prescription${nameSlug}-${today}.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Failed to generate PDF. Please try printing instead.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div>
      <style>{`@page { size: A4; margin: 0; }`}</style>

      {/* Toolbar — hidden when printing */}
      <div className="sticky top-0 z-10 mb-6 flex items-center justify-between border-b border-border-primary bg-white px-6 py-4 shadow-sm print:hidden">
        <div className="flex items-center gap-4">
          <a
            href="/admin/dashboard/settings"
            className="group flex items-center gap-2 text-sm font-medium text-text-secondary hover:text-text-primary"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 transition-transform group-hover:-translate-x-1"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
                clipRule="evenodd"
              />
            </svg>
            Back to Settings
          </a>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            onClick={handleDownloadPDF}
            loading={isDownloading}
            loadingText="Downloading..."
          >
            Download
          </Button>
          <Button variant="primary" onClick={() => window.print()}>
            Print
          </Button>
        </div>
      </div>

      {/* A4 prescription sheet */}
      <div
        ref={prescriptionRef}
        className="relative mx-auto flex min-h-[297mm] max-w-[210mm] flex-col rounded-lg border border-border-primary bg-white p-8 shadow-sm print:h-[297mm] print:max-w-full print:border-none print:shadow-none"
      >
        {/* Watermark */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            className="select-none whitespace-nowrap text-[4rem] font-bold text-brand-100 opacity-30"
            style={{ transform: "rotate(-45deg)", transformOrigin: "center" }}
          >
            {clinic?.name ?? ""}
          </div>
        </div>

        {/* Header */}
        <div className="relative z-10 mb-4 border-b-2 border-accent-600 pb-2">
          <div className="mb-4 flex items-start justify-between">
            <div className="flex flex-col items-start">
              {clinic?.logo && (
                <img
                  src={clinic.logo}
                  alt="Clinic logo"
                  className="h-20 w-40 rounded object-contain"
                />
              )}
            </div>
            {addr && (
              <div className="pt-2 text-right">
                <p className="text-sm text-gray-800">{addr.line1}</p>
                {addr.line2 && <p className="text-sm text-gray-800">{addr.line2}</p>}
                <p className="text-sm text-gray-800">
                  {addr.city}, {addr.state} - {addr.pincode}
                </p>
              </div>
            )}
          </div>
          <h1 className="text-lg font-bold text-accent-600">{clinic?.name ?? ""}</h1>
        </div>

        {/* Patient info */}
        <div className="relative z-10 mb-4 grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <BlankField label="Patient Name" value={patient?.name} />
          <BlankField label="Date" value={today} />
          <BlankField
            label="Age / Sex"
            value={
              patient
                ? [patient.age != null ? `${patient.age}y` : null, patient.sex ? patient.sex.charAt(0) : null]
                    .filter(Boolean)
                    .join(" / ") || undefined
                : undefined
            }
          />
          <BlankField label="Patient ID" value={patient?.patientId} />
          <BlankField label="Phone" value={patient?.phone} />
          <BlankField label="Address" value={patient?.address ?? undefined} />
        </div>

        <hr className="relative z-10 mb-8 border-gray-200" />

        {/* Sections */}
        {[
          "Chief Complain",
          "Medical History",
          "Examinations",
          "Investigations",
        ].map((section) => (
          <div key={section} className="relative z-10 mb-4">
            <h2 className="mb-1 text-sm font-semibold uppercase text-gray-500">{section}</h2>
            <div className="min-h-[60px]" />
          </div>
        ))}

        {/* Rx */}
        <div className="relative z-10 mb-4">
          <h2 className="mb-1 text-sm font-semibold uppercase text-gray-700">
            <span className="text-4xl leading-none">℞</span>
          </h2>
          <div className="min-h-[80px]" />
        </div>

        {/* Footer row */}
        <div className="relative z-10 mt-auto">
          <div className="mb-4 flex justify-between">
            <div>
              <h2 className="mb-2 text-sm font-semibold uppercase text-gray-700">
                Next Appointment:
              </h2>
            </div>
            <div className="text-center">
              <div className="mb-2 w-48 border-b border-gray-400" />
              <p className="text-sm font-semibold text-gray-900">Doctor&apos;s Signature</p>
            </div>
          </div>

          <div className="border-t-2 border-accent-600 pt-3 text-center">
            {clinic?.phones && clinic.phones.length > 0 && (
              <p className="pb-2 text-xs font-bold text-brand-800">
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
    </div>
  );
}
