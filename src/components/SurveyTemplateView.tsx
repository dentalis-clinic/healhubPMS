"use client";

import { useRef, useState } from "react";
import type { ClinicInfo } from "@/lib/utils/get-clinic-for-page";
import { Button } from "@/components/ui";
import jsPDF from "jspdf";
import { toPng } from "html-to-image";
import { DateTime } from "luxon";
import type { PatientInfo } from "@/components/BlankLetterheadTemplate";

interface SurveyQuestion {
  id: string;
  text: string;
}

interface SurveyTemplateViewProps {
  template: { title: string; showPatientDetails: boolean; content: string };
  patient?: PatientInfo;
  clinic: ClinicInfo | null;
}

function parseQuestions(content: string): SurveyQuestion[] {
  try {
    const parsed = JSON.parse(content) as { questions?: SurveyQuestion[] };
    return Array.isArray(parsed.questions) ? parsed.questions : [];
  } catch {
    return [];
  }
}

export default function SurveyTemplateView({ template, patient, clinic }: SurveyTemplateViewProps) {
  const addr = clinic?.address ?? null;
  const today = DateTime.now().setZone("Asia/Kolkata").toFormat("dd MMM yyyy");
  const questions = parseQuestions(template.content);
  const printRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadPDF = async () => {
    if (!printRef.current) return;
    setIsDownloading(true);
    try {
      const imgData = await toPng(printRef.current, {
        quality: 1,
        pixelRatio: 3,
        backgroundColor: "#ffffff",
      });
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const imgProps = pdf.getImageProperties(imgData);
      const pdfImgHeight = pdfWidth / (imgProps.width / imgProps.height);
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfImgHeight);
      const nameSlug = patient ? `-${patient.name.toLowerCase().replace(/\s+/g, "-")}` : "";
      const titleSlug = template.title.toLowerCase().replace(/\s+/g, "-");
      pdf.save(`${titleSlug}${nameSlug}-${today}.pdf`);
    } catch (err) {
      console.error("PDF error:", err);
      alert("Failed to generate PDF. Please try printing instead.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div>
      <style>{`
        @page { size: A4; margin: 0; }
        @media print {
          .no-print { display: none !important; }
          .survey-page { box-shadow: none !important; border: none !important; margin: 0 !important; border-radius: 0 !important; }
        }
      `}</style>

      {/* Toolbar */}
      <div className="no-print sticky top-0 z-10 mb-6 flex items-center justify-between border-b border-border-primary bg-white px-6 py-4 shadow-sm">
        <a
          href="/admin/dashboard/settings"
          className="group flex items-center gap-2 text-sm font-medium text-text-secondary hover:text-text-primary"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transition-transform group-hover:-translate-x-1" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          Back to Settings
        </a>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={handleDownloadPDF} loading={isDownloading} loadingText="Downloading…">
            Download
          </Button>
          <Button variant="primary" onClick={() => window.print()}>
            Print
          </Button>
        </div>
      </div>

      {/* A4 sheet */}
      <div
        ref={printRef}
        className="survey-page relative mx-auto flex min-h-[297mm] max-w-[210mm] flex-col rounded-lg border border-border-primary bg-white p-8 shadow-sm"
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

        {/* Clinic header */}
        <div className="relative z-10 mb-4 border-b-2 border-accent-600 pb-2">
          <div className="mb-4 flex items-start justify-between">
            {clinic?.logo && (
              <img src={clinic.logo} alt="Clinic logo" className="h-20 w-40 rounded object-contain" />
            )}
            {addr && (
              <div className="pt-2 text-right">
                <p className="text-sm text-gray-800">{addr.line1}</p>
                {addr.line2 && <p className="text-sm text-gray-800">{addr.line2}</p>}
                <p className="text-sm text-gray-800">{addr.city}, {addr.state} - {addr.pincode}</p>
              </div>
            )}
          </div>
          <h1 className="text-lg font-bold text-accent-600">{clinic?.name ?? ""}</h1>
        </div>

        {/* Survey title */}
        <div className="relative z-10 mb-4">
          <h2 className="text-base font-bold uppercase tracking-wide text-gray-800">{template.title}</h2>
        </div>

        {/* Optional patient details */}
        {template.showPatientDetails && (
          <div className="relative z-10 mb-4 grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <div className="flex items-end gap-2">
              <span className="shrink-0 font-medium text-gray-500">Patient:</span>
              {patient ? (
                <span className="font-semibold text-gray-800">{patient.name}</span>
              ) : (
                <span className="flex-1 border-b border-gray-400" />
              )}
            </div>
            <div className="flex items-end gap-2">
              <span className="shrink-0 font-medium text-gray-500">Date:</span>
              <span className="font-semibold text-gray-800">{today}</span>
            </div>
            <div className="flex items-end gap-2">
              <span className="shrink-0 font-medium text-gray-500">Age / Sex:</span>
              {patient ? (
                <span className="font-semibold text-gray-800">
                  {[patient.age != null ? `${patient.age}y` : null, patient.sex ? patient.sex.charAt(0) : null].filter(Boolean).join(" / ") || "—"}
                </span>
              ) : (
                <span className="flex-1 border-b border-gray-400" />
              )}
            </div>
            <div className="flex items-end gap-2">
              <span className="shrink-0 font-medium text-gray-500">Patient ID:</span>
              {patient ? (
                <span className="font-mono font-semibold text-gray-800">{patient.patientId}</span>
              ) : (
                <span className="flex-1 border-b border-gray-400" />
              )}
            </div>
          </div>
        )}

        <hr className="relative z-10 mb-5 border-gray-200" />

        {/* Questions table */}
        <div className="relative z-10 flex-1">
          {questions.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No questions added to this survey.</p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-gray-300">
                  <th className="w-8 py-2 text-left font-semibold text-gray-600">#</th>
                  <th className="py-2 text-left font-semibold text-gray-600">Question</th>
                  <th className="w-14 py-2 text-center font-semibold text-gray-600">Yes</th>
                  <th className="w-14 py-2 text-center font-semibold text-gray-600">No</th>
                </tr>
              </thead>
              <tbody>
                {questions.map((q, i) => (
                  <tr key={q.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="py-3 align-top text-gray-400">{i + 1}.</td>
                    <td className="py-3 pr-4 align-top text-gray-800">{q.text}</td>
                    <td className="py-3 text-center align-top">
                      <span className="inline-block h-5 w-5 rounded border-2 border-gray-500" />
                    </td>
                    <td className="py-3 text-center align-top">
                      <span className="inline-block h-5 w-5 rounded border-2 border-gray-500" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Signature line */}
        <div className="relative z-10 mt-8 flex justify-between text-sm">
          <div>
            <div className="mb-1 w-48 border-b border-gray-400" />
            <p className="text-xs text-gray-500">Patient / Guardian Signature</p>
          </div>
          <div className="text-right">
            <div className="mb-1 w-48 border-b border-gray-400" />
            <p className="text-xs text-gray-500">Date</p>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 mt-6 border-t-2 border-accent-600 pt-3 text-center">
          {clinic?.phones && clinic.phones.length > 0 && (
            <p className="pb-2 text-xs font-bold text-brand-800">{clinic.phones.join(" | ")}</p>
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
