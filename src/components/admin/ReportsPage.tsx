"use client";

import { useState, useEffect, useCallback } from "react";
import { DateTime } from "luxon";
import { formatISTDateTime } from "@/lib/utils/date";
import type { ApiJson } from "@/types/api";

interface Summary {
  totalBilled: number;
  totalCollected: number;
  totalWaived: number;
  appointmentCount: number;
  outstandingTotal: number;
  outstandingCount: number;
}

interface MethodBreakdown {
  method: string;
  amount: number;
  count: number;
}

interface OutstandingBill {
  appointmentId: string;
  appointmentRef: string;
  patientName: string;
  phone: string;
  amountDue: number;
  totalPaid: number;
  balance: number;
  preferredDateTime: string;
}

interface DailyCollection {
  date: string;
  collected: number;
  waived: number;
}

interface ReportData {
  period: { from: string; to: string };
  summary: Summary;
  methodBreakdown: MethodBreakdown[];
  outstandingBills: OutstandingBill[];
  dailyCollections: DailyCollection[];
}

const METHOD_LABELS: Record<string, string> = {
  CASH: "Cash",
  UPI: "UPI",
  CARD: "Card",
  WAIVED: "Waived",
  OTHER: "Other",
};

const PRESETS = [
  { label: "Today", getValue: () => {
    const d = DateTime.now().setZone("Asia/Kolkata");
    return { from: d.toFormat("yyyy-MM-dd"), to: d.toFormat("yyyy-MM-dd") };
  }},
  { label: "This week", getValue: () => {
    const now = DateTime.now().setZone("Asia/Kolkata");
    return { from: now.startOf("week").toFormat("yyyy-MM-dd"), to: now.toFormat("yyyy-MM-dd") };
  }},
  { label: "This month", getValue: () => {
    const now = DateTime.now().setZone("Asia/Kolkata");
    return { from: now.startOf("month").toFormat("yyyy-MM-dd"), to: now.toFormat("yyyy-MM-dd") };
  }},
  { label: "Last month", getValue: () => {
    const lastMonth = DateTime.now().setZone("Asia/Kolkata").minus({ months: 1 });
    return {
      from: lastMonth.startOf("month").toFormat("yyyy-MM-dd"),
      to: lastMonth.endOf("month").toFormat("yyyy-MM-dd"),
    };
  }},
];

function fmt(n: number) {
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ReportsPage() {
  const now = DateTime.now().setZone("Asia/Kolkata");
  const [from, setFrom] = useState(now.startOf("month").toFormat("yyyy-MM-dd"));
  const [to, setTo] = useState(now.toFormat("yyyy-MM-dd"));
  const [activePreset, setActivePreset] = useState("This month");
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchReport = useCallback(async (fromDate: string, toDate: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/reports/payments?from=${fromDate}&to=${toDate}`);
      const json = (await res.json()) as ApiJson & ReportData;
      if (json.success) {
        setData(json);
      } else {
        setError(json.error ?? "Failed to load report.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReport(from, to);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function applyPreset(preset: (typeof PRESETS)[number]) {
    const { from: f, to: t } = preset.getValue();
    setFrom(f);
    setTo(t);
    setActivePreset(preset.label);
    fetchReport(f, t);
  }

  function applyCustomRange() {
    setActivePreset("");
    fetchReport(from, to);
  }

  const cardClass = "rounded-lg border border-border-primary bg-surface-primary p-4";
  const labelClass = "text-xs font-medium text-text-hint uppercase tracking-wide";

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Payment Reports</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Revenue and collection summary for your clinic.
        </p>
      </div>

      {/* Date range controls */}
      <div className="flex flex-wrap items-end gap-3">
        {/* Presets */}
        <div className="flex gap-1.5 flex-wrap">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => applyPreset(preset)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                activePreset === preset.label
                  ? "border-border-focus bg-surface-highlight text-text-primary"
                  : "border-border-primary bg-surface-primary text-text-secondary hover:bg-surface-secondary"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Custom range */}
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => { setFrom(e.target.value); setActivePreset(""); }}
            className="rounded-md border border-border-primary bg-surface-primary px-2 py-1 text-xs text-text-primary focus:border-border-focus focus:outline-none"
          />
          <span className="text-text-hint text-xs">to</span>
          <input
            type="date"
            value={to}
            min={from}
            max={now.toFormat("yyyy-MM-dd")}
            onChange={(e) => { setTo(e.target.value); setActivePreset(""); }}
            className="rounded-md border border-border-primary bg-surface-primary px-2 py-1 text-xs text-text-primary focus:border-border-focus focus:outline-none"
          />
          <button
            onClick={applyCustomRange}
            className="rounded-md border border-border-primary bg-surface-primary px-3 py-1 text-xs font-medium text-text-secondary hover:bg-surface-secondary"
          >
            Apply
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-error-200 bg-surface-error px-4 py-3 text-sm text-text-error">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className={`${cardClass} animate-pulse`}>
              <div className="h-3 w-20 rounded bg-surface-tertiary mb-3" />
              <div className="h-7 w-28 rounded bg-surface-tertiary" />
            </div>
          ))}
        </div>
      ) : data ? (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className={cardClass}>
              <p className={labelClass}>Total Billed</p>
              <p className="mt-2 text-2xl font-semibold text-text-primary tabular-nums">
                {fmt(data.summary.totalBilled)}
              </p>
              <p className="mt-1 text-xs text-text-hint">
                {data.summary.appointmentCount} appointment{data.summary.appointmentCount !== 1 ? "s" : ""}
              </p>
            </div>

            <div className={cardClass}>
              <p className={labelClass}>Collected</p>
              <p className="mt-2 text-2xl font-semibold text-text-success tabular-nums">
                {fmt(data.summary.totalCollected)}
              </p>
              {data.summary.totalBilled > 0 && (
                <p className="mt-1 text-xs text-text-hint">
                  {Math.round((data.summary.totalCollected / data.summary.totalBilled) * 100)}% of billed
                </p>
              )}
            </div>

            <div className={cardClass}>
              <p className={labelClass}>Waived</p>
              <p className="mt-2 text-2xl font-semibold text-text-secondary tabular-nums">
                {fmt(data.summary.totalWaived)}
              </p>
              <p className="mt-1 text-xs text-text-hint">in this period</p>
            </div>

            <div className={`${cardClass} ${data.summary.outstandingTotal > 0 ? "border-error-200 bg-surface-error/30" : ""}`}>
              <p className={labelClass}>Outstanding</p>
              <p className={`mt-2 text-2xl font-semibold tabular-nums ${data.summary.outstandingTotal > 0 ? "text-text-error" : "text-text-success"}`}>
                {fmt(data.summary.outstandingTotal)}
              </p>
              <p className="mt-1 text-xs text-text-hint">
                {data.summary.outstandingCount} unpaid bill{data.summary.outstandingCount !== 1 ? "s" : ""} (all-time)
              </p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Payment method breakdown */}
            <div className={cardClass}>
              <h2 className="text-sm font-semibold text-text-primary mb-4">
                Collections by Method
                <span className="ml-2 text-xs font-normal text-text-hint">this period</span>
              </h2>
              {data.methodBreakdown.length === 0 ? (
                <p className="text-sm text-text-hint">No payments in this period.</p>
              ) : (
                <div className="space-y-3">
                  {data.methodBreakdown.map((m) => {
                    const total = data.methodBreakdown.reduce((s, x) => s + x.amount, 0);
                    const pct = total > 0 ? Math.round((m.amount / total) * 100) : 0;
                    return (
                      <div key={m.method}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-text-secondary">{METHOD_LABELS[m.method] ?? m.method}</span>
                          <span className="font-medium text-text-primary tabular-nums">
                            {fmt(m.amount)}
                            <span className="ml-2 text-xs text-text-hint font-normal">
                              {m.count} txn{m.count !== 1 ? "s" : ""}
                            </span>
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-surface-tertiary overflow-hidden">
                          <div
                            className={`h-full rounded-full ${m.method === "WAIVED" ? "bg-text-hint" : "bg-interactive-primary"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Daily collections */}
            <div className={cardClass}>
              <h2 className="text-sm font-semibold text-text-primary mb-4">
                Daily Collections
                <span className="ml-2 text-xs font-normal text-text-hint">this period</span>
              </h2>
              {data.dailyCollections.length === 0 ? (
                <p className="text-sm text-text-hint">No payments in this period.</p>
              ) : (
                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                  {data.dailyCollections.map((d) => {
                    const dt = DateTime.fromISO(d.date, { zone: "Asia/Kolkata" });
                    return (
                      <div key={d.date} className="flex items-center justify-between text-sm">
                        <span className="text-text-secondary w-28 shrink-0">
                          {dt.toFormat("dd MMM, EEE")}
                        </span>
                        <div className="flex items-center gap-3 text-right">
                          {d.collected > 0 && (
                            <span className="text-text-success tabular-nums">{fmt(d.collected)}</span>
                          )}
                          {d.waived > 0 && (
                            <span className="text-text-hint text-xs tabular-nums">+{fmt(d.waived)} waived</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Outstanding bills */}
          {data.outstandingBills.length > 0 && (
            <div className={cardClass}>
              <h2 className="text-sm font-semibold text-text-primary mb-4">
                Outstanding Bills
                <span className="ml-2 text-xs font-normal text-text-hint">all-time · sorted by balance</span>
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border-primary text-left">
                      <th className="pb-2 pr-4 text-xs font-medium text-text-hint">Patient</th>
                      <th className="pb-2 pr-4 text-xs font-medium text-text-hint">Appointment</th>
                      <th className="pb-2 pr-4 text-xs font-medium text-text-hint">Date</th>
                      <th className="pb-2 pr-4 text-xs font-medium text-text-hint text-right">Due</th>
                      <th className="pb-2 pr-4 text-xs font-medium text-text-hint text-right">Paid</th>
                      <th className="pb-2 text-xs font-medium text-text-error text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-primary">
                    {data.outstandingBills.map((bill) => (
                      <tr key={bill.appointmentId} className="hover:bg-surface-secondary/50 transition-colors">
                        <td className="py-2 pr-4">
                          <div className="font-medium text-text-primary">{bill.patientName}</div>
                          <div className="text-xs text-text-hint">{bill.phone}</div>
                        </td>
                        <td className="py-2 pr-4 text-text-secondary font-mono text-xs">
                          {bill.appointmentRef}
                        </td>
                        <td className="py-2 pr-4 text-text-secondary text-xs whitespace-nowrap">
                          {formatISTDateTime(new Date(bill.preferredDateTime))}
                        </td>
                        <td className="py-2 pr-4 text-right text-text-secondary tabular-nums">
                          {fmt(bill.amountDue)}
                        </td>
                        <td className="py-2 pr-4 text-right text-text-secondary tabular-nums">
                          {fmt(bill.totalPaid)}
                        </td>
                        <td className="py-2 text-right font-semibold text-text-error tabular-nums">
                          {fmt(bill.balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
