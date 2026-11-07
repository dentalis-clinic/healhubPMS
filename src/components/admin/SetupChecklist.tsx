"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui";
import { SETUP_HIDDEN_COOKIE } from "@/lib/constants/setup";

export interface SetupItem {
  key: string;
  label: string;
  detail: string;
  done: boolean;
  href: string;
  action: string;
}

interface SetupChecklistProps {
  bookingUrl: string;
  items: SetupItem[];
}

/**
 * What a new clinic still has to add after signup. Each item's state comes
 * from the clinic's real data (worked out on the server), so nothing here
 * can drift: add a logo in Settings and that item is done.
 */
export default function SetupChecklist({ bookingUrl, items }: SetupChecklistProps) {
  const [hidden, setHidden] = useState(false);
  const [copied, setCopied] = useState(false);

  if (hidden) return null;

  const doneCount = items.filter((i) => i.done).length;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(bookingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked (permissions, insecure origin); the link is
      // still visible to copy by hand.
    }
  }

  function hide() {
    document.cookie = `${SETUP_HIDDEN_COOKIE}=1; path=/; max-age=31536000; samesite=lax`;
    setHidden(true);
  }

  return (
    <section
      aria-labelledby="setup-heading"
      className="rounded-lg border border-border-primary bg-surface-primary shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 p-5">
        <div className="min-w-0">
          <h2 id="setup-heading" className="text-lg font-semibold text-balance text-text-primary">
            Finish setting up your clinic
          </h2>
          <p className="mt-1 text-sm text-pretty text-text-secondary">
            Your booking page is already live. These details make it useful to patients.
          </p>
        </div>
        <p className="text-sm text-text-hint tabular-nums">
          {doneCount} of {items.length} done
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-y border-border-primary bg-surface-secondary px-5 py-3">
        <span className="text-xs font-medium text-text-secondary">Booking page</span>
        <a
          href={bookingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="min-w-0 flex-1 truncate font-mono text-sm text-text-link hover:underline"
        >
          {bookingUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}
        </a>
        <Button size="sm" variant="secondary" onClick={copyLink}>
          {copied ? "Copied" : "Copy link"}
        </Button>
      </div>

      <ol className="divide-y divide-border-primary">
        {items.map((item) => (
          <li key={item.key} className="flex items-center gap-3 px-5 py-3">
            {item.done ? (
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-interactive-primary text-text-inverse">
                <svg className="size-3" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <path d="M13.354 4.146a.5.5 0 0 1 0 .708l-6.5 6.5a.5.5 0 0 1-.708 0l-3-3a.5.5 0 1 1 .708-.708L6.5 10.293l6.146-6.147a.5.5 0 0 1 .708 0z" />
                </svg>
              </span>
            ) : (
              <span className="size-5 shrink-0 rounded-full border-2 border-border-secondary" aria-hidden="true" />
            )}
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-medium ${item.done ? "text-text-tertiary" : "text-text-primary"}`}>
                <span className="sr-only">{item.done ? "Done: " : "To do: "}</span>
                {item.label}
              </p>
              {!item.done && (
                <p className="mt-0.5 text-xs text-pretty text-text-hint">{item.detail}</p>
              )}
            </div>
            {!item.done && (
              <Link
                href={item.href}
                className="shrink-0 rounded border border-border-secondary px-2.5 py-1 text-xs font-medium text-text-secondary hover:bg-surface-secondary hover:text-text-primary"
              >
                {item.action}
              </Link>
            )}
          </li>
        ))}
      </ol>

      <div className="flex justify-end border-t border-border-primary px-5 py-3">
        <button
          type="button"
          onClick={hide}
          className="text-sm text-text-hint hover:text-text-secondary"
        >
          Hide this list
        </button>
      </div>
    </section>
  );
}
