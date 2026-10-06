"use client";

import { useRef, useState, useEffect } from "react";
import type { ClinicInfo } from "@/lib/utils/get-clinic-for-page";
import { Button } from "@/components/ui";
import jsPDF from "jspdf";
import { toPng } from "html-to-image";
import { DateTime } from "luxon";
import type { PatientInfo } from "@/components/BlankLetterheadTemplate";

interface CustomTemplateViewProps {
  template: { title: string; showPatientDetails: boolean; content: string };
  patient?: PatientInfo;
  clinic: ClinicInfo | null;
}

// CSS pixels per mm at 96 DPI (fixed in CSS spec)
const MM_TO_PX = 3.7795275591;
const A4_H_PX = 297 * MM_TO_PX;
// p-8 = 2rem = 32px, applied top+bottom
const PAGE_PADDING_Y = 64;

function ClinicHeader({ clinic }: { clinic: ClinicInfo | null }) {
  const addr = clinic?.address ?? null;
  return (
    <div className="mb-4 border-b-2 border-accent-600 pb-2">
      <div className="mb-4 flex items-start justify-between">
        <div>
          {clinic?.logo && (
            <img src={clinic.logo} alt="Clinic logo" className="h-20 w-40 rounded object-contain" />
          )}
        </div>
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
  );
}

function PageFooter({ clinic }: { clinic: ClinicInfo | null }) {
  return (
    <div className="border-t-2 border-accent-600 pt-3 text-center">
      {clinic?.phones && clinic.phones.length > 0 && (
        <p className="pb-2 text-xs font-bold text-brand-800">{clinic.phones.join(" | ")}</p>
      )}
      {(clinic?.email || clinic?.website) && (
        <p className="text-xs text-gray-700">
          {[clinic.email, clinic.website].filter(Boolean).join(" | ")}
        </p>
      )}
    </div>
  );
}

export default function CustomTemplateView({ template, patient, clinic }: CustomTemplateViewProps) {
  const today = DateTime.now().setZone("Asia/Kolkata").toFormat("dd MMM yyyy");
  const [isDownloading, setIsDownloading] = useState(false);

  // Measurement refs — rendered off-screen to get real pixel heights.
  // Using flex-column wrappers so child margins are included in offsetHeight
  // (block-layout would collapse them out, undercounting the fixed chrome height).
  const measureFirstTopRef = useRef<HTMLDivElement>(null);  // header+title+patient+hr
  const measureOtherTopRef = useRef<HTMLDivElement>(null);  // header+hr only
  const measureFooterRef   = useRef<HTMLDivElement>(null);
  const measureContentRef  = useRef<HTMLDivElement>(null);

  // One ref per rendered page for PDF capture
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Content offset (px) at which each page starts, and available height per page
  const [pageOffsets, setPageOffsets] = useState<number[]>([0]);
  const [contentHeights, setContentHeights] = useState<number[]>([600]);

  useEffect(() => {
    // requestAnimationFrame lets fonts/images settle before measuring
    const raf = requestAnimationFrame(() => {
      const firstTopH     = measureFirstTopRef.current?.offsetHeight  ?? 0;
      const otherTopH     = measureOtherTopRef.current?.offsetHeight  ?? 0;
      const footerH       = measureFooterRef.current?.offsetHeight    ?? 0;
      const totalContentH = measureContentRef.current?.offsetHeight   ?? 0;

      const innerH = A4_H_PX - PAGE_PADDING_Y;

      const firstContentH = Math.max(innerH - firstTopH - footerH, 60);
      const otherContentH = Math.max(innerH - otherTopH - footerH, 60);

      if (totalContentH <= firstContentH) {
        setPageOffsets([0]);
        setContentHeights([firstContentH]);
        return;
      }

      const offsets: number[] = [0];
      const heights: number[] = [firstContentH];
      let consumed = firstContentH;
      while (consumed < totalContentH) {
        offsets.push(consumed);
        heights.push(otherContentH);
        consumed += otherContentH;
      }
      setPageOffsets(offsets);
      setContentHeights(heights);
    });

    return () => cancelAnimationFrame(raf);
  }, [template.content, template.showPatientDetails, patient]);

  const handleDownloadPDF = async () => {
    setIsDownloading(true);
    try {
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      for (let i = 0; i < pageOffsets.length; i++) {
        const el = pageRefs.current[i];
        if (!el) continue;
        const imgData = await toPng(el, { quality: 1, pixelRatio: 3, backgroundColor: "#ffffff" });
        if (i > 0) pdf.addPage();
        // Fill the A4 page exactly (210×297mm)
        pdf.addImage(imgData, "PNG", 0, 0, 210, 297);
      }

      const nameSlug  = patient ? `-${patient.name.toLowerCase().replace(/\s+/g, "-")}` : "";
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
        .template-content h1 { font-size: 1.25rem; font-weight: 700; margin-bottom: 0.5rem; }
        .template-content h2 { font-size: 1.1rem; font-weight: 700; margin-bottom: 0.5rem; }
        .template-content h3 { font-size: 1rem; font-weight: 600; margin-bottom: 0.375rem; }
        .template-content p { margin-bottom: 0.5rem; }
        .template-content ul { list-style-type: disc; padding-left: 1.5rem; margin-bottom: 0.5rem; }
        .template-content ol { list-style-type: decimal; padding-left: 1.5rem; margin-bottom: 0.5rem; }
        .template-content li { margin-bottom: 0.25rem; }
        .template-content hr { border-color: #e5e7eb; margin: 0.75rem 0; }
        .template-content strong { font-weight: 600; }
        .template-content em { font-style: italic; }
        .template-content blockquote { border-left: 3px solid #9ca3af; padding-left: 0.875rem; margin: 0.5rem 0; color: #6b7280; font-style: italic; }
        @media print {
          .no-print { display: none !important; }
          .print-page { page-break-after: always; break-after: page; }
          .print-page:last-child { page-break-after: auto; break-after: auto; }
        }
      `}</style>

      {/*
        Off-screen measurement container.
        Same width + padding as a real page so offsetHeights match exactly.
        Uses visibility:hidden (not display:none) so layout is computed.
      */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          left: "-9999px",
          top: 0,
          width: "210mm",
          padding: "2rem",
          visibility: "hidden",
          pointerEvents: "none",
        }}
      >
        {/* First-page top chrome: flex-col so child mb-* margins are counted in offsetHeight */}
        <div ref={measureFirstTopRef} style={{ display: "flex", flexDirection: "column" }}>
          <ClinicHeader clinic={clinic} />
          <div className="mb-4">
            <h2 className="text-base font-bold text-gray-800 uppercase tracking-wide">{template.title}</h2>
          </div>
          {template.showPatientDetails && (
            <div className="mb-4 grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
              <div className="flex items-end gap-2">
                <span className="shrink-0 font-medium text-gray-500">Patient:</span>
                <span className="font-semibold text-gray-800">Sample Patient Name</span>
              </div>
              <div className="flex items-end gap-2">
                <span className="shrink-0 font-medium text-gray-500">Date:</span>
                <span className="font-semibold text-gray-800">{today}</span>
              </div>
              <div className="flex items-end gap-2">
                <span className="shrink-0 font-medium text-gray-500">Age / Sex:</span>
                <span className="font-semibold text-gray-800">25y / M</span>
              </div>
              <div className="flex items-end gap-2">
                <span className="shrink-0 font-medium text-gray-500">Patient ID:</span>
                <span className="font-mono font-semibold text-gray-800">DDCJ-20240101-0001</span>
              </div>
              <div className="flex items-end gap-2">
                <span className="shrink-0 font-medium text-gray-500">Phone:</span>
                <span className="font-semibold text-gray-800">9876543210</span>
              </div>
            </div>
          )}
          <hr className="mb-6 border-gray-200" />
        </div>

        {/* Other-page top chrome (no title / patient details) */}
        <div ref={measureOtherTopRef} style={{ display: "flex", flexDirection: "column" }}>
          <ClinicHeader clinic={clinic} />
          <hr className="mb-6 border-gray-200" />
        </div>

        <div ref={measureFooterRef}>
          <PageFooter clinic={clinic} />
        </div>

        <div
          ref={measureContentRef}
          className="text-sm text-gray-800 template-content"
          dangerouslySetInnerHTML={{ __html: template.content }}
        />
      </div>

      {/* Toolbar */}
      <div className="no-print sticky top-0 z-10 mb-6 flex items-center justify-between border-b border-border-primary bg-white px-6 py-4 shadow-sm">
        <div className="flex items-center gap-4">
          <a
            href="/admin/dashboard/settings"
            className="group flex items-center gap-2 text-sm font-medium text-text-secondary hover:text-text-primary"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transition-transform group-hover:-translate-x-1" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            Back to Settings
          </a>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={handleDownloadPDF} loading={isDownloading} loadingText="Downloading…">
            Download
          </Button>
          <Button variant="primary" onClick={() => window.print()}>
            Print
          </Button>
        </div>
      </div>

      {/* A4 pages */}
      <div className="flex flex-col items-center gap-8 pb-16">
        {pageOffsets.map((offset, pageIndex) => {
          const isFirst = pageIndex === 0;
          const contentH = contentHeights[pageIndex] ?? contentHeights[contentHeights.length - 1];

          return (
            <div
              key={pageIndex}
              ref={(el) => { pageRefs.current[pageIndex] = el; }}
              className="print-page relative flex flex-col border border-border-primary bg-white shadow-sm"
              style={{ width: "210mm", height: "297mm", padding: "2rem", overflow: "hidden", boxSizing: "border-box" }}
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

              {/* Clinic header — shown on every page */}
              <div className="relative z-10">
                <ClinicHeader clinic={clinic} />
              </div>

              {/* Title + patient details — first page only */}
              {isFirst && (
                <div className="relative z-10">
                  <div className="mb-4">
                    <h2 className="text-base font-bold text-gray-800 uppercase tracking-wide">{template.title}</h2>
                  </div>

                  {template.showPatientDetails && (
                    <div className="mb-4 grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
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
                      <div className="flex items-end gap-2">
                        <span className="shrink-0 font-medium text-gray-500">Phone:</span>
                        {patient ? (
                          <span className="font-semibold text-gray-800">{patient.phone}</span>
                        ) : (
                          <span className="flex-1 border-b border-gray-400" />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Divider */}
              <hr className="relative z-10 mb-6 border-gray-200" />

              {/*
                Content viewport: fixed height, overflow hidden.
                The content div is shifted up by `offset` px so only the
                correct slice is visible through this window.
              */}
              <div
                className="relative z-10"
                style={{ height: `${contentH}px`, overflow: "hidden", flexShrink: 0 }}
              >
                <div
                  className="text-sm text-gray-800 template-content"
                  style={{ transform: `translateY(-${offset}px)` }}
                  dangerouslySetInnerHTML={{ __html: template.content }}
                />
              </div>

              {/* Footer — pushed to bottom, shown on every page */}
              <div className="relative z-10 mt-auto">
                <PageFooter clinic={clinic} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
